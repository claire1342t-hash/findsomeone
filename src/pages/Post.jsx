import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CustomCursor } from "../components/CustomCursor.jsx";
import "./Post.css";
import profileImg from "../assets/illustrations/profile.png";

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
  const navItems = ["home", "about", "map", "chat"];
  const [pin, setPin] = useState(null);
  const [appearance, setAppearance] = useState("");
  const [story, setStory] = useState("");
  const [motivation, setMotivation] = useState("know");
  const [question1, setQuestion1] = useState("");
  const [question2, setQuestion2] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const markerIcon = useMemo(() => defaultIcon, []);

  const handlePick = useCallback((latlng) => {
    setPin(latlng);
    setSubmitted(false);
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="home-page post-page">
      <header className="top-nav">
        <Link className="brand" to="/">
          Findsomeone
        </Link>
        <nav className="top-nav-center" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link key={item} className="top-nav-link" to={item === "home" ? "/" : `/${item}`}>
              {item}
            </Link>
          ))}
        </nav>
        <Link className="avatar-button" to="/profile" aria-label="Login or profile">
          <img src={profileImg} alt="profile" />
        </Link>
      </header>

      <main className="post-main">
        <h1 className="post-page-title">發布尋找</h1>

        <form onSubmit={handleSubmit}>
          <section className="post-section" aria-labelledby="post-loc-heading">
            <h2 id="post-loc-heading">選擇地點</h2>
            <p className="post-section-intro">在地圖上點一下，標記你看到對方的位置。</p>
            <div className="post-map-wrap">
              <MapContainer center={TAIPEI_CENTER} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPick={handlePick} />
                {pin && <Marker position={pin} icon={markerIcon} />}
              </MapContainer>
            </div>
            <p className="post-coords">
              {pin ? (
                <>
                  已選座標：<strong>{pin[0].toFixed(6)}</strong>，<strong>{pin[1].toFixed(6)}</strong>
                </>
              ) : (
                <>尚未選擇地點，請點擊地圖放下圖釘。</>
              )}
            </p>
          </section>

          <section className="post-section" aria-labelledby="post-desc-heading">
            <h2 id="post-desc-heading">描述這個人</h2>
            <div className="post-field">
              <label className="post-label" htmlFor="appearance">
                你看到的他/她長什麼樣子？
              </label>
              <textarea
                id="appearance"
                className="post-textarea"
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder="例如：穿白色上衣、戴黑框眼鏡、拿著咖啡杯..."
              />
            </div>
            <div className="post-field">
              <label className="post-label" htmlFor="story">
                當時發生了什麼？
              </label>
              <textarea
                id="story"
                className="post-textarea"
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="例如：我們在捷運上對到眼，你在忠孝復興站下車..."
              />
            </div>
          </section>

          <section className="post-section" aria-labelledby="post-motivation-heading">
            <h2 id="post-motivation-heading">你的動機</h2>
            <div className="post-radio-grid" role="radiogroup" aria-label="發布動機">
              <label className="post-radio-card">
                <input
                  type="radio"
                  name="motivation"
                  value="know"
                  checked={motivation === "know"}
                  onChange={() => setMotivation("know")}
                />
                <span className="post-radio-text">我想認識你</span>
              </label>
              <label className="post-radio-card">
                <input
                  type="radio"
                  name="motivation"
                  value="thanks"
                  checked={motivation === "thanks"}
                  onChange={() => setMotivation("thanks")}
                />
                <span className="post-radio-text">我想說謝謝</span>
              </label>
              <label className="post-radio-card">
                <input
                  type="radio"
                  name="motivation"
                  value="noticed"
                  checked={motivation === "noticed"}
                  onChange={() => setMotivation("noticed")}
                />
                <span className="post-radio-text">我注意到你了</span>
              </label>
            </div>
          </section>

          <section className="post-section" aria-labelledby="post-verify-heading">
            <h2 id="post-verify-heading">驗證問題</h2>
            <div className="post-field">
              <label className="post-label" htmlFor="q1">
                問題 1
              </label>
              <input
                id="q1"
                type="text"
                className="post-input"
                value={question1}
                onChange={(e) => setQuestion1(e.target.value)}
                placeholder="例如：你當時拿的是什麼顏色的袋子？"
              />
            </div>
            <div className="post-field">
              <label className="post-label" htmlFor="q2">
                問題 2
              </label>
              <input
                id="q2"
                type="text"
                className="post-input"
                value={question2}
                onChange={(e) => setQuestion2(e.target.value)}
                placeholder="只有對方可能知道的細節"
              />
            </div>
            <p className="post-hint">
              設計只有對方才知道答案的問題，例如：「你當時拿的是什麼顏色的袋子？」
            </p>
          </section>

          <div className="post-actions">
            <button type="submit" className="post-submit">
              發布尋找
            </button>
          </div>
          {submitted && <p className="post-feedback">已送出（示意）。之後可接 API 儲存貼文。</p>}
        </form>
      </main>

      <CustomCursor />
    </div>
  );
}

export default Post;
