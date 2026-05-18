/**
 * Public password-reset email via Resend + Identity Toolkit OOB link (no Firebase default mail).
 *
 * Env: RESEND_API_KEY, RESEND_FROM, FIREBASE_WEB_API_KEY, FIREBASE_SERVICE_ACCOUNT_JSON
 * Optional: FIREBASE_APP_DISPLAY_NAME (default Findsomeone)
 */

import { SignJWT, importPKCS8 } from "jose";

const LOG = "[passwordReset]";
const IDENTITY_TOOLKIT_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";
const MAIL_DIVIDER = "\n\n------------------------------\n\n";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function logError(message, detail) {
  if (detail !== undefined) {
    console.error(`${LOG} ${message}`, detail);
  } else {
    console.error(`${LOG} ${message}`);
  }
}

async function getIdentityToolkitAccessToken(serviceAccountJson) {
  let sa;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch (e) {
    logError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON", String(e?.message || e));
    throw e;
  }
  const pk = sa.private_key.includes("BEGIN") ? sa.private_key : sa.private_key.replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(pk, "RS256");
  const jwt = await new SignJWT({ scope: IDENTITY_TOOLKIT_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("45m")
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokText = await tok.text();
  if (!tok.ok) {
    logError("Google OAuth token failed", { status: tok.status, bodyPreview: tokText.slice(0, 400) });
    throw new Error(`oauth token: ${tokText}`);
  }
  const json = JSON.parse(tokText);
  return json.access_token;
}

async function generatePasswordResetLink({ apiKey, accessToken, email, continueUrl }) {
  const payload = {
    requestType: "PASSWORD_RESET",
    email,
    returnOobLink: true,
    canHandleCodeInApp: false,
  };
  if (continueUrl) {
    payload.continueUrl = continueUrl;
  }

  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );
  const raw = await r.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { _raw: raw.slice(0, 500) };
  }
  if (!r.ok) {
    const message = data?.error?.message || raw.slice(0, 300);
    const err = new Error(message || `sendOobCode HTTP ${r.status}`);
    err.code = data?.error?.message || "";
    throw err;
  }
  const link = data.oobLink;
  if (!link || typeof link !== "string") {
    throw new Error("sendOobCode: missing oobLink");
  }
  return link;
}

async function sendResend({ apiKey, from, to, subject, text }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  const raw = await r.text();
  if (!r.ok) {
    logError("Resend API failed", { status: r.status, bodyPreview: raw.slice(0, 400) });
    throw new Error(`resend: ${raw}`);
  }
  return raw ? JSON.parse(raw) : {};
}

function buildResetEmailBody({ link, appName }) {
  return (
    "【繁體中文】\n\n" +
    `你好，\n\n請點選以下連結重設你的 ${appName} 密碼：\n${link}\n\n` +
    "若你沒有申請重設密碼，可忽略此信。" +
    MAIL_DIVIDER +
    "[English]\n\n" +
    `Hello,\n\nClick the link below to reset your ${appName} password:\n${link}\n\n` +
    "If you did not request a password reset, you can ignore this email.\n"
  );
}

function mapOobErrorToCode(message) {
  const m = String(message || "");
  if (m.includes("EMAIL_NOT_FOUND")) return "auth/user-not-found";
  if (m.includes("INVALID_EMAIL")) return "auth/invalid-email";
  return "auth/internal-error";
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  const webApiKey = process.env.FIREBASE_WEB_API_KEY;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const appName = String(process.env.FIREBASE_APP_DISPLAY_NAME || "Findsomeone").trim() || "Findsomeone";

  if (!resendKey || !resendFrom || !webApiKey || !saJson) {
    const missing = [
      !resendKey && "RESEND_API_KEY",
      !resendFrom && "RESEND_FROM",
      !webApiKey && "FIREBASE_WEB_API_KEY",
      !saJson && "FIREBASE_SERVICE_ACCOUNT_JSON",
    ].filter(Boolean);
    logError("missing env", missing);
    return new Response(JSON.stringify({ error: "Server email env not configured", missingEnv: missing }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    logError("JSON parse failed", e);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ error: "Invalid email", code: "auth/invalid-email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const continueUrl =
    typeof body?.continueUrl === "string" && body.continueUrl.trim()
      ? body.continueUrl.trim().replace(/\/$/, "")
      : undefined;

  try {
    const accessToken = await getIdentityToolkitAccessToken(saJson);
    const link = await generatePasswordResetLink({
      apiKey: webApiKey,
      accessToken,
      email,
      continueUrl,
    });
    const subject = `【Findsomeone】重設密碼 Reset your password for ${appName}`;
    const text = buildResetEmailBody({ link, appName });
    const resendBody = await sendResend({
      apiKey: resendKey,
      from: resendFrom,
      to: email,
      subject,
      text,
    });
    return new Response(JSON.stringify({ ok: true, resend: resendBody }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = String(e?.message || e);
    logError("password reset failed", message);
    const code = mapOobErrorToCode(message);
    const status = code === "auth/user-not-found" || code === "auth/invalid-email" ? 400 : 500;
    return new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
