import { useLanguage } from "../context/LanguageContext.jsx";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="app-footer" role="contentinfo">
      <p className="app-footer__copy">{t("footer.copyright")}</p>
    </footer>
  );
}
