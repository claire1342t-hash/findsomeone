import { useEffect, useMemo, useState } from "react";
import { useBottomScrollFade } from "../hooks/useBottomScrollFade.js";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { generateAnonymousName } from "../utils/generateAnonymousName.js";
import { deletePostCascade, isPostExpired } from "../utils/postLifecycle.js";
import { formatRelativeCalendarDay } from "../utils/relativeTime.js";
import { sendEmail } from "../utils/sendEmail.js";
import "./Map.css";

import pingIconSrc from "../assets/illustrations/ping.png";

const TAIPEI_CENTER = [25.033, 121.5654];

function getAppearanceTitle(post, t) {
  const appearance = post.description?.appearance ?? "";
  const firstLine = appearance.split(/\r?\n/)[0].trim();
  return firstLine || t("map.postFallbackAppearance");
}

function formatDate(createdAt, language) {
  if (!createdAt?.toDate) return "—";
  const locale = language === "ja" ? "ja-JP" : language === "en" ? "en-US" : "zh-TW";
  return createdAt.toDate().toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

  const selectedPost = clusterPosts.find((item) => item.id === selectedPostId) ?? null;

  const leftScrollKey = useMemo(
    () => `${clusterPosts.map((p) => p.id).join(",")}-${selectedPostId}`,
    [clusterPosts, selectedPostId],
  );
  const rightScrollKey = useMemo(
    () => `${selectedPostId ?? ""}-${verifyOpen}-${verifySubmitted}-${verifyLocked}`,
    [selectedPostId, verifyOpen, verifySubmitted, verifyLocked],
  );
  const { ref: leftScrollRef, onScroll: onLeftScroll, showFade: leftShowFade } = useBottomScrollFade(leftScrollKey);
  const { ref: rightScrollRef, onScroll: onRightScroll, showFade: rightShowFade } = useBottomScrollFade(rightScrollKey);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const activePosts = [];
      const expiredPostIds = [];
      snap.docs.forEach((docItem) => {
        const data = docItem.data();
        if (isPostExpired(data.createdAt)) {
          expiredPostIds.push(docItem.id);
          return;
        }
        activePosts.push({ id: docItem.id, ...data });
      });
      setPosts(activePosts);
      if (user && expiredPostIds.length > 0) {
        expiredPostIds.forEach((postId) => {
          deletePostCascade(postId, user.uid).catch(() => {
            // ignore permission failures for non-owner users
          });
        });
      }
    });
  }, [user]);

  const isOwnPost = !!user && !!selectedPost && selectedPost.authorUid === user.uid;

  const closePanel = () => {
    setClusterPosts([]);
    setSelectedPostId(null);
    setVerifyOpen(false);
    setAnswer1("");
    setAnswer2("");
    setVerifyBusy(false);
    setVerifyError("");
    setVerifySubmitted(false);
    setVerifyLocked(false);
    setPreviousRejectedOnce(false);
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

  useEffect(() => {
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
  }, [verifyOpen, selectedPost, user]);

  const submitVerification = async () => {
    if (!selectedPost || !user || verifyBusy || verifySubmitted || verifyLocked) return;
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
        console.log("[Map] calling sendEmail after response setDoc", { postId: selectedPost.id });
        const mailResult = await sendEmail({ kind: "mapResponseSubmitted", postId: selectedPost.id });
        console.log("[Map] sendEmail finished", mailResult);
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
            <div className="map-sheet__left" ref={leftScrollRef} onScroll={onLeftScroll}>
              <p className="map-sheet__hint">{clusterPosts.length > 0 ? t("map.sheetHint") : t("map.sheetDefault")}</p>
              {clusterPosts.length === 0 ? (
                <p className="map-sheet__empty">{posts.length === 0 ? t("map.noPosts") : t("map.emptyCluster")}</p>
              ) : (
                <ul className="map-sheet__list">
                  {clusterPosts.map((post) => (
                    <li key={post.id}>
                      <button
                        type="button"
                        className={`map-post-card ${selectedPostId === post.id ? "is-active" : ""}`}
                        onClick={() => {
                          setSelectedPostId(post.id);
                          resetVerificationState();
                        }}
                      >
                        <p className="map-post-card__title">{getAppearanceTitle(post, t)}</p>
                        <p className="map-post-card__meta">
                          <span>{post.locationDescription || t("map.locationFallback")}</span>
                          <span>{formatRelativeCalendarDay(post.createdAt, language)}</span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {selectedPost ? (
            <div
              className={`map-sheet__right-wrap ${rightShowFade ? "map-sheet__right-wrap--bottom-fade" : ""}`}
            >
            <aside className="map-sheet__right" ref={rightScrollRef} onScroll={onRightScroll}>
              <h2 className="map-detail__title">{getAppearanceTitle(selectedPost, t)}</h2>
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
              <button
                type="button"
                className="map-detail__cta"
                onClick={() => setVerifyOpen((prev) => !prev)}
                disabled={isOwnPost}
              >
                {t("map.cta")}
              </button>
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
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default MapPage;
