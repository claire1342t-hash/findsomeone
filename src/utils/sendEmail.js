import { getFirebaseAuth } from "../firebaseAuth.js";

const LOG = "[sendEmail:client]";

/**
 * Sends transactional mail via Vercel Edge `api/sendEmail.js` (Resend).
 * Uses the caller's Firebase ID token; the API resolves recipients from Firestore.
 *
 * Optional: `REACT_APP_SEND_EMAIL_URL` — full URL if the API is not same-origin (e.g. preview).
 *
 * @param {{
 *   kind: string;
 *   postId?: string;
 *   responseUserId?: string;
 *   reportType?: "post" | "chat";
 *   targetId?: string;
 *   fromEmail?: string;
 *   message?: string;
 * }} payload
 */
export async function sendEmail(payload) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const idToken = await user.getIdToken(true);
  const url = import.meta.env.REACT_APP_SEND_EMAIL_URL || "/api/sendEmail";

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    console.error(`${LOG} network error (fetch threw)`, netErr);
    throw netErr;
  }

  const text = await res.text();

  if (text.trimStart().startsWith("<")) {
    const hint =
      "Received HTML instead of JSON — the email API was not reached (Vite dev does not serve /api). " +
      "Set REACT_APP_SEND_EMAIL_URL to your full Vercel API URL (e.g. https://your-app.vercel.app/api/sendEmail), or run `vercel dev`.";
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
    console.error(`${LOG} API error`, data);
    throw new Error(data.error || text || `HTTP ${res.status}`);
  }

  if (data && data.ok === false) {
    const reason = data.reason || "email_not_sent";
    console.error(`${LOG} API declined send`, { reason, ...data });
    throw new Error(reason);
  }

  return data;
}
