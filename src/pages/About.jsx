import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { EmailDomainHint } from "../components/EmailDomainHint.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { useEmailDomainSuggestion } from "../hooks/useEmailDomainSuggestion.js";
import { sendEmail } from "../utils/sendEmail.js";
import "./About.css";

const MECHANISM_FEATURE_IDS = [
  "avatar",
  "view-replies",
  "match",
  "anon-nickname",
  "delete-post",
  "report",
  "post-expiry",
  "chat-expiry",
  "end-chat",
];

const FEATURE_ICONS = {
  avatar: "🎨",
  "view-replies": "👀",
  match: "🎉",
  "anon-nickname": "🎭",
  "delete-post": "🗑️",
  report: "🚨",
  "post-expiry": "⏰",
  "chat-expiry": "💬",
  "end-chat": "🚪",
};

function About() {
  const { t } = useLanguage();
  useDocumentMeta({
    title: t("meta.about.title"),
    description: t("meta.about.description"),
    path: "/about",
  });

  const { user, loading: authLoading } = useAuth();
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);
  const emailSuggestion = useEmailDomainSuggestion(contactEmail);

  useEffect(() => {
    if (user?.email) {
      setContactEmail(user.email);
    }
  }, [user?.email]);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactError("");
    setContactSuccess(false);
    if (!user) {
      setContactError(t("about.contact.errorNeedLogin"));
      return;
    }
    const emailNorm = contactEmail.trim().toLowerCase();
    const messageNorm = contactMessage.trim();
    if (!emailNorm || !emailNorm.includes("@")) {
      setContactError(t("about.contact.errorInvalidEmail"));
      return;
    }
    if (messageNorm.length < 2) {
      setContactError(t("about.contact.errorNeedMessage"));
      return;
    }
    setContactBusy(true);
    try {
      await sendEmail({
        kind: "contact",
        fromEmail: emailNorm,
        message: messageNorm,
      });
      setContactSuccess(true);
      setContactMessage("");
    } catch (err) {
      console.error("[About] contact send failed", err);
      setContactError(err instanceof Error ? err.message : t("about.contact.errorSendFailed"));
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <div className="home-page about-page app-shell">
      <SiteHeader />
      <main className="home-main about-main" id="main-content">
        <section className="about-section about-intro" aria-labelledby="about-philosophy-title">
          <h1 id="about-philosophy-title" className="about-heading">
            {t("about.philosophy.title")}
          </h1>
          <p className="about-lead">
            {t("about.philosophy.lead1")}
            <br />
            {t("about.philosophy.lead2")}
            <br />
            {t("about.philosophy.lead3")}
          </p>
        </section>

        <section className="about-section about-privacy" aria-labelledby="about-privacy-title">
          <h2 id="about-privacy-title" className="about-section-title about-anchor-target">
            {t("about.privacy.title")}
          </h2>
          <p className="about-lead">{t("about.privacy.lead1")}</p>
          <p className="about-lead">{t("about.privacy.lead2")}</p>
          <p className="about-lead">{t("about.privacy.lead3")}</p>
          <p className="about-lead">{t("about.privacy.lead4")}</p>
          <p className="about-lead">{t("about.privacy.lead5")}</p>
          <p className="about-lead">{t("about.privacy.lead6")}</p>
        </section>

        <section className="about-section about-terms" aria-labelledby="about-terms-title">
          <h2 id="about-terms-title" className="about-section-title about-anchor-target">
            {t("about.terms.title")}
          </h2>
          <p className="about-lead">{t("about.terms.lead1")}</p>
          <p className="about-lead">{t("about.terms.lead2")}</p>
          <p className="about-lead">{t("about.terms.lead3")}</p>
          <p className="about-lead">{t("about.terms.lead4")}</p>
          <p className="about-lead">{t("about.terms.lead5")}</p>
        </section>

        <section className="about-section" aria-labelledby="about-mechanism-title">
          <h2 id="about-mechanism-title" className="about-section-title">
            {t("about.mechanism.title")}
          </h2>
          <div className="about-feature-grid">
            {MECHANISM_FEATURE_IDS.map((id) => (
              <article
                className="about-feature-card"
                key={id}
                id={id === "report" ? "about-feature-report" : undefined}
              >
                <span className="about-feature-icon" aria-hidden>
                  {FEATURE_ICONS[id]}
                </span>
                <h3 className="about-feature-title">{t(`about.feature.${id}.title`)}</h3>
                <p className="about-feature-desc">{t(`about.feature.${id}.desc`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-author-title">
          <h2 id="about-author-title" className="about-section-title">
            {t("about.author.title")}
          </h2>
          <article className="about-author-card">
            <p className="about-author-name">Claire</p>
            <p className="about-author-bio">{t("about.author.bio")}</p>
          </article>
        </section>

        <section className="about-section about-trust" aria-labelledby="about-trust-title">
          <h2 id="about-trust-title" className="about-section-title about-anchor-target">
            {t("about.trust.title")}
          </h2>
          <p className="about-lead">{t("about.trust.report")}</p>
          <p className="about-lead">{t("about.trust.contact")}</p>
        </section>

        <section className="about-section about-contact" aria-labelledby="about-contact-title">
          <h2 id="about-contact-title" className="about-section-title about-anchor-target">
            {t("about.contact.title")}
          </h2>
          <div className="about-contact-card">
            {!authLoading && !user ? (
              <p className="about-contact-login-hint">
                {t("about.contact.loginBefore")}{" "}
                <Link className="about-link" to="/login">
                  {t("about.contact.loginLink")}
                </Link>{" "}
                {t("about.contact.loginAfter")}
              </p>
            ) : null}
            <form className="about-contact-form" onSubmit={handleContactSubmit}>
              <div className="about-field">
                <label className="about-label" htmlFor="about-contact-email">
                  {t("about.contact.emailLabel")}
                </label>
                <input
                  id="about-contact-email"
                  type="email"
                  className="about-input"
                  value={contactEmail}
                  onChange={(ev) => setContactEmail(ev.target.value)}
                  required
                  autoComplete="email"
                  disabled={contactBusy || !user}
                />
                <EmailDomainHint suggestion={emailSuggestion} onApply={setContactEmail} />
              </div>
              <div className="about-field">
                <label className="about-label" htmlFor="about-contact-message">
                  {t("about.contact.messageLabel")}
                </label>
                <textarea
                  id="about-contact-message"
                  className="about-textarea"
                  rows={5}
                  value={contactMessage}
                  onChange={(ev) => setContactMessage(ev.target.value)}
                  placeholder={t("about.contact.messagePlaceholder")}
                  required
                  minLength={2}
                  maxLength={5000}
                  disabled={contactBusy || !user}
                />
              </div>
              {contactError ? (
                <p className="about-form-error" role="alert">
                  {contactError}
                </p>
              ) : null}
              {contactSuccess ? (
                <p className="about-form-success" role="status">
                  {t("about.contact.success")}
                </p>
              ) : null}
              <button
                type="submit"
                className="about-submit"
                disabled={contactBusy || authLoading || !user}
              >
                {t("about.contact.submit")}
              </button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default About;
