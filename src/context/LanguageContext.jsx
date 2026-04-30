/* eslint-disable react-refresh/only-export-components -- context + hooks + shared constants */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "../i18n/messages.js";

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: "zh", labelKey: "lang.zh" },
  { code: "en", labelKey: "lang.en" },
  { code: "ja", labelKey: "lang.ja" },
];

const HTML_LANG = {
  zh: "zh-Hant",
  en: "en",
  ja: "ja",
};

const DEFAULT_LANGUAGE = "zh";
const LANGUAGE_STORAGE_KEY = "findsomeone:language";

function normalizeLanguage(value) {
  return value === "en" || value === "ja" || value === "zh" ? value : DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  });

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(normalizeLanguage(nextLanguage));
  }, []);

  const t = useCallback(
    (key) => {
      const table = messages[language];
      if (table && Object.prototype.hasOwnProperty.call(table, key)) {
        return table[key];
      }
      const fallback = messages.zh[key];
      return fallback ?? key;
    },
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language] ?? "zh-Hant";
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
