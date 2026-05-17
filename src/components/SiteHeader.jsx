import { Link } from "react-router-dom";
import profileImg from "../assets/illustrations/profile.webp";
import { SUPPORTED_LANGUAGES, useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getAvatarById } from "../assets/avatarOptions.js";
import { getDb } from "../lib/firebaseApp.js";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const profileHref = user ? "/profile" : "/login";
  const profileAria = user ? t("meta.profileAriaUser") : t("meta.profileAriaGuest");
  const avatar = user ? getAvatarById(avatarId) : { src: profileImg, srcSet: undefined };

  useEffect(() => {
    if (!user) return undefined;
    let unsubscribe = () => {};
    (async () => {
      const [{ doc, onSnapshot }, db] = await Promise.all([import("firebase/firestore"), getDb()]);
      unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
        const id = Number(snap.data()?.avatarId);
        setAvatarId(id >= 1 && id <= 12 ? id : 1);
        setIsAdmin(snap.data()?.isAdmin === true);
      });
    })();
    return () => unsubscribe();
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
        {user && isAdmin ? (
          <Link className="top-nav-link" to="/admin">
            {t("nav.admin")}
          </Link>
        ) : null}
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
          <img
            src={avatar.src}
            srcSet={avatar.srcSet}
            sizes="40px"
            alt={profileAria}
            width={40}
            height={40}
            decoding="async"
          />
        </Link>
      </div>
    </header>
  );
}
