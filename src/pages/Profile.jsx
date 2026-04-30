import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import defaultAvatar from "../assets/illustrations/profile.png";
import { AVATAR_OPTIONS, getAvatarById } from "../assets/avatarOptions.js";
import { generateAnonymousName } from "../utils/generateAnonymousName.js";
import { deletePostCascade, isPostExpired } from "../utils/postLifecycle.js";
import "./Account.css";

function formatNotificationRelative(value, language) {
  if (!value?.toDate) return "—";
  const now = Date.now();
  const ts = value.toDate().getTime();
  const diffMs = Math.max(0, now - ts);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return language === "en" ? "Just now" : language === "ja" ? "たった今" : "剛剛";
  if (diffMinutes < 60) {
    if (language === "en") return `${diffMinutes}m ago`;
    if (language === "ja") return `${diffMinutes}分前`;
    return `${diffMinutes}分鐘前`;
  }
  if (diffDays <= 0) return language === "en" ? "Today" : language === "ja" ? "今日" : "今天";
  if (language === "en") return `${diffDays}d ago`;
  if (language === "ja") return `${diffDays}日前`;
  return `${diffDays}天前`;
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

function appearanceTitleFromPost(post, t) {
  if (!post) return t("profile.repliesPostMissing");
  const appearance = post.description?.appearance ?? "";
  const firstLine = appearance.split(/\r?\n/)[0].trim();
  return firstLine || t("map.postFallbackAppearance");
}

function firstLineFromAppearance(description, t) {
  const appearance = description?.appearance ?? "";
  const firstLine = appearance.split(/\r?\n/)[0].trim();
  return firstLine || t("map.postFallbackAppearance");
}

function getMotivationLabel(post, t) {
  if (post?.motivation === "custom") {
    return post?.motivationCustom || t("post.motivation.custom");
  }
  return t(MOTIVATION_KEYS[post?.motivation] ?? "post.motivation.know");
}

function Profile() {
  const { t, language } = useLanguage();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState("");
  const [postResponsesByPostId, setPostResponsesByPostId] = useState({});
  const [expandedPostIds, setExpandedPostIds] = useState({});
  const [responseActionBusy, setResponseActionBusy] = useState({});
  const [deletedChatsById, setDeletedChatsById] = useState({});
  const [repliedPosts, setRepliedPosts] = useState([]);
  const [repliedPostsError, setRepliedPostsError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState(1);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return undefined;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
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
                if (isPostExpired(d.data()?.createdAt)) {
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
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const q = query(collectionGroup(db, "responses"), where("responderUid", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        void (async () => {
          try {
            const enriched = await Promise.all(
              snap.docs.map(async (d) => {
                const postRef = d.ref.parent.parent;
                const postSnap = await getDoc(postRef);
                const responseData = d.data();
                let partnerAnonymousName = "";
                let chatDeleted = false;
                const chatId = typeof responseData.chatId === "string" ? responseData.chatId : "";
                if (chatId) {
                  const chatSnap = await getDoc(doc(db, "chats", chatId));
                  if (chatSnap.exists()) {
                    const chatData = chatSnap.data();
                    partnerAnonymousName =
                      user.uid === chatData.posterUid
                        ? chatData.responderAnonymousName || chatData.responderName || ""
                        : chatData.posterAnonymousName || chatData.posterName || "";
                  } else {
                    chatDeleted = true;
                  }
                }
                return {
                  path: d.ref.path,
                  response: responseData,
                  post: postSnap.exists() ? { id: postSnap.id, ...postSnap.data() } : null,
                  partnerAnonymousName,
                  chatDeleted,
                };
              }),
            );
            if (cancelled) return;
            enriched.sort((a, b) => {
              const ta = a.response?.createdAt?.toDate?.()?.getTime?.() ?? 0;
              const tb = b.response?.createdAt?.toDate?.()?.getTime?.() ?? 0;
              return tb - ta;
            });
            setRepliedPosts(enriched);
            setRepliedPostsError("");
          } catch {
            if (!cancelled) {
              setRepliedPosts([]);
              setRepliedPostsError("");
            }
          }
        })();
      },
      () => {
        if (!cancelled) {
          setRepliedPosts([]);
          setRepliedPostsError("");
        }
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  useEffect(() => {
    if (!posts.length) return undefined;
    const unsubscribers = posts.map((post) =>
      onSnapshot(collection(db, "posts", post.id, "responses"), (snap) => {
        setPostResponsesByPostId((prev) => ({
          ...prev,
          [post.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        }));
      }),
    );
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [posts]);

  useEffect(() => {
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
  }, [postResponsesByPostId]);

  const selectedAvatarId = Number(profile?.avatarId) >= 1 && Number(profile?.avatarId) <= 12 ? Number(profile?.avatarId) : 1;
  const avatarSrc = user ? getAvatarById(selectedAvatarId) : user?.photoURL || defaultAvatar;
  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "—";
  const email = profile?.email || user?.email || "—";

  const saveAvatar = async () => {
    if (!user || avatarSaving) return;
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

  const approveResponse = async (postId, responseUserId) => {
    if (!user) return;
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
      navigate(`/chat/${chatRef.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setResponseActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const rejectResponse = async (postId, responseUserId) => {
    if (!user) return;
    const confirmed = window.confirm(t("profile.confirmReject"));
    if (!confirmed) return;
    const busyKey = `${postId}:${responseUserId}`;
    setResponseActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    try {
      await updateDoc(doc(db, "posts", postId, "responses", responseUserId), {
        status: "rejected",
        attemptCount: increment(1),
        reviewedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setResponseActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const deletePostManually = async (postId) => {
    const ok = window.confirm(t("profile.confirmDeletePost"));
    if (!ok || !user) return;
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
            <img className="profile-picture" src={avatarSrc} alt="" width={96} height={96} />
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
        {saveError ? <p className="account-error" role="alert">{saveError}</p> : null}

        <section className="account-section" aria-labelledby="profile-posts-heading">
          <h2 id="profile-posts-heading" className="account-section-title">
            {t("profile.postsTitle")}
          </h2>
          {postsError ? <p className="account-error" role="alert">{postsError}</p> : null}
          {posts.length === 0 && !postsError ? (
            <p className="account-muted">{t("profile.postsEmpty")}</p>
          ) : (
            <ul className="profile-post-list">
              {posts.map((p) => (
                <li key={p.id} className="profile-post-card">
                  <div className="profile-post-meta">
                    <time dateTime={createdAtIso(p.createdAt)}>{formatNotificationRelative(p.createdAt, language)}</time>
                    <button
                      type="button"
                      className="account-btn account-btn--ghost profile-post-delete-btn"
                      onClick={() => deletePostManually(p.id)}
                      aria-label={t("profile.deletePostAria")}
                    >
                      ×
                    </button>
                  </div>
                  <p className="profile-post-snippet">{firstLineFromAppearance(p.description, t)}</p>
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
                        const busyKey = `${p.id}:${resp.id}`;
                        return (
                          <li key={resp.id} className="profile-post-response-item">
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
                                  onClick={() => approveResponse(p.id, resp.id)}
                                  disabled={!!responseActionBusy[busyKey]}
                                >
                                  {t("profile.acceptResponse")}
                                </button>
                                <button
                                  type="button"
                                  className="account-btn account-btn--ghost profile-response-action-btn profile-response-action-btn--reject"
                                  onClick={() => rejectResponse(p.id, resp.id)}
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
              ))}
            </ul>
          )}
        </section>

        <section className="account-section" aria-labelledby="profile-replies-heading">
          <h2 id="profile-replies-heading" className="account-section-title">
            {t("profile.repliesTitle")}
          </h2>
          {repliedPostsError ? <p className="account-error" role="alert">{repliedPostsError}</p> : null}
          {repliedPosts.length === 0 && !repliedPostsError ? (
            <p className="account-muted">{t("profile.repliesEmpty")}</p>
          ) : (
            <ul className="profile-post-list">
              {repliedPosts.map((row) => {
                const responseKind = getResponseStatusKind(row.response);
                const kind = responseKind === "accepted" && row.chatDeleted ? "chatDeleted" : responseKind;
                return (
                  <li key={row.path} className="profile-post-card">
                    <div className="profile-response-meta">
                      <div className="profile-response-meta-left">
                        <span className={`profile-response-badge profile-response-badge--${kind}`}>{t(`profile.responseStatus.${kind}`)}</span>
                      </div>
                      <span className="profile-response-time">{formatNotificationRelative(row.response?.createdAt, language)}</span>
                    </div>
                    <p className="profile-post-snippet">{appearanceTitleFromPost(row.post, t)}</p>
                    {kind === "retry" ? (
                      <Link className="account-link-btn" to="/map">
                        {t("profile.retryOnMap")}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
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
                  <img src={avatar.src} alt="" width={36} height={36} />
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
