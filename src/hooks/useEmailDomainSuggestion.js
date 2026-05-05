import { useEffect, useState } from "react";
import { getEmailDomainSuggestion } from "../utils/emailDomainSuggest.js";

/**
 * @param {string} email
 * @param {number} [debounceMs]
 */
export function useEmailDomainSuggestion(email, debounceMs = 420) {
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = String(email).trim();
      if (!trimmed.includes("@")) {
        setSuggestion(null);
        return;
      }
      const s = getEmailDomainSuggestion(trimmed);
      const norm = trimmed.toLowerCase();
      if (s && s.full.toLowerCase() !== norm) setSuggestion(s);
      else setSuggestion(null);
    }, debounceMs);
    return () => window.clearTimeout(id);
  }, [email, debounceMs]);

  return suggestion;
}
