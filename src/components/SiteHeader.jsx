import { Link } from "react-router-dom";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import profileImg from "../assets/illustrations/profile.png";
import { SUPPORTED_LANGUAGES, useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { db } from "../firebase.js";
import { getAvatarById } from "../assets/avatarOptions.js";
import { useEffect, useState } from "react";

const NAV_KEYS = [
  { to: "/", key: "nav.home" },
  { to: "/about", key: "nav.about" },
  { to: "/map", key: "nav.map" },
  { to: "/chat", key: "nav.chat" },
];

export function SiteHeader() {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const [avatarId, setAvatarId] = useState(1);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const profileHref = user ? "/profile" : "/login";
  const profileAria = user ? t("meta.profileAriaUser") : t("meta.profileAriaGuest");
  const avatarSrc = user ? getAvatarById(avatarId) : profileImg;

  useEffect(() => {
    if (!user) return undefined;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, (snap) => {
      const id = Number(snap.data()?.avatarId);
      setAvatarId(id >= 1 && id <= 12 ? id : 1);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, "notifications", user.uid, "items"), where("read", "==", false));
    return onSnapshot(q, (snap) => {
      setHasUnreadNotifications(!snap.empty);
    });
  }, [user]);

  return (
    <header className="top-nav">
      <Link className="brand" to="/">
        Findsomeone
      </Link>
      <nav className="top-nav-center" aria-label="Main navigation">
        {NAV_KEYS.map(({ to, key }) => (
          <Link key={key} className="top-nav-link" to={to}>
            {t(key)}
          </Link>
        ))}
      </nav>
      <div className="top-nav-right" role="group" aria-label="Language and profile">
        <div className="lang-switcher">
          {SUPPORTED_LANGUAGES.map((lang, index) => (
            <span key={lang.code} className="lang-switcher__item">
              {index > 0 ? (
                <span className="lang-switcher__sep" aria-hidden="true">
                  |
                </span>
              ) : null}
              <button
                type="button"
                className={`lang-switcher__btn ${language === lang.code ? "is-active" : ""}`}
                onClick={() => setLanguage(lang.code)}
                aria-pressed={language === lang.code}
              >
                {t(lang.labelKey)}
              </button>
            </span>
          ))}
        </div>
        <Link className="avatar-button" to={profileHref} aria-label={profileAria}>
          <img src={avatarSrc} alt={profileAria} />
          {hasUnreadNotifications ? <span className="avatar-button__dot" aria-hidden="true" /> : null}
        </Link>
      </div>
    </header>
  );
}
