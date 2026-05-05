import { useLanguage } from "../context/LanguageContext.jsx";

/**
 * @param {{ suggestion: { domain: string, full: string } | null, onApply: (full: string) => void }} props
 */
export function EmailDomainHint({ suggestion, onApply }) {
  const { t } = useLanguage();
  if (!suggestion) return null;

  return (
    <div className="email-domain-hint">
      <p className="email-domain-hint__text" role="status">
        {t("email.suggest.text").replace("{domain}", suggestion.domain)}
      </p>
      <button
        type="button"
        className="email-domain-hint__apply account-link-btn"
        onClick={() => onApply(suggestion.full)}
      >
        {t("email.suggest.apply").replace("{full}", suggestion.full)}
      </button>
    </div>
  );
}
