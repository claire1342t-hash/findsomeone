import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import "./About.css";

function About() {
  const { t } = useLanguage();
  return (
    <div className="home-page app-shell">
      <SiteHeader />
      <main className="home-main about-main" id="main-content">
        <section className="hero-section about-hero" aria-labelledby="about-page-title">
          <div className="hero-copy">
            <h1 id="about-page-title">{t("about.pageTitle")}</h1>
            <p className="hero-subtext">{t("about.pageSubtitle")}</p>
          </div>
        </section>
        <div className="about-grid">
          <article className="feature-card about-card">
            <h2>{t("about.what.title")}</h2>
            <p>{t("about.what.body")}</p>
          </article>
          <article className="feature-card about-card">
            <h2>{t("about.how.title")}</h2>
            <p>{t("about.how.body")}</p>
          </article>
          <article className="feature-card about-card">
            <h2>{t("about.safe.title")}</h2>
            <p>{t("about.safe.body")}</p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default About;
