import { Link } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { Footer } from "./components/Footer.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";
import mapDefault from "./assets/illustrations/map-1.webp";
import mapHover from "./assets/illustrations/map-2.webp";
import boyDefault from "./assets/illustrations/boy-1.webp";
import boyHover from "./assets/illustrations/boy-2.webp";
import phoneDefault from "./assets/illustrations/phone-1.webp";
import phoneHover from "./assets/illustrations/phone-2.webp";
import chatDefault from "./assets/illustrations/Chat-1.webp";
import chatHover from "./assets/illustrations/Chat-2.webp";
import buttonDefault from "./assets/illustrations/button_1.webp";
import buttonActive from "./assets/illustrations/button_2.webp";

function App() {
  const { t } = useLanguage();
  const featureCards = [
    { id: "map", titleKey: "feature.map.title", descKey: "feature.map.desc", defaultImage: mapDefault, hoverImage: mapHover },
    { id: "write", titleKey: "feature.write.title", descKey: "feature.write.desc", defaultImage: boyDefault, hoverImage: boyHover },
    { id: "subscribe", titleKey: "feature.sub.title", descKey: "feature.sub.desc", defaultImage: phoneDefault, hoverImage: phoneHover },
    { id: "chat", titleKey: "feature.chat.title", descKey: "feature.chat.desc", defaultImage: chatDefault, hoverImage: chatHover },
  ];
  return (
    <div className="home-page app-shell">
      <SiteHeader />
      <main className="home-main">
        <section className="hero-section">
          <div className="hero-copy">
            <h1>{t("hero.h1")}</h1>
            <p className="hero-subtext">{t("hero.sub")}</p>
          </div>
        </section>
        <section className="feature-grid" aria-label="Feature introduction">
          {featureCards.map((card) => (
            <article className="feature-card feature-card--illustration" key={card.id}>
              <div className="feature-image-wrap">
                <img
                  className="feature-image default"
                  src={card.defaultImage}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="feature-image hover"
                  src={card.hoverImage}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <h2>{t(card.titleKey)}</h2>
              <p>{t(card.descKey)}</p>
            </article>
          ))}
        </section>
        <section className="home-post-cta" aria-label={t("hero.postCta")}>
          <Link className="hero-image-button" to="/post" aria-label={t("hero.postCta")}>
            <img
              className="hero-button-image default"
              src={buttonDefault}
              alt={t("hero.postCta")}
              loading="lazy"
              decoding="async"
            />
            <img
              className="hero-button-image active"
              src={buttonActive}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
export default App;
