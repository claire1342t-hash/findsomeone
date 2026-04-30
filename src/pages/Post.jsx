import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./Post.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const TAIPEI_CENTER = [25.033, 121.5654];

const defaultIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function Post() {
  const { t } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [pin, setPin] = useState(null);
  const [locationDescription, setLocationDescription] = useState("");
  const [appearance, setAppearance] = useState("");
  const [story, setStory] = useState("");
  const [motivation, setMotivation] = useState("know");
  const [customMotivation, setCustomMotivation] = useState("");
  const [question1, setQuestion1] = useState("");
  const [question2, setQuestion2] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const mapMarkerIcon = useMemo(() => defaultIcon, []);

  const handlePick = useCallback((latlng) => {
    setPin(latlng);
    setSubmitSuccess(false);
    setSubmitError("");
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    if (!user) {
      setSubmitError(t("post.needLogin"));
      return;
    }
    if (!pin) {
      setSubmitError(t("post.errorPin"));
      return;
    }
    const trimmedLocationDescription = locationDescription.trim();
    if (!trimmedLocationDescription) {
      setSubmitError(t("post.errorLocationDescription"));
      return;
    }
    const trimmedAppearance = appearance.trim();
    const trimmedStory = story.trim();
    const trimmedCustomMotivation = customMotivation.trim();
    const trimmedQuestion1 = question1.trim();
    const trimmedQuestion2 = question2.trim();
    if (!trimmedAppearance || !trimmedStory || !trimmedQuestion1 || !trimmedQuestion2) {
      setSubmitError(t("post.errorRequiredFields"));
      return;
    }
    if (motivation === "custom" && !trimmedCustomMotivation) {
      setSubmitError(t("post.errorCustomMotivation"));
      return;
    }
    setSubmitBusy(true);
    try {
      const postRef = doc(collection(db, "posts"));
      const claimToken = crypto.randomUUID();
      const authorPublicId = crypto.randomUUID();
      const batch = writeBatch(db);
      batch.set(doc(db, "users", user.uid, "ownedPosts", postRef.id), {
        createdAt: serverTimestamp(),
        authorUid: user.uid,
        claimToken,
      });
      batch.set(postRef, {
        authorPublicId,
        authorUid: user.uid,
        claimToken,
        location: { lat: pin[0], lng: pin[1] },
        locationDescription: trimmedLocationDescription,
        description: { appearance: trimmedAppearance, story: trimmedStory },
        motivation,
        motivationCustom: motivation === "custom" ? trimmedCustomMotivation : "",
        questions: [trimmedQuestion1, trimmedQuestion2],
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      setSubmitSuccess(true);
      setPin(null);
      setLocationDescription("");
      setAppearance("");
      setStory("");
      setMotivation("know");
      setCustomMotivation("");
      setQuestion1("");
      setQuestion2("");
    } catch (e) {
      console.error(e);
      setSubmitError(e.message || String(e));
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <div className="home-page post-page app-shell">
      <SiteHeader />
      <main className="post-main">
        <h1 className="post-page-title">{t("post.title")}</h1>
        {!user ? (
          <p className="post-auth-banner">
            {t("post.bannerGuest")}
            <Link to="/login">{t("post.bannerLogin")}</Link>
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <section className="post-section" aria-labelledby="post-loc-heading">
            <h2 id="post-loc-heading">{t("post.loc.heading")}</h2>
            <p className="post-section-intro">{t("post.loc.intro")}</p>
            <div className="post-map-wrap">
              <MapContainer center={TAIPEI_CENTER} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPick={handlePick} />
                {pin && <Marker position={pin} icon={mapMarkerIcon} />}
              </MapContainer>
            </div>
            <p className="post-coords">
              {pin ? (
                <>
                  {t("post.coords")}：
                  <strong>{pin[0].toFixed(6)}</strong>，<strong>{pin[1].toFixed(6)}</strong>
                </>
              ) : (
                t("post.coords.empty")
              )}
            </p>
            <div className="post-field post-field--location-description">
              <label className="post-label" htmlFor="location-description">
                {t("post.locationDescription.label")}
              </label>
              <input
                id="location-description"
                type="text"
                className="post-input"
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder={t("post.locationDescription.ph")}
                required
              />
            </div>
          </section>

          <section className="post-section" aria-labelledby="post-desc-heading">
            <h2 id="post-desc-heading">{t("post.desc.heading")}</h2>
            <div className="post-field">
              <label className="post-label" htmlFor="appearance">
                {t("post.appearance.label")}
              </label>
              <textarea
                id="appearance"
                className="post-textarea"
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder={t("post.appearance.ph")}
                required
              />
            </div>
            <div className="post-field">
              <label className="post-label" htmlFor="story">
                {t("post.story.label")}
              </label>
              <textarea
                id="story"
                className="post-textarea"
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder={t("post.story.ph")}
                required
              />
            </div>
          </section>

          <section className="post-section" aria-labelledby="post-motivation-heading">
            <h2 id="post-motivation-heading">{t("post.motivation.heading")}</h2>
            <div className="post-radio-grid" role="radiogroup" aria-label={t("post.motivation.heading")}>
              <label className="post-radio-card">
                <input
                  type="radio"
                  name="motivation"
                  value="know"
                  checked={motivation === "know"}
                  onChange={() => setMotivation("know")}
                />
                <span className="post-radio-text">{t("post.motivation.know")}</span>
              </label>
              <label className="post-radio-card">
                <input
                  type="radio"
                  name="motivation"
                  value="thanks"
                  checked={motivation === "thanks"}
                  onChange={() => setMotivation("thanks")}
                />
                <span className="post-radio-text">{t("post.motivation.thanks")}</span>
              </label>
              <label className="post-radio-card">
                <input
                  type="radio"
                  name="motivation"
                  value="noticed"
                  checked={motivation === "noticed"}
                  onChange={() => setMotivation("noticed")}
                />
                <span className="post-radio-text">{t("post.motivation.noticed")}</span>
              </label>
              <label className="post-radio-card">
                <input
                  type="radio"
                  name="motivation"
                  value="custom"
                  checked={motivation === "custom"}
                  onChange={() => setMotivation("custom")}
                />
                <span className="post-radio-text">{t("post.motivation.custom")}</span>
              </label>
            </div>
            {motivation === "custom" ? (
              <div className="post-field post-field--custom-motivation">
                <label className="post-label" htmlFor="custom-motivation">
                  {t("post.motivation.customLabel")}
                </label>
                <input
                  id="custom-motivation"
                  type="text"
                  className="post-input"
                  value={customMotivation}
                  onChange={(e) => setCustomMotivation(e.target.value)}
                  placeholder={t("post.motivation.customPh")}
                  required
                />
              </div>
            ) : null}
          </section>

          <section className="post-section" aria-labelledby="post-verify-heading">
            <h2 id="post-verify-heading">{t("post.verify.heading")}</h2>
            <p className="post-hint">{t("post.verify.hint")}</p>
            <div className="post-field">
              <label className="post-label" htmlFor="q1">
                {t("post.q1.label")}
              </label>
              <input
                id="q1"
                type="text"
                className="post-input"
                value={question1}
                onChange={(e) => setQuestion1(e.target.value)}
                placeholder={t("post.q1.ph")}
                required
              />
            </div>
            <div className="post-field">
              <label className="post-label" htmlFor="q2">
                {t("post.q2.label")}
              </label>
              <input
                id="q2"
                type="text"
                className="post-input"
                value={question2}
                onChange={(e) => setQuestion2(e.target.value)}
                placeholder={t("post.q2.ph")}
                required
              />
            </div>
          </section>

          <div className="post-actions">
            <button type="submit" className="post-submit" disabled={submitBusy}>
              {submitBusy ? t("post.saving") : t("post.submit")}
            </button>
          </div>
          {submitError ? (
            <p className="post-feedback post-feedback--error" role="alert">
              {submitError}
            </p>
          ) : null}
          {submitSuccess ? <p className="post-feedback">{t("post.saveSuccess")}</p> : null}
        </form>
      </main>
      <Footer />
    </div>
  );
}
export default Post;
