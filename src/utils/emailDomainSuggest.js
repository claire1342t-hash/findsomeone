import Mailcheck from "mailcheck";

/** Domains common in Taiwan / this product’s audience (extends mailcheck defaults). */
const EXTRA_DOMAINS = [
  "yahoo.com.tw",
  "hotmail.com.tw",
  "msn.com.tw",
  "seed.net.tw",
  "pchome.com.tw",
  "hinet.net",
];

/**
 * @param {string} email
 * @returns {{ address: string, domain: string, full: string } | null}
 */
export function getEmailDomainSuggestion(email) {
  const trimmed = String(email ?? "").trim();
  if (!trimmed.includes("@")) return null;
  const atIdx = trimmed.lastIndexOf("@");
  if (atIdx <= 0 || atIdx === trimmed.length - 1) return null;

  let result = null;
  Mailcheck.run({
    email: trimmed,
    domains: [...Mailcheck.defaultDomains, ...EXTRA_DOMAINS],
    suggested: (s) => {
      result = s;
    },
    empty: () => {
      result = null;
    },
  });
  return result;
}
