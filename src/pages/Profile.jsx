import { useEffect, useMemo, useRef, useState } from "react";

/** Avoid second `sendEmailVerification` right after signup (register flow already sends one). */
const VERIFICATION_RESEND_COOLDOWN_MS = 120_000;

function msSinceUserCreation(u) {
  const ct = u?.metadata?.creationTime;
  if (!ct) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(ct).getTime();
}
import { useBottomScrollFade } from "../hooks/useBottomScrollFade.js";
import { useEmailDomainSuggestion } from "../hooks/useEmailDomainSuggestion.js";
import { Link, useNavigate } from "react-router-dom";
import { sendEmailVerification, verifyBeforeUpdateEmail } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseAuth } from "../firebaseAuth.js";
import { useDb } from "../hooks/useDb.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { EmailDomainHint } from "../components/EmailDomainHint.jsx";
import { Footer } from "../components/Footer.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import defaultAvatar from "../assets/illustrations/profile.webp";
import { AVATAR_OPTIONS, getAvatarById } from "../assets/avatarOptions.js";
import { generateAnonymousName } from "../utils/generateAnonymousName.js";
import {
  deletePostCascade,
  getPostExpiryBadge,
  hasActiveChatsForPost,
  isPostExpired,
} from "../utils/postLifecycle.js";
import { formatRelativeSmart } from "../utils/relativeTime.js";
import { sendEmail } from "../utils/sendEmail.js";
import { getEmailVerificationActionSettings } from "../utils/authEmailAction.js";
import { beginMatchCelebration } from "../utils/matchCelebration.js";
import { backfillRepliedPostsIndex, upsertRepliedPostIndex } from "../utils/repliedPostsIndex.js";
import { appearanceTitleFromDescription, appearanceTitleFromPost } from "../utils/postAppearance.js";
import "./Account.css";
import "./ChatList.css";

/**
 * @param {unknown} err
 * @param {(key: string) => string} t
 */
function emailVerifyErrorMessage(err, t) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (code === "auth/too-many-requests") return t("profile.emailVerify.errorTooMany");
  if (code === "auth/unauthorized-continue-uri") return t("profile.emailVerify.errorUnauthorizedContinueUri");
  if (code === "auth/requires-recent-login") return t("profile.emailVerify.errorRecentLogin");
  if (code === "auth/email-already-in-use") return t("login.errorEmailInUse");
  if (code === "auth/invalid-email") return t("login.errorInvalidEmail");
  if (code === "auth/operation-not-allowed") return t("profile.emailVerify.errorNotAllowed");
  if (code === "auth/network-request-failed") return t("profile.emailVerify.errorNetwork");
  if (code === "auth/internal-error") return t("profile.emailVerify.errorInternal");
  return t("login.errorGeneric");
}

/** Firebase `sendEmailVerification` / `verifyBeforeUpdateEmail` apply to email+password sign-in. */
function userHasPasswordProvider(u) {
  return u?.providerData?.some((p) => p.providerId === "password") ?? false;
}

function createdAtIso(value) {
  if (!value?.toDate) return undefined;
  return value.toDate().toISOString();
}

const MOTIVATION_KEYS = { know: "post.motivation.know", thanks: "post.motivation.thanks", noticed: "post.motivation.noticed" };

function getResponseStatusKind(response) {
  const status = String(response?.status || "").toLowerCase();
  const attemptCount = Number(response?.attemptCount ?? 1);
  if (status === "pending") return "pending";
  if (status === "rejected" && attemptCount === 1) return "retry";
  if (status === "rejected" && attemptCount >= 2) return "closed";
  if (status === "accepted") return "accepted";
  return "pending";
}

async function sendProfileNotificationEmail(kind, postId, responseUserId) {
  try {
    await sendEmail({ kind, postId, responseUserId });
  } catch (mailErr) {
    console.error(`[Profile] sendEmail ${kind} failed`, mailErr);
  }
}

function Profile() {
  const { t, language } = useLanguage();
  const { user, loading, signOut, refreshAuthProfile } = useAuth();
  const db = useDb();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState("");
  const [postResponsesByPostId, setPostResponsesByPostId] = useState({});
  const [expandedPostIds, setExpandedPostIds] = useState({});
  const [responseActionBusy, setResponseActionBusy] = useState({});
  const [deletedChatsById, setDeletedChatsById] = useState({});
  const [repliedPosts, setRepliedPosts] = useState([]);
  const [repliedPostsLoading, setRepliedPostsLoading] = useState(true);
  const [repliedPostsError, setRepliedPostsError] = useState("");
  const repliedPostsLoadGenRef = useRef(0);
  const repliedPostsBackfillAttemptedRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState(1);
  /** Which email-verify action is in flight (avoids wrong button showing "sending…"). */
  const [emailVerifyOp, setEmailVerifyOp] = useState(null);
  const emailVerifyBusy = emailVerifyOp !== null;
  const [emailVerifyInfo, setEmailVerifyInfo] = useState("");
  const [emailVerifyError, setEmailVerifyError] = useState("");
  const [emailModifyOpen, setEmailModifyOpen] = useState(false);
  const [newEmailForVerify, setNewEmailForVerify] = useState("");
  const newEmailSuggestion = useEmailDomainSuggestion(newEmailForVerify);
  /** Re-check cooldown timer so the resend button enables without full page reload. */
  const [verificationCooldownTick, setVerificationCooldownTick] = useState(0);
  const celebrationPreviewCancelRef = useRef(null);

  const expandedPostsKey = useMemo(
    () =>
      Object.keys(expandedPostIds)
        .filter((k) => expandedPostIds[k])
        .sort()
        .join(","),
    [expandedPostIds],
  );
  const postsScrollKey = useMemo(() => `${posts.length}-${expandedPostsKey}`, [posts.length, expandedPostsKey]);
  const repliesScrollKey = useMemo(() => `${repliedPosts.length}`, [repliedPosts.length]);
  const {
    ref: postsScrollInnerRef,
    showFade: postsScrollShowFade,
  } = useBottomScrollFade(postsScrollKey);

  const emailVerificationResendCooldownActive =
    !!user &&
    !user.emailVerified &&
    userHasPasswordProvider(user) &&
    msSinceUserCreation(user) < VERIFICATION_RESEND_COOLDOWN_MS;
  void verificationCooldownTick;

  useEffect(() => {
    if (!user || user.emailVerified || !userHasPasswordProvider(user)) return;
    if (msSinceUserCreation(user) >= VERIFICATION_RESEND_COOLDOWN_MS) return;
    const id = setInterval(() => setVerificationCooldownTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [user]);
  const {
    ref: repliesScrollInnerRef,
    showFade: repliesScrollShowFade,
  } = useBottomScrollFade(repliesScrollKey);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user || !db) return undefined;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
  }, [user, db]);

  useEffect(
    () => () => {
      celebrationPreviewCancelRef.current?.();
      celebrationPreviewCancelRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!user || !db) return undefined;
    const q = query(collection(db, "users", user.uid, "ownedPosts"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      async (snap) => {
        try {
          const ids = snap.docs.map((d) => d.id);
          const rows = await Promise.all(ids.map((id) => getDoc(doc(db, "posts", id))));
          const expiredIds = [];
          setPostsError("");
          setPosts(
            rows
              .filter((d) => {
                if (!d.exists()) return false;
                if (isPostExpired(d.data()?.createdAt, d.data()?.isPinned === true)) {
                  expiredIds.push(d.id);
                  return false;
                }
                return true;
              })
              .map((d) => {
                const data = d.data();
                const { claimToken: _claim, ...rest } = data;
                return { id: d.id, ...rest };
              }),
          );
          if (expiredIds.length > 0) {
            expiredIds.forEach((postId) => {
              deletePostCascade(postId, user.uid).catch((err) => {
                console.error(err);
              });
            });
          }
        } catch (err) {
          console.error(err);
          setPostsError(err.message || String(err));
        }
      },
      (err) => {
        console.error(err);
        setPostsError(err.message || String(err));
      },
    );
  }, [user, db]);

  useEffect(() => {
    if (!user || !db) {
      setRepliedPosts([]);
      setRepliedPostsError("");
      setRepliedPostsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setRepliedPostsLoading(true);
    setRepliedPostsError("");

    const q = query(collection(db, "users", user.uid, "repliedPosts"), orderBy("respondedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loadGen = (repliedPostsLoadGenRef.current += 1);
        void (async () => {
          if (snap.empty) {
            if (!repliedPostsBackfillAttemptedRef.current) {
              repliedPostsBackfillAttemptedRef.current = true;
              try {
                const migrated = await backfillRepliedPostsIndex(db, user.uid);
                if (migrated === 0 && !cancelled && loadGen === repliedPostsLoadGenRef.current) {
                  setRepliedPosts([]);
                  setRepliedPostsError("");
                  setRepliedPostsLoading(false);
                }
              } catch (err) {
                console.error("[Profile] repliedPosts backfill failed", err);
                if (!cancelled && loadGen === repliedPostsLoadGenRef.current) {
                  setRepliedPostsError(t("profile.repliesLoadError"));
                  setRepliedPostsLoading(false);
                }
              }
              return;
            }
            if (!cancelled && loadGen === repliedPostsLoadGenRef.current) {
              setRepliedPosts([]);
              setRepliedPostsError("");
              setRepliedPostsLoading(false);
            }
            return;
          }

          const rows = snap.docs.map((indexDoc) => ({
            postId: indexDoc.id,
            index: indexDoc.data(),
          }));

          const enriched = await Promise.all(
            rows.map(async ({ postId, index }) => {
              const path = `posts/${postId}/responses/${user.uid}`;
              try {
                const postSnap = await getDoc(doc(db, "posts", postId));
                const chatId = typeof index.chatId === "string" ? index.chatId : "";
                let chatDeleted = false;
                if (chatId) {
                  const chatSnap = await getDoc(doc(db, "chats", chatId));
                  chatDeleted = !chatSnap.exists();
                }
                return {
                  path,
                  response: {
                    status: index.status,
                    attemptCount: index.attemptCount,
                    createdAt: index.respondedAt,
                    chatId,
                  },
                  post: postSnap.exists() ? { id: postSnap.id, ...postSnap.data() } : null,
                  chatDeleted,
                };
              } catch (err) {
                console.error("[Profile] enrich replied post failed", postId, err);
                return {
                  path,
                  response: {
                    status: index.status,
                    attemptCount: index.attemptCount,
                    createdAt: index.respondedAt,
                    chatId: index.chatId,
                  },
                  post: null,
                  chatDeleted: false,
                };
              }
            }),
          );

          if (cancelled || loadGen !== repliedPostsLoadGenRef.current) return;
          setRepliedPosts(enriched);
          setRepliedPostsError("");
          setRepliedPostsLoading(false);
        })();
      },
      (err) => {
        console.error("[Profile] repliedPosts listener error", err);
        if (!cancelled) {
          setRepliedPostsError(t("profile.repliesLoadError"));
          setRepliedPostsLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
      unsub();
      repliedPostsBackfillAttemptedRef.current = false;
    };
  }, [user, db, t]);

  useEffect(() => {
    if (!db || !posts.length) return undefined;
    const unsubscribers = posts.map((post) =>
      onSnapshot(collection(db, "posts", post.id, "responses"), (snap) => {
        setPostResponsesByPostId((prev) => ({
          ...prev,
          [post.id]: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
        }));
      }),
    );
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [posts, db]);

  useEffect(() => {
    if (!db) return undefined;
    let cancelled = false;
    async function inspectChats() {
      const chatIds = new Set();
      Object.values(postResponsesByPostId).forEach((responses) => {
        responses.forEach((resp) => {
          if (String(resp?.status || "") === "accepted" && typeof resp?.chatId === "string" && resp.chatId) {
            chatIds.add(resp.chatId);
          }
        });
      });
      if (chatIds.size === 0) {
        if (!cancelled) setDeletedChatsById({});
        return;
      }
      const results = await Promise.all(
        Array.from(chatIds).map(async (chatId) => {
          try {
            const snap = await getDoc(doc(db, "chats", chatId));
            return [chatId, !snap.exists()];
          } catch (err) {
            // Legacy chat docs may fail read rules; treat as unavailable.
            console.error(err);
            return [chatId, true];
          }
        }),
      );
      if (cancelled) return;
      setDeletedChatsById(Object.fromEntries(results));
    }
    void inspectChats();
    return () => {
      cancelled = true;
    };
  }, [postResponsesByPostId, db]);

  const selectedAvatarId = Number(profile?.avatarId) >= 1 && Number(profile?.avatarId) <= 12 ? Number(profile?.avatarId) : 1;
  const avatar = user ? getAvatarById(selectedAvatarId) : { src: defaultAvatar, srcSet: undefined };
  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "—";
  const email = profile?.email || user?.email || "—";

  const saveAvatar = async () => {
    if (!db || !user || avatarSaving) return;
    setSaveError("");
    setAvatarSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { avatarId: pendingAvatarId });
      setIsAvatarModalOpen(false);
    } catch (e) {
      setSaveError(e.message || String(e));
    } finally {
      setAvatarSaving(false);
    }
  };

  const openAvatarModal = () => {
    setPendingAvatarId(selectedAvatarId);
    setIsAvatarModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const handleResendVerification = async () => {
    if (!user || emailVerifyBusy) return;
    if (emailVerificationResendCooldownActive) {
      setEmailVerifyError("");
      setEmailVerifyInfo(t("profile.emailVerify.cooldownHint"));
      return;
    }
    setEmailVerifyError("");
    setEmailVerifyInfo("");
    const auth = await getFirebaseAuth();
    const current = auth.currentUser;
    if (!current?.email) {
      setEmailVerifyError(t("profile.emailVerify.errorNoSession"));
      return;
    }
    if (!userHasPasswordProvider(current)) {
      setEmailVerifyError(t("profile.emailVerify.errorPasswordOnly"));
      return;
    }
    setEmailVerifyOp("resend");
    try {
      const action = getEmailVerificationActionSettings();
      if (action) {
        await sendEmailVerification(current, action);
      } else {
        await sendEmailVerification(current);
      }
      setEmailVerifyInfo(t("profile.emailVerify.sentResend"));
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "auth/too-many-requests") {
        setEmailVerifyError("");
        setEmailVerifyInfo(t("profile.emailVerify.tooManyLikelySent"));
      } else {
        console.error("[emailVerify] sendEmailVerification failed", err);
        setEmailVerifyError(emailVerifyErrorMessage(err, t));
      }
    } finally {
      setEmailVerifyOp(null);
    }
  };

  const handleRefreshEmailVerification = async () => {
    if (!user || emailVerifyBusy) return;
    setEmailVerifyError("");
    setEmailVerifyInfo("");
    setEmailVerifyOp("refresh");
    try {
      await refreshAuthProfile();
      if (user.emailVerified) {
        setEmailVerifyInfo(t("profile.emailVerify.verifiedOk"));
      } else {
        setEmailVerifyInfo(t("profile.emailVerify.notVerifiedYet"));
      }
    } catch (err) {
      setEmailVerifyError(emailVerifyErrorMessage(err, t));
    } finally {
      setEmailVerifyOp(null);
    }
  };

  const handleSubmitNewEmailForVerification = async () => {
    if (!user || emailVerifyBusy) return;
    const auth = await getFirebaseAuth();
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      setEmailVerifyError(t("profile.emailVerify.errorNoSession"));
      return;
    }
    if (!userHasPasswordProvider(currentUser)) {
      setEmailVerifyError(t("profile.emailVerify.errorPasswordOnly"));
      return;
    }
    const next = newEmailForVerify.trim().toLowerCase();
    const current = String(currentUser.email ?? "").trim().toLowerCase();
    setEmailVerifyError("");
    setEmailVerifyInfo("");
    if (!next) {
      setEmailVerifyError(t("profile.emailVerify.errorEmptyNew"));
      return;
    }
    if (next === current) {
      setEmailVerifyError(t("profile.emailVerify.errorSameEmail"));
      return;
    }
    setEmailVerifyOp("newEmail");
    try {
      const action = getEmailVerificationActionSettings();
      if (action) {
        await verifyBeforeUpdateEmail(currentUser, next, action);
      } else {
        await verifyBeforeUpdateEmail(currentUser, next);
      }
      setEmailModifyOpen(false);
      setNewEmailForVerify("");
      setEmailVerifyInfo(t("profile.emailVerify.sentNew"));
    } catch (err) {
      console.error("[emailVerify] verifyBeforeUpdateEmail failed", err);
      setEmailVerifyError(emailVerifyErrorMessage(err, t));
    } finally {
      setEmailVerifyOp(null);
    }
  };

  const approveResponse = async (postId, responseUserId) => {
    if (!db || !user) return;
    const busyKey = `${postId}:${responseUserId}`;
    setResponseActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    try {
      const responseRef = doc(db, "posts", postId, "responses", responseUserId);
      const responseSnap = await getDoc(responseRef);
      if (!responseSnap.exists()) return;
      const responseData = responseSnap.data();
      const existingChatId = typeof responseData.chatId === "string" ? responseData.chatId : "";
      const chatRef = existingChatId ? doc(db, "chats", existingChatId) : doc(collection(db, "chats"));
      let responderAnonymousName = responseData.responderAnonymousName || "";
      let posterAnonymousName = "";
      let expiresAt =
        responseData.createdAt?.toDate?.() != null
          ? new Date(responseData.createdAt.toDate().getTime() + 7 * 24 * 60 * 60 * 1000)
          : new Date(0);

      if (existingChatId) {
        const existingChatSnap = await getDoc(chatRef);
        if (existingChatSnap.exists()) {
          const existingChatData = existingChatSnap.data();
          responderAnonymousName =
            responderAnonymousName ||
            existingChatData.responderAnonymousName ||
            existingChatData.responderName ||
            generateAnonymousName(language);
          posterAnonymousName =
            existingChatData.posterAnonymousName || existingChatData.posterName || generateAnonymousName(language);
          expiresAt = existingChatData.expiresAt?.toDate?.() ?? expiresAt;
        } else {
          responderAnonymousName = responderAnonymousName || generateAnonymousName(language);
          posterAnonymousName = generateAnonymousName(language);
        }
      } else {
        responderAnonymousName = responderAnonymousName || generateAnonymousName(language);
        posterAnonymousName = generateAnonymousName(language);
      }
      await setDoc(
        chatRef,
        {
          postId,
          posterUid: user.uid,
          responderUid: responseUserId,
          posterAnonymousName,
          responderAnonymousName,
          // backward compatibility for existing UI reads
          posterName: posterAnonymousName,
          responderName: responderAnonymousName,
          participants: [user.uid, responseUserId],
          createdAt: responseData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt,
        },
      );
      await updateDoc(responseRef, {
        status: "accepted",
        chatId: chatRef.id,
        reviewedAt: serverTimestamp(),
      });
      await upsertRepliedPostIndex(db, responseUserId, postId, {
        status: "accepted",
        chatId: chatRef.id,
        attemptCount: responseData.attemptCount ?? 1,
      });
      await sendProfileNotificationEmail("posterAcceptedResponse", postId, responseUserId);
      beginMatchCelebration();
      navigate(`/chat/${chatRef.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setResponseActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const rejectResponse = async (postId, responseUserId) => {
    if (!db || !user) return;
    const confirmed = window.confirm(t("profile.confirmReject"));
    if (!confirmed) return;
    const busyKey = `${postId}:${responseUserId}`;
    setResponseActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    try {
      const rejectRef = doc(db, "posts", postId, "responses", responseUserId);
      const rejectSnap = await getDoc(rejectRef);
      const priorAttempt = Number(rejectSnap.data()?.attemptCount ?? 1);
      await updateDoc(rejectRef, {
        status: "rejected",
        attemptCount: increment(1),
        reviewedAt: serverTimestamp(),
      });
      await upsertRepliedPostIndex(db, responseUserId, postId, {
        status: "rejected",
        attemptCount: priorAttempt + 1,
      });
      await sendProfileNotificationEmail("posterRejectedResponse", postId, responseUserId);
    } catch (err) {
      console.error(err);
    } finally {
      setResponseActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const previewCelebration = () => {
    celebrationPreviewCancelRef.current?.();
    const { cancel } = beginMatchCelebration();
    celebrationPreviewCancelRef.current = cancel;
  };

  const deletePostManually = async (postId) => {
    if (!user) return;
    let hasActiveChats = false;
    try {
      hasActiveChats = await hasActiveChatsForPost(postId);
    } catch (err) {
      console.error(err);
      setPostsError(err.message || String(err));
      return;
    }
    const confirmKey = hasActiveChats ? "profile.confirmDeletePostWithChats" : "profile.confirmDeletePost";
    if (!window.confirm(t(confirmKey))) return;
    try {
      await deletePostCascade(postId, user.uid);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error(err);
      setPostsError(err.message || String(err));
    }
  };

  if (loading || !user) {
    return (
      <div className="home-page account-page app-shell">
        <SiteHeader />
        <main className="account-main">
          <p className="account-muted">{t("profile.loading")}</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="home-page account-page app-shell">
      <SiteHeader />
      <main className="account-main">
        <div className="profile-hero">
          <button type="button" className="profile-picture-trigger" onClick={openAvatarModal} aria-label={t("profile.avatarOpen")}>
            <img
              className="profile-picture"
              src={avatar.src}
              srcSet={avatar.srcSet}
              sizes="96px"
              alt=""
              width={96}
              height={96}
              decoding="async"
            />
          </button>
          <div className="profile-hero-text">
            <h1 className="account-title profile-name">{displayName}</h1>
            <p className="profile-email">{email}</p>
            <div className="profile-actions">
              <button type="button" className="account-btn account-btn--ghost" onClick={handleSignOut}>
                {t("profile.signOut")}
              </button>
              <Link className="account-btn account-btn--outline" to="/post">
                {t("profile.newPost")}
              </Link>
            </div>
          </div>
        </div>
        {user.email && !user.emailVerified ? (
          <div className="profile-email-verify-banner" role="region" aria-label={t("profile.emailVerify.regionAria")}>
            <p className="profile-email-verify-banner__text">
              {t("profile.emailVerify.banner").replace("{email}", user.email)}
            </p>
            <div className="profile-email-verify-banner__actions">
              <button
                type="button"
                className="account-btn account-btn--outline profile-email-verify-btn"
                disabled={emailVerifyBusy || emailVerificationResendCooldownActive}
                title={
                  emailVerificationResendCooldownActive ? t("profile.emailVerify.cooldownHint") : undefined
                }
                onClick={handleResendVerification}
              >
                {emailVerifyOp === "resend" ? t("profile.emailVerify.sending") : t("profile.emailVerify.resend")}
              </button>
              <button
                type="button"
                className="account-btn account-btn--primary profile-email-verify-btn"
                disabled={emailVerifyBusy}
                onClick={() => {
                  setEmailModifyOpen((prev) => {
                    if (prev) setNewEmailForVerify("");
                    return !prev;
                  });
                  setEmailVerifyError("");
                  setEmailVerifyInfo("");
                }}
              >
                {t("profile.emailVerify.modify")}
              </button>
              <button
                type="button"
                className="account-btn account-btn--ghost profile-email-verify-btn"
                disabled={emailVerifyBusy}
                onClick={handleRefreshEmailVerification}
              >
                {emailVerifyOp === "refresh" ? t("profile.emailVerify.refreshing") : t("profile.emailVerify.refreshStatus")}
              </button>
            </div>
            {emailVerificationResendCooldownActive ? (
              <p className="profile-email-verify-cooldown">{t("profile.emailVerify.cooldownHint")}</p>
            ) : null}
            <div className="profile-email-verify-feedback" aria-live="polite">
              {emailVerifyInfo ? <p className="profile-email-verify__ok">{emailVerifyInfo}</p> : null}
              {emailVerifyError ? (
                <p className="account-error profile-email-verify__err" role="alert">
                  {emailVerifyError}
                </p>
              ) : null}
            </div>
            {emailModifyOpen ? (
              <div className="profile-email-verify-modify">
                <p className="profile-email-verify-modify__hint">{t("profile.emailVerify.modifyHint")}</p>
                <label className="account-label" htmlFor="profile-new-email">
                  {t("profile.emailVerify.newEmail")}
                </label>
                <input
                  id="profile-new-email"
                  type="email"
                  className="account-input"
                  value={newEmailForVerify}
                  onChange={(ev) => setNewEmailForVerify(ev.target.value)}
                  autoComplete="email"
                />
                <EmailDomainHint suggestion={newEmailSuggestion} onApply={setNewEmailForVerify} />
                <div className="profile-email-verify-modify__actions">
                  <button
                    type="button"
                    className="account-btn account-btn--outline"
                    disabled={emailVerifyBusy}
                    onClick={() => {
                      setEmailModifyOpen(false);
                      setNewEmailForVerify("");
                      setEmailVerifyError("");
                    }}
                  >
                    {t("profile.emailVerify.cancelModify")}
                  </button>
                  <button
                    type="button"
                    className="account-btn account-btn--primary"
                    disabled={emailVerifyBusy}
                    onClick={handleSubmitNewEmailForVerification}
                  >
                    {emailVerifyOp === "newEmail" ? t("profile.emailVerify.sending") : t("profile.emailVerify.submitNew")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {saveError ? <p className="account-error" role="alert">{saveError}</p> : null}

        <section className="account-section" aria-labelledby="profile-posts-heading">
          <div className="profile-posts-heading-row">
            <h2 id="profile-posts-heading" className="account-section-title profile-posts-heading-row__title">
              {t("profile.postsTitle")}
            </h2>
            {profile?.isAdmin === true ? (
              <button
                type="button"
                className="profile-admin-celebration-preview-btn"
                onClick={previewCelebration}
                aria-label={t("profile.celebrationPreviewAria")}
              >
                {t("profile.celebrationPreview")}
              </button>
            ) : null}
          </div>
          {postsError ? <p className="account-error" role="alert">{postsError}</p> : null}
          {posts.length === 0 && !postsError ? (
            <p className="account-muted">{t("profile.postsEmpty")}</p>
          ) : (
            <div
              className={`profile-scroll-block ${postsScrollShowFade ? "profile-scroll-block--bottom-fade" : ""}`}
            >
              <div
                ref={postsScrollInnerRef}
                className="profile-scroll-block__inner"
              >
            <ul className="profile-post-list">
              {posts.map((p) => {
                const postExpiryBadge = getPostExpiryBadge(p.createdAt, undefined, p.isPinned === true);
                return (
                <li key={p.id} className="profile-post-card">
                  <div className="profile-post-meta">
                    <time dateTime={createdAtIso(p.createdAt)}>{formatRelativeSmart(p.createdAt, language)}</time>
                    <span className="profile-post-meta__grow" aria-hidden="true" />
                    {postExpiryBadge ? (
                      <span
                        className={`profile-post-expiry profile-post-expiry--${postExpiryBadge.tone}`}
                      >
                        {t(postExpiryBadge.textKey)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="account-btn account-btn--ghost profile-post-delete-btn"
                      onClick={() => deletePostManually(p.id)}
                      aria-label={t("profile.deletePostAria")}
                    >
                      ×
                    </button>
                  </div>
                  <p className="profile-post-snippet">{appearanceTitleFromDescription(p.description, t)}</p>
                  <div className="profile-post-responses-summary">
                    <span>{(postResponsesByPostId[p.id] || []).length} {t("profile.responsesCount")}</span>
                    <button
                      type="button"
                      className="account-btn account-btn--outline profile-post-toggle-btn"
                      onClick={() => setExpandedPostIds((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    >
                      {expandedPostIds[p.id] ? t("profile.hideResponses") : t("profile.showResponses")}
                    </button>
                  </div>
                  {expandedPostIds[p.id] ? (
                    <ul className="profile-post-response-list">
                      {(postResponsesByPostId[p.id] || []).map((resp) => {
                        const isPermanentlyClosed = String(resp.status || "") === "rejected" && Number(resp.attemptCount || 1) >= 2;
                        const responderKey = resp.responderUid || resp.id;
                        const busyKey = `${p.id}:${responderKey}`;
                        return (
                          <li key={responderKey} className="profile-post-response-item">
                            <div className="profile-post-response-answers">
                              <p className="profile-post-response-name">
                                {(resp.responderAnonymousName || t("profile.anonymousPartner"))}
                                {t("profile.responseSuffix")}
                              </p>
                              <p>
                                <strong>{p.questions?.[0] || t("post.q1.label")}：</strong>
                                {Array.isArray(resp.answers) ? resp.answers[0] || "—" : "—"}
                              </p>
                              <p>
                                <strong>{p.questions?.[1] || t("post.q2.label")}：</strong>
                                {Array.isArray(resp.answers) ? resp.answers[1] || "—" : "—"}
                              </p>
                            </div>
                            {isPermanentlyClosed ? (
                              <p className="profile-post-response-closed">{t("profile.permanentlyClosed")}</p>
                            ) : String(resp.status || "") === "accepted" ? (
                              <>
                                <p
                                  className={
                                    deletedChatsById[resp.chatId]
                                      ? "profile-post-response-deleted"
                                      : "profile-post-response-accepted"
                                  }
                                >
                                  {deletedChatsById[resp.chatId]
                                    ? t("profile.responseStatus.chatDeleted")
                                    : t("profile.responseStatus.accepted")}
                                </p>
                              </>
                            ) : (
                              <div className="profile-post-response-actions">
                                <button
                                  type="button"
                                  className="account-btn account-btn--primary profile-response-action-btn"
                                  onClick={() => approveResponse(p.id, responderKey)}
                                  disabled={!!responseActionBusy[busyKey]}
                                >
                                  {t("profile.acceptResponse")}
                                </button>
                                <button
                                  type="button"
                                  className="account-btn account-btn--ghost profile-response-action-btn profile-response-action-btn--reject"
                                  onClick={() => rejectResponse(p.id, responderKey)}
                                  disabled={!!responseActionBusy[busyKey]}
                                >
                                  {t("profile.rejectResponse")}
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
                );
              })}
            </ul>
              </div>
            </div>
          )}
        </section>

        <section className="account-section" aria-labelledby="profile-replies-heading">
          <h2 id="profile-replies-heading" className="account-section-title">
            {t("profile.repliesTitle")}
          </h2>
          {repliedPostsError ? <p className="account-error" role="alert">{repliedPostsError}</p> : null}
          {repliedPostsLoading ? (
            <p className="account-muted">{t("profile.repliesLoading")}</p>
          ) : repliedPosts.length === 0 && !repliedPostsError ? (
            <p className="account-muted">{t("profile.repliesEmpty")}</p>
          ) : (
            <div
              className={`profile-scroll-block ${repliesScrollShowFade ? "profile-scroll-block--bottom-fade" : ""}`}
            >
              <div
                ref={repliesScrollInnerRef}
                className="profile-scroll-block__inner"
              >
            <ul className="profile-post-list">
              {repliedPosts.map((row) => {
                const responseKind = getResponseStatusKind(row.response);
                const kind = responseKind === "accepted" && row.chatDeleted ? "chatDeleted" : responseKind;
                const repliedPostExpiryBadge = getPostExpiryBadge(
                  row.post?.createdAt,
                  undefined,
                  row.post?.isPinned === true,
                );
                return (
                  <li key={row.path} className="profile-post-card">
                    <div className="profile-reply-title-row">
                      <p className="profile-post-snippet profile-reply-title-row__title">
                        {appearanceTitleFromPost(row.post, t, "profile.repliesPostMissing")}
                      </p>
                      {repliedPostExpiryBadge ? (
                        <span
                          className={`chat-list-item__expiry profile-reply-title-row__expiry chat-list-item__expiry--${repliedPostExpiryBadge.tone}`}
                        >
                          {t(repliedPostExpiryBadge.textKey)}
                        </span>
                      ) : null}
                    </div>
                    <div className="profile-reply-status-row">
                      <span className={`profile-response-badge profile-response-badge--${kind}`}>
                        {t(`profile.responseStatus.${kind}`)}
                      </span>
                      <span className="chat-list-item__time profile-reply-status-row__time">
                        {formatRelativeSmart(row.response?.createdAt, language)}
                      </span>
                    </div>
                    {kind === "retry" ? (
                      <Link className="account-link-btn" to="/map">
                        {t("profile.retryOnMap")}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
              </div>
            </div>
          )}
        </section>
      </main>
      {isAvatarModalOpen ? (
        <div className="profile-picture-modal" role="dialog" aria-modal="true" aria-label={t("profile.avatarTitle")}>
          <button
            type="button"
            className="profile-picture-modal__backdrop"
            onClick={() => setIsAvatarModalOpen(false)}
            aria-label={t("profile.avatarCancel")}
          />
          <div className="profile-picture-modal__panel">
            <h2 className="account-section-title">{t("profile.avatarTitle")}</h2>
            <p className="account-section-intro">{t("profile.avatarIntro")}</p>
            <div className="profile-picture-grid" role="list">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  className={`profile-picture-option ${pendingAvatarId === avatar.id ? "is-selected" : ""}`}
                  onClick={() => setPendingAvatarId(avatar.id)}
                  aria-pressed={pendingAvatarId === avatar.id}
                  aria-label={`${t("profile.avatarOption")} ${avatar.id}`}
                >
                  <img
                    src={avatar.src}
                    srcSet={avatar.srcSet}
                    sizes="36px"
                    alt=""
                    width={36}
                    height={36}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
            <div className="profile-picture-modal__actions">
              <button type="button" className="account-btn account-btn--outline" onClick={() => setIsAvatarModalOpen(false)}>
                {t("profile.avatarCancel")}
              </button>
              <button type="button" className="account-btn account-btn--primary" onClick={saveAvatar} disabled={avatarSaving}>
                {avatarSaving ? t("post.saving") : t("profile.avatarSave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <Footer />
    </div>
  );
}

export default Profile;
