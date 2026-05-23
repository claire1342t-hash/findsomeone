import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="app-footer" role="contentinfo">
      <nav className="app-footer__nav" aria-label={t("footer.navAria")}>
        <Link to="/about">{t("footer.about")}</Link>
        <Link to="/about#about-privacy-title">{t("footer.privacy")}</Link>
        <Link to="/about#about-terms-title">{t("footer.terms")}</Link>
        <Link to="/about#about-contact-title">{t("footer.contact")}</Link>
        <Link to="/about#about-feature-report">{t("footer.report")}</Link>
      </nav>
      <p className="app-footer__copy">{t("footer.copyright")}</p>
    </footer>
  );
}
