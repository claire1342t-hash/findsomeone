import { useEffect, useMemo, useState } from "react";
import { useBottomScrollFade } from "../hooks/useBottomScrollFade.js";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useDb } from "../hooks/useDb.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { generateAnonymousName } from "../utils/generateAnonymousName.js";
import { deletePostCascade, getPostExpiryBadge, isPostExpired } from "../utils/postLifecycle.js";
import { formatRelativeCalendarDay } from "../utils/relativeTime.js";
import { sendEmail } from "../utils/sendEmail.js";
import { appearanceTitleFromDescription } from "../utils/postAppearance.js";
import "./Map.css";

import pingIconSrc from "../assets/illustrations/ping.webp";

const TAIPEI_CENTER = [25.033, 121.5654];

function formatDate(createdAt, language) {
  if (!createdAt?.toDate) return "—";
  const date = createdAt.toDate();
  const locale = language === "ja" ? "ja-JP" : language === "en" ? "en-US" : "zh-TW";
  const dateText = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
  const hour = date.getHours();
  const dayPeriod =
    language === "ja"
      ? hour < 12
        ? "午前"
        : "午後"
      : language === "en"
        ? hour < 12
          ? "AM"
          : "PM"
        : hour < 12
          ? "上午"
          : "下午";
  return `${dateText} ${dayPeriod}`;
}

function createdAtMs(createdAt) {
  return createdAt?.toDate ? createdAt.toDate().getTime() : 0;
}

function getMotivationText(post, t) {
  if (post?.motivation === "custom") {
    return post?.motivationCustom || t("post.motivation.custom");
  }
  return t(`post.motivation.${post?.motivation || "know"}`);
}

function ClusterLayer({ posts, onClusterPick }) {
  const map = useMap();

  const markerIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: pingIconSrc,
        iconRetinaUrl: pingIconSrc,
        iconSize: [42, 42],
        iconAnchor: [21, 40],
        popupAnchor: [0, -30],
      }),
    [],
  );

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction(current) {
        const count = current.getChildCount();
        const size = count < 10 ? 44 : count < 25 ? 54 : 64;
        return L.divIcon({
          html: `<span>${count}</span>`,
          className: "map-cluster-badge",
          iconSize: [size, size],
        });
      },
    });

    for (const post of posts) {
      const lat = post.location?.lat;
      const lng = post.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") continue;

      const marker = L.marker([lat, lng], { icon: markerIcon });
      marker.options.postData = post;
      marker.on("click", () => onClusterPick([post]));
      cluster.addLayer(marker);
    }

    cluster.on("clusterclick", (event) => {
      const items = event.layer
        .getAllChildMarkers()
        .map((marker) => marker.options.postData)
        .filter(Boolean);
      onClusterPick(items);
    });

    map.addLayer(cluster);
    return () => {
      cluster.off();
      map.removeLayer(cluster);
    };
  }, [map, markerIcon, onClusterPick, posts]);

  return null;
}

function MapPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const db = useDb();
  const [posts, setPosts] = useState([]);
  const [clusterPosts, setClusterPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySubmitted, setVerifySubmitted] = useState(false);
  const [verifyLocked, setVerifyLocked] = useState(false);
  const [previousRejectedOnce, setPreviousRejectedOnce] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("不當內容");
  const [reportOtherText, setReportOtherText] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSubmittedForPost, setReportSubmittedForPost] = useState(false);

  const sortedClusterPosts = useMemo(
    () => [...clusterPosts].sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt)),
    [clusterPosts],
  );

  const selectedPost = sortedClusterPosts.find((item) => item.id === selectedPostId) ?? null;
  const selectedPostExpiryBadge = useMemo(
    () => (selectedPost ? getPostExpiryBadge(selectedPost.createdAt, new Date(), selectedPost.isPinned === true) : null),
    [selectedPost],
  );

  const leftScrollKey = useMemo(
    () => `${sortedClusterPosts.map((p) => p.id).join(",")}-${selectedPostId}`,
    [sortedClusterPosts, selectedPostId],
  );
  const rightScrollKey = useMemo(
    () => `${selectedPostId ?? ""}-${verifyOpen}-${verifySubmitted}-${verifyLocked}`,
    [selectedPostId, verifyOpen, verifySubmitted, verifyLocked],
  );
  const { ref: leftScrollRef, showFade: leftShowFade } = useBottomScrollFade(leftScrollKey);
  const { ref: rightScrollRef, showFade: rightShowFade } = useBottomScrollFade(rightScrollKey);

  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const activePosts = [];
      snap.docs.forEach((docItem) => {
        const data = docItem.data();
        if (isPostExpired(data.createdAt, data.isPinned === true)) {
          if (user?.uid && data.authorUid === user.uid) {
            deletePostCascade(docItem.id, user.uid).catch(() => {});
          }
          return;
        }
        activePosts.push({ id: docItem.id, ...data });
      });
      setPosts(activePosts);
    });
  }, [user, db]);

  const isOwnPost = !!user && !!selectedPost && selectedPost.authorUid === user.uid;

  const resetReportState = () => {
    setReportOpen(false);
    setReportReason("不當內容");
    setReportOtherText("");
    setReportBusy(false);
    setReportError("");
    setReportSubmittedForPost(false);
  };

  const resetVerificationState = () => {
    setVerifyOpen(false);
    setAnswer1("");
    setAnswer2("");
    setVerifyBusy(false);
    setVerifyError("");
    setVerifySubmitted(false);
    setVerifyLocked(false);
    setPreviousRejectedOnce(false);
  };

  const closePanel = () => {
    setClusterPosts([]);
    setSelectedPostId(null);
    resetVerificationState();
    resetReportState();
  };

  const submitPostReport = async () => {
    if (!db || !selectedPost) return;
    if (!user) {
      setReportError(t("map.verifyLoginRequired"));
      return;
    }
    setReportBusy(true);
    setReportError("");
    const trimmedOther = reportOtherText.trim();
    if (reportReason === "其他" && !trimmedOther) {
      setReportBusy(false);
      setReportError("請填寫其他原因內容。");
      return;
    }
    try {
      await addDoc(collection(db, "reports"), {
        type: "post",
        targetId: selectedPost.id,
        reportedBy: user.uid,
        reason: reportReason,
        reasonDetail: reportReason === "其他" ? trimmedOther : "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "pending",
      });
      try {
        await sendEmail({ kind: "reportSubmitted", reportType: "post", targetId: selectedPost.id });
      } catch (mailErr) {
        console.error("[Map] report admin notify email failed", mailErr);
      }
      setReportSubmittedForPost(true);
      setReportError("");
      setReportOtherText("");
    } catch (err) {
      console.error(err);
      setReportError(err.message || String(err));
    } finally {
      setReportBusy(false);
    }
  };

  const openReportModal = async () => {
    if (!db || !selectedPost) return;
    setReportOpen(true);
    setReportError("");
    setReportReason("不當內容");
    setReportOtherText("");
    if (!user) {
      setReportSubmittedForPost(false);
      return;
    }
    try {
      const q = query(
        collection(db, "reports"),
        where("type", "==", "post"),
        where("targetId", "==", selectedPost.id),
        where("reportedBy", "==", user.uid),
      );
      const snap = await getDocs(q);
      setReportSubmittedForPost(!snap.empty);
    } catch (err) {
      console.error(err);
      setReportSubmittedForPost(false);
    }
  };

  useEffect(() => {
    if (!db) return undefined;
    let active = true;
    async function inspectExistingResponse() {
      if (!verifyOpen || !selectedPost || !user) return;
      try {
        const responseRef = doc(db, "posts", selectedPost.id, "responses", user.uid);
        const snap = await getDoc(responseRef);
        if (!active) return;
        if (!snap.exists()) {
          setVerifySubmitted(false);
          setVerifyLocked(false);
          setPreviousRejectedOnce(false);
          return;
        }
        const data = snap.data();
        const status = String(data?.status || "");
        const attemptCount = Number(data?.attemptCount || 1);
        if (status === "rejected" && attemptCount >= 2) {
          if (!active) return;
          setVerifyLocked(true);
          return;
        }
        if (status === "rejected" && attemptCount === 1) {
          if (!active) return;
          setVerifySubmitted(false);
          setPreviousRejectedOnce(true);
          return;
        }
        if (!active) return;
        // "已回覆" only when current user has their own response doc under this post
        setVerifySubmitted(snap.exists());
      } catch (err) {
        console.error(err);
      }
    }
    inspectExistingResponse();
    return () => {
      active = false;
    };
  }, [verifyOpen, selectedPost, user, db]);

  const submitVerification = async () => {
    if (!db || !selectedPost || !user || verifyBusy || verifySubmitted || verifyLocked) return;
    if (isOwnPost) {
      setVerifyError(t("map.verifyOwnPost"));
      return;
    }
    const trimmed1 = answer1.trim();
    const trimmed2 = answer2.trim();
    if (!trimmed1 || !trimmed2) {
      setVerifyError(t("map.verifyAnswerRequired"));
      return;
    }
    setVerifyBusy(true);
    setVerifyError("");
    try {
      const responseRef = doc(db, "posts", selectedPost.id, "responses", user.uid);
      const existingSnap = await getDoc(responseRef);
      const existing = existingSnap.exists() ? existingSnap.data() : null;
      const status = String(existing?.status || "");
      const attemptCount = Number(existing?.attemptCount || 1);
      const responderAnonymousName = existing?.responderAnonymousName || generateAnonymousName(language);

      if (status === "rejected" && attemptCount >= 2) {
        setVerifyLocked(true);
        setVerifyBusy(false);
        return;
      }

      const nextAttemptCount = status === "rejected" && attemptCount === 1 ? 2 : 1;
      await setDoc(
        responseRef,
        {
          responderUid: user.uid,
          responderAnonymousName,
          answers: [trimmed1, trimmed2],
          createdAt: serverTimestamp(),
          status: "pending",
          attemptCount: nextAttemptCount,
        },
        { merge: true },
      );

      try {
        await sendEmail({ kind: "mapResponseSubmitted", postId: selectedPost.id });
      } catch (mailErr) {
        console.error("[Map] sendEmail mapResponseSubmitted failed", mailErr);
      }

      setVerifySubmitted(true);
      setPreviousRejectedOnce(false);
    } catch (err) {
      console.error(err);
      setVerifyError(err.message || String(err));
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <div className="map-page">
      <SiteHeader />
      <main className="map-page__main">
        <MapContainer center={TAIPEI_CENTER} zoom={13} scrollWheelZoom className="map-canvas">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClusterLayer
            posts={posts}
            onClusterPick={(items) => {
              setClusterPosts(items);
              setSelectedPostId(null);
              resetVerificationState();
            }}
          />
        </MapContainer>

        <section
          className={`map-sheet ${clusterPosts.length > 0 ? "is-open" : ""} ${selectedPost ? "is-split" : ""}`}
          aria-label={t("map.sheetTitle")}
        >
          <button type="button" className="map-sheet__close" onClick={closePanel} aria-label={t("map.close")}>
            ×
          </button>
          <div
            className={`map-sheet__left-wrap ${leftShowFade ? "map-sheet__left-wrap--bottom-fade" : ""}`}
          >
            <div className="map-sheet__left" ref={leftScrollRef}>
              <p className="map-sheet__hint">{sortedClusterPosts.length > 0 ? t("map.sheetHint") : t("map.sheetDefault")}</p>
              {sortedClusterPosts.length === 0 ? (
                <p className="map-sheet__empty">{posts.length === 0 ? t("map.noPosts") : t("map.emptyCluster")}</p>
              ) : (
                <ul className="map-sheet__list">
                  {sortedClusterPosts.map((post) => {
                    const postExpiryBadge = getPostExpiryBadge(post.createdAt, new Date(), post.isPinned === true);
                    return (
                    <li key={post.id}>
                      <button
                        type="button"
                        className={`map-post-card ${selectedPostId === post.id ? "is-active" : ""}`}
                        onClick={() => {
                          setSelectedPostId(post.id);
                          resetVerificationState();
                        }}
                      >
                        <div className="map-post-card__head">
                          <p className="map-post-card__title">{appearanceTitleFromDescription(post.description, t)}</p>
                          {postExpiryBadge ? (
                            <span
                              className={`map-post-card__expiry map-post-card__expiry--${postExpiryBadge.tone}`}
                            >
                              {t(postExpiryBadge.textKey)}
                            </span>
                          ) : null}
                        </div>
                        <p className="map-post-card__meta">
                          <span>{post.locationDescription || t("map.locationFallback")}</span>
                          <span>{formatRelativeCalendarDay(post.createdAt, language)}</span>
                        </p>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {selectedPost ? (
            <div
              className={`map-sheet__right-wrap ${rightShowFade ? "map-sheet__right-wrap--bottom-fade" : ""}`}
            >
            <aside className="map-sheet__right" ref={rightScrollRef}>
              <h2 className="map-detail__title">
                <span className="map-detail__title-text">{appearanceTitleFromDescription(selectedPost.description, t)}</span>
                {selectedPostExpiryBadge ? (
                  <span
                    className={`map-detail__title-expiry map-post-card__expiry--${selectedPostExpiryBadge.tone}`}
                  >
                    {t(selectedPostExpiryBadge.textKey)}
                  </span>
                ) : null}
              </h2>
              <div className="map-detail__title-divider" aria-hidden="true" />
              <div className="map-detail__section map-detail__section--plain">
                <p className="map-detail__story-label">{t("map.storyLabel")}</p>
                <p className="map-detail__text">{selectedPost.description?.story || t("map.postFallbackStory")}</p>
              </div>
              <div className="map-detail__short-divider" aria-hidden="true" />
              <div className="map-detail__section map-detail__section--plain">
                <p className="map-detail__inline-row">
                  <strong>{t("map.motivationLabel")}：</strong>
                  <span>{getMotivationText(selectedPost, t)}</span>
                </p>
              </div>
              <div className="map-detail__short-divider" aria-hidden="true" />
              <div className="map-detail__section map-detail__section--plain">
                <p className="map-detail__sub">
                  <strong>{t("map.locationLabel")}：</strong>
                  {selectedPost.locationDescription || t("map.locationFallback")}
                </p>
                <p className="map-detail__sub">
                  <strong>{t("map.dateLabel")}：</strong>
                  {formatDate(selectedPost.createdAt, language)}
                </p>
              </div>
              <div className="map-detail__cta-row">
                <button
                  type="button"
                  className="map-detail__cta"
                  onClick={() => setVerifyOpen((prev) => !prev)}
                  disabled={isOwnPost}
                >
                  {t("map.cta")}
                </button>
                <button
                  type="button"
                  className="map-detail__report-trigger"
                  onClick={openReportModal}
                  aria-label="檢舉貼文"
                >
                  !
                </button>
              </div>
              <section className={`map-verify ${verifyOpen ? "is-open" : ""}`} aria-hidden={!verifyOpen}>
                {verifyOpen ? (
                  verifyLocked ? (
                    <p className="map-verify__message map-verify__message--error">{t("map.verifyLocked")}</p>
                  ) : isOwnPost ? (
                    <p className="map-verify__message map-verify__message--error">{t("map.verifyOwnPost")}</p>
                  ) : !user ? (
                    <p className="map-verify__message">{t("map.verifyLoginRequired")}</p>
                  ) : verifySubmitted ? (
                    <p className="map-verify__message map-verify__message--ok">{t("map.verifySubmitted")}</p>
                  ) : (
                    <>
                      <p className="map-detail__verify-hint">{t("map.verifyHintShort")}</p>
                      {previousRejectedOnce ? (
                        <p className="map-verify__message">{t("map.verifyRetryHint")}</p>
                      ) : null}
                      <label className="map-verify__label">
                        {selectedPost.questions?.[0] || t("post.q1.label")}
                        <input
                          type="text"
                          className="map-verify__input"
                          value={answer1}
                          onChange={(e) => setAnswer1(e.target.value)}
                        />
                      </label>
                      <label className="map-verify__label">
                        {selectedPost.questions?.[1] || t("post.q2.label")}
                        <input
                          type="text"
                          className="map-verify__input"
                          value={answer2}
                          onChange={(e) => setAnswer2(e.target.value)}
                        />
                      </label>
                      {verifyError ? <p className="map-verify__message map-verify__message--error">{verifyError}</p> : null}
                      <button type="button" className="map-verify__submit" disabled={verifyBusy} onClick={submitVerification}>
                        {verifyBusy ? t("post.saving") : t("map.verifySubmit")}
                      </button>
                    </>
                  )
                ) : null}
              </section>
            </aside>
            {reportOpen ? (
              <div className="report-modal-backdrop" role="dialog" aria-modal="true" aria-label="檢舉貼文">
                <div className="report-modal">
                  <h3>檢舉貼文</h3>
                  {reportSubmittedForPost ? (
                    <>
                      <p className="report-modal__ok">您的檢舉已送出，我們會盡快處理。</p>
                      <div className="report-modal__actions">
                        <button type="button" className="report-modal__btn report-modal__btn--primary" onClick={() => setReportOpen(false)}>
                          確定
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="report-modal__label">
                        原因
                        <select
                          className="report-modal__select"
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                        >
                          <option value="不當內容">不當內容</option>
                          <option value="騷擾">騷擾</option>
                          <option value="垃圾訊息">垃圾訊息</option>
                          <option value="其他">其他</option>
                        </select>
                      </label>
                      {reportReason === "其他" ? (
                        <label className="report-modal__label">
                          其他內容
                          <textarea
                            className="report-modal__textarea"
                            value={reportOtherText}
                            onChange={(e) => setReportOtherText(e.target.value)}
                            placeholder="請輸入補充內容"
                          />
                        </label>
                      ) : null}
                      {reportError ? <p className="report-modal__error">{reportError}</p> : null}
                      <div className="report-modal__actions">
                        <button type="button" className="report-modal__btn report-modal__btn--ghost" onClick={() => setReportOpen(false)}>
                          取消
                        </button>
                        <button type="button" className="report-modal__btn report-modal__btn--primary" disabled={reportBusy} onClick={submitPostReport}>
                          {reportBusy ? t("post.saving") : "送出檢舉"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default MapPage;
