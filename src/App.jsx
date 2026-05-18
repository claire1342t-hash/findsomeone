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
    title: "Findsomeone",
    description:
      "Spotted someone but didn't say hello? Post it on Findsomeone — they might find you back.",
    path: "/",
  });
  const featureCards = [
    {
      id: "map",
      titleKey: "feature.map.title",
      descKey: "feature.map.desc",
      defaultImage: illustration("map-1"),
      hoverImage: illustration("map-2"),
    },
    {
      id: "write",
      titleKey: "feature.write.title",
      descKey: "feature.write.desc",
      defaultImage: illustration("boy-1"),
      hoverImage: illustration("boy-2"),
    },
    {
      id: "subscribe",
      titleKey: "feature.sub.title",
      descKey: "feature.sub.desc",
      defaultImage: illustration("phone-1"),
      hoverImage: illustration("phone-2"),
    },
    {
      id: "chat",
      titleKey: "feature.chat.title",
      descKey: "feature.chat.desc",
      defaultImage: illustration("Chat-1"),
      hoverImage: illustration("Chat-2"),
    },
  ];
  const buttonDefault = illustration("button_1");
  const buttonActive = illustration("button_2");

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
              <FeatureCardImages defaultImage={card.defaultImage} hoverImage={card.hoverImage} />
              <h2>{t(card.titleKey)}</h2>
              <p>{t(card.descKey)}</p>
            </article>
          ))}
        </section>
        <section className="home-post-cta" aria-label={t("hero.postCta")}>
          <Link className="hero-image-button" to="/post" aria-label={t("hero.postCta")}>
            <ResponsiveImg
              source={buttonDefault}
              layout="button"
              className="hero-button-image default"
              alt={t("hero.postCta")}
              loading="lazy"
            />
            <ResponsiveImg
              source={buttonActive}
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
