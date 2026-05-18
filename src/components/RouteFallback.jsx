import { useLanguage } from "../context/LanguageContext.jsx";

export function RouteFallback() {
  const { t } = useLanguage();
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <p className="route-fallback__text">{t("route.loading")}</p>
    </div>
  );
}
