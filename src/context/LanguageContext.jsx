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

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("zh");

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

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, t],
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
