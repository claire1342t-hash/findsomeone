import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { CustomCursor } from "../components/CustomCursor.jsx";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import defaultAvatar from "../assets/illustrations/profile.png";
import "./Account.css";

function formatCreatedAt(value, locale) {
  if (!value) return "—";
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function createdAtIso(value) {
  if (!value?.toDate) return undefined;
  try {
    return value.toDate().toISOString();
  } catch {
    return undefined;
  }
}

const MOTIVATION_KEYS = { know: "post.motivation.know", thanks: "post.motivation.thanks", noticed: "post.motivation.noticed" };

function Profile() {
  const { t, language } = useLanguage();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [saveError, setSaveError] = useState("");

  const locale = useMemo(() => {
    if (language === "zh") return "zh-TW";
    if (language === "ja") return "ja-JP";
    return "en-US";
  }, [language]);

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
          setPostsError("");
          setPosts(
            rows
              .filter((d) => d.exists())
              .map((d) => {
                const data = d.data();
                const { claimToken: _claim, ...rest } = data;
                return { id: d.id, ...rest };
              }),
          );
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

  const avatarSrc = user?.photoURL || defaultAvatar;
  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "—";
  const email = profile?.email || user?.email || "—";
  const locations = Array.isArray(profile?.subscribedLocations) ? profile.subscribedLocations : [];

  const addLocation = async () => {
    const label = newLocation.trim();
    if (!label || !user) return;
    setSaveError("");
    const next = [...locations, label];
    try {
      await updateDoc(doc(db, "users", user.uid), { subscribedLocations: next });
      setNewLocation("");
    } catch (e) {
      setSaveError(e.message || String(e));
    }
  };

  const removeLocation = async (index) => {
    if (!user) return;
    setSaveError("");
    const next = locations.filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, "users", user.uid), { subscribedLocations: next });
    } catch (e) {
      setSaveError(e.message || String(e));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  if (loading || !user) {
    return (
      <div className="home-page account-page app-shell">
        <SiteHeader />
        <main className="account-main">
          <p className="account-muted">{t("profile.loading")}</p>
        </main>
        <Footer />
        <CustomCursor />
      </div>
    );
  }

  return (
    <div className="home-page account-page app-shell">
      <SiteHeader />
      <main className="account-main">
        <div className="profile-hero">
          <img className="profile-avatar" src={avatarSrc} alt="" width={96} height={96} />
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

        <section className="account-section" aria-labelledby="profile-locations-heading">
          <h2 id="profile-locations-heading" className="account-section-title">
            {t("profile.locationsTitle")}
          </h2>
          <p className="account-section-intro">{t("profile.locationsIntro")}</p>
          {saveError ? <p className="account-error" role="alert">{saveError}</p> : null}
          <div className="profile-location-add">
            <input
              type="text"
              className="account-input"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder={t("profile.locationPlaceholder")}
              aria-label={t("profile.locationPlaceholder")}
            />
            <button type="button" className="account-btn account-btn--primary" onClick={addLocation}>
              {t("profile.addLocation")}
            </button>
          </div>
          {locations.length === 0 ? (
            <p className="account-muted">{t("profile.locationsEmpty")}</p>
          ) : (
            <ul className="profile-location-list">
              {locations.map((loc, i) => (
                <li key={`${loc}-${i}`} className="profile-location-item">
                  <span>{loc}</span>
                  <button type="button" className="account-icon-btn" onClick={() => removeLocation(i)} aria-label={t("profile.removeLocation")}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

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
                    <time dateTime={createdAtIso(p.createdAt)}>{formatCreatedAt(p.createdAt, locale)}</time>
                    <span className="profile-post-motivation">{t(MOTIVATION_KEYS[p.motivation] ?? "post.motivation.know")}</span>
                  </div>
                  <p className="profile-post-snippet">{snippetFromDescription(p.description)}</p>
                  {p.location?.lat != null && p.location?.lng != null ? (
                    <p className="profile-post-coords">
                      {p.location.lat.toFixed(4)}, {p.location.lng.toFixed(4)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
      <CustomCursor />
    </div>
  );
}

function snippetFromDescription(description) {
  if (description == null) return "";
  if (typeof description === "string") return description.slice(0, 160) + (description.length > 160 ? "…" : "");
  const a = description.appearance || "";
  const b = description.story || "";
  const combined = [a, b].filter(Boolean).join(" · ");
  return combined.slice(0, 160) + (combined.length > 160 ? "…" : "");
}

export default Profile;
