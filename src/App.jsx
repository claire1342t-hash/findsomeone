import { Link } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { Footer } from "./components/Footer.jsx";
import { FeatureCardImages } from "./components/FeatureCardImages.jsx";
import { ResponsiveImg } from "./components/ResponsiveImg.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";
import { useDocumentMeta } from "./hooks/useDocumentMeta.js";
import { illustration } from "./utils/illustrationAssets.js";

function App() {
  const { t } = useLanguage();
  useDocumentMeta({
    title: t("meta.home.title"),
    description: t("meta.home.description"),
    path: "/",
  });
  const featureCards = [
    {
      id: "map",
      titleKey: "feature.map.title",
      descKey: "feature.map.desc",
      image: illustration("map-1"),
    },
    {
      id: "write",
      titleKey: "feature.write.title",
      descKey: "feature.write.desc",
      image: illustration("boy-1"),
    },
    {
      id: "subscribe",
      titleKey: "feature.sub.title",
      descKey: "feature.sub.desc",
      image: illustration("phone-1"),
    },
    {
      id: "chat",
      titleKey: "feature.chat.title",
      descKey: "feature.chat.desc",
      image: illustration("Chat-1"),
    },
  ];
  const postButtonDefault = illustration("button_1");
  const postButtonActive = illustration("button_2");

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
        <section className="feature-grid" aria-label={t("meta.featureGridAria")}>
          {featureCards.map((card) => (
            <article className="feature-card feature-card--illustration" key={card.id}>
              <FeatureCardImages image={card.image} />
              <h2>{t(card.titleKey)}</h2>
              <p>{t(card.descKey)}</p>
            </article>
          ))}
        </section>
        <section className="home-post-cta" aria-label={t("hero.postCta")}>
          <Link className="hero-image-button" to="/post" aria-label={t("hero.postCta")}>
            <ResponsiveImg
              source={postButtonDefault}
              layout="button"
              className="hero-button-image default"
              alt={t("hero.postCta")}
              loading="lazy"
            />
            <ResponsiveImg
              source={postButtonActive}
              layout="button"
              className="hero-button-image active"
              alt=""
              aria-hidden
              loading="lazy"
            />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
export default App;
