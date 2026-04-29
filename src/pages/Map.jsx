import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./Map.css";

import pingIconSrc from "../assets/illustrations/ping.png";

const TAIPEI_CENTER = [25.033, 121.5654];

function getAppearanceTitle(post, t) {
  const appearance = post.description?.appearance ?? "";
  const firstLine = appearance.split(/\r?\n/)[0].trim();
  return firstLine || t("map.postFallbackAppearance");
}

function getStoryText(post, t) {
  const story = post.description?.story ?? "";
  return story.trim() || t("map.postFallbackStory");
}

function formatRelativeTime(createdAt, language) {
  if (!createdAt?.toDate) return "—";
  const now = Date.now();
  const target = createdAt.toDate().getTime();
  const diffDays = Math.floor((now - target) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    if (language === "en") return "Today";
    if (language === "ja") return "今日";
    return "今天";
  }
  if (language === "en") return `${diffDays}d ago`;
  if (language === "ja") return `${diffDays}日前`;
  return `${diffDays}天前`;
}

function formatDate(createdAt, language) {
  if (!createdAt?.toDate) return "—";
  const locale = language === "ja" ? "ja-JP" : language === "en" ? "en-US" : "zh-TW";
  return createdAt.toDate().toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
    });
  }, []);

  const selectedPost = clusterPosts.find((item) => item.id === selectedPostId) ?? null;

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
    async function inspectExistingResponse() {
      if (!verifyOpen || !selectedPost || !user) return;
      try {
        const responseRef = doc(db, "posts", selectedPost.id, "responses", user.uid);
        const snap = await getDoc(responseRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const status = String(data?.status || "");
        const attemptCount = Number(data?.attemptCount || 1);
        if (status === "rejected" && attemptCount >= 2) {
          setVerifyLocked(true);
          return;
        }
        if (status === "rejected" && attemptCount === 1) {
          setPreviousRejectedOnce(true);
          return;
        }
        setVerifySubmitted(true);
      } catch (err) {
        console.error(err);
      }
    }
    inspectExistingResponse();
  }, [verifyOpen, selectedPost, user]);

  const resolvePosterUid = async (post) => {
    if (typeof post?.authorUid === "string" && post.authorUid) return post.authorUid;
    if (!post?.claimToken) return null;
    const q = query(collectionGroup(db, "ownedPosts"), where("claimToken", "==", post.claimToken), limit(1));
    const snap = await getDocs(q);
    const row = snap.docs[0];
    if (!row) return null;
    const fromData = row.data()?.authorUid;
    if (typeof fromData === "string" && fromData) return fromData;
    return row.ref.parent.parent?.id ?? null;
  };

  const submitVerification = async () => {
    if (!selectedPost || !user || verifyBusy || verifySubmitted || verifyLocked) return;
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

      if (status === "rejected" && attemptCount >= 2) {
        setVerifyLocked(true);
        setVerifyBusy(false);
        return;
      }

      const nextAttemptCount = status === "rejected" && attemptCount === 1 ? 2 : 1;
      await setDoc(
        responseRef,
        {
          answers: [trimmed1, trimmed2],
          createdAt: serverTimestamp(),
          status: "pending",
          attemptCount: nextAttemptCount,
        },
        { merge: true },
      );

      const posterUid = await resolvePosterUid(selectedPost);
      if (posterUid) {
        const notificationRef = doc(collection(db, "notifications", posterUid, "items"));
        await setDoc(notificationRef, {
          type: "new_response",
          postId: selectedPost.id,
          createdAt: serverTimestamp(),
          read: false,
          message: t("map.verifyPosterNotification"),
        });
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
          <div className="map-sheet__left">
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
                      <p className="map-post-card__story">{getStoryText(post, t)}</p>
                      <p className="map-post-card__meta">
                        <span>{formatRelativeTime(post.createdAt, language)}</span>
                        <span>{post.locationDescription || t("map.locationFallback")}</span>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedPost ? (
            <aside className="map-sheet__right">
              <h2 className="map-detail__title">{getAppearanceTitle(selectedPost, t)}</h2>
              <p className="map-detail__text">{selectedPost.description?.appearance || t("map.postFallbackAppearance")}</p>
              <p className="map-detail__text">{selectedPost.description?.story || t("map.postFallbackStory")}</p>
              <div className="map-detail__tags">
                <span className="map-detail__tag">{t(`post.motivation.${selectedPost.motivation}`)}</span>
              </div>
              <p className="map-detail__sub">
                <strong>{t("map.locationLabel")}：</strong>
                {selectedPost.locationDescription || t("map.locationFallback")}
              </p>
              <p className="map-detail__sub">
                <strong>{t("map.dateLabel")}：</strong>
                {formatDate(selectedPost.createdAt, language)}
              </p>
              <button type="button" className="map-detail__cta" onClick={() => setVerifyOpen((prev) => !prev)}>
                {t("map.cta")}
              </button>
              <section className={`map-verify ${verifyOpen ? "is-open" : ""}`} aria-hidden={!verifyOpen}>
                {verifyOpen ? (
                  verifyLocked ? (
                    <p className="map-verify__message map-verify__message--error">{t("map.verifyLocked")}</p>
                  ) : !user ? (
                    <p className="map-verify__message">{t("map.verifyLoginRequired")}</p>
                  ) : verifySubmitted ? (
                    <p className="map-verify__message map-verify__message--ok">{t("map.verifySubmitted")}</p>
                  ) : (
                    <>
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
                          placeholder={t("post.q1.ph")}
                        />
                      </label>
                      <label className="map-verify__label">
                        {selectedPost.questions?.[1] || t("post.q2.label")}
                        <input
                          type="text"
                          className="map-verify__input"
                          value={answer2}
                          onChange={(e) => setAnswer2(e.target.value)}
                          placeholder={t("post.q2.ph")}
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
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default MapPage;
