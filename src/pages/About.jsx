import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import "./About.css";

function About() {
  return (
    <div className="home-page app-shell">
      <SiteHeader />
      <main className="home-main about-main" id="main-content">
        <section className="hero-section about-hero" aria-labelledby="about-page-title">
          <div className="hero-copy">
            <h1 id="about-page-title">About page coming soon</h1>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default About;
