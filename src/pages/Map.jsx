import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { CustomCursor } from "../components/CustomCursor.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
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
        iconSize: [34, 34],
        iconAnchor: [17, 33],
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
  const [posts, setPosts] = useState([]);
  const [clusterPosts, setClusterPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState(null);

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
                      onClick={() => setSelectedPostId(post.id)}
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
              <Link className="map-detail__cta" to={`/verify/${selectedPost.id}`}>
                {t("map.cta")}
              </Link>
            </aside>
          ) : null}
        </section>
      </main>
      <CustomCursor />
    </div>
  );
}

export default MapPage;
