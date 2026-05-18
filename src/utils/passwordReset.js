import { getEmailVerificationContinueUrl } from "./authEmailAction.js";

const LOG = "[passwordReset:client]";

/**
 * Request a password-reset email via `/api/passwordReset` (Resend + custom subject).
 *
 * Optional: `REACT_APP_PASSWORD_RESET_URL` — full URL if the API is not same-origin.
 *
 * @param {string} email
 * @throws {Error & { code?: string }}
 */
export async function requestPasswordReset(email) {
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  const url = import.meta.env.REACT_APP_PASSWORD_RESET_URL || "/api/passwordReset";
  const continueUrl = getEmailVerificationContinueUrl();

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailNorm, continueUrl }),
    });
  } catch (netErr) {
    console.error(`${LOG} network error`, netErr);
    throw netErr;
  }

  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    const hint =
      "Received HTML instead of JSON — the password reset API was not reached. " +
      "Set REACT_APP_PASSWORD_RESET_URL to your deployed API URL, or run `vercel dev`.";
    console.error(`${LOG} ${hint}`);
    throw new Error(hint);
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (!res.ok) {
    const err = new Error(data.error || text || `HTTP ${res.status}`);
    if (data.code) err.code = data.code;
    throw err;
  }

  return data;
}
