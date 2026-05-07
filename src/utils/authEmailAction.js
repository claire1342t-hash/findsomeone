/**
 * Firebase email verification / email-change links need a continue URL whose **origin**
 * is in Authentication → Settings → Authorized domains.
 *
 * Set `REACT_APP_AUTH_CONTINUE_URL` (full URL, e.g. https://www.findsomeone.co/profile)
 * in Vercel env and locally in `.env` so all environments use one allowlisted domain.
 *
 * If unset, falls back to `window.location.origin + "/profile"` (dev / preview).
 */
export function getEmailVerificationContinueUrl() {
  const fromEnv = import.meta.env.REACT_APP_AUTH_CONTINUE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/profile`;
  }
  return undefined;
}

/** @returns {{ url: string, handleCodeInApp: boolean } | undefined} */
export function getEmailVerificationActionSettings() {
  const url = getEmailVerificationContinueUrl();
  if (!url) return undefined;
  return { url, handleCodeInApp: false };
}
