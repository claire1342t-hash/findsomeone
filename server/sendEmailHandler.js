/**
 * Vercel Edge Function — transactional email via Resend.
 * Verifies Firebase ID token, reads Firestore with a service account (JWT),
 * enforces the same rules as the former callable, sends zh-TW plaintext.
 *
 * Env (Vercel project settings):
 * - RESEND_API_KEY
 * - RESEND_FROM
 * - FIREBASE_WEB_API_KEY (same as client REACT_APP_FIREBASE_API_KEY)
 * - FIREBASE_SERVICE_ACCOUNT_JSON (full service account JSON string)
 * - REPORT_NOTIFY_EMAIL (admin inbox for new report notifications; optional — if unset, reportSubmitted returns ok:false)
 * - CONTACT_EMAIL (About page contact form; default claire1342t@gmail.com)
 */

import { SignJWT, importPKCS8 } from "jose";

const LOG = "[sendEmail]";
const MAIL_DIVIDER = "\n\n------------------------------\n\n";

function logError(message, detail) {
  if (detail !== undefined) {
    console.error(`${LOG} ${message}`, detail);
  } else {
    console.error(`${LOG} ${message}`);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

async function verifyIdToken(idToken, apiKey) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  const raw = await r.text();
  if (!r.ok) {
    logError("token verify failed", { status: r.status, bodyPreview: raw.slice(0, 400) });
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    logError("token verify failed: non-JSON response", raw.slice(0, 200));
    return null;
  }
  const uid = data.users?.[0]?.localId;
  if (typeof uid === "string") {
    return uid;
  }
  logError("token verify failed: no localId", { keys: data ? Object.keys(data) : [] });
  return null;
}

async function getGoogleAccessToken(serviceAccountJson) {
  let sa;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch (e) {
    logError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON", String(e?.message || e));
    throw e;
  }
  const pk = sa.private_key.includes("BEGIN") ? sa.private_key : sa.private_key.replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(pk, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/datastore",
  })
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
  return { accessToken: json.access_token, projectId: sa.project_id };
}

function stringField(doc, key) {
  return doc?.fields?.[key]?.stringValue ?? "";
}

async function firestoreGetDoc(projectId, accessToken, relativePath) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${relativePath}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const raw = await r.text();
  if (r.status === 404) {
    return null;
  }
  if (!r.ok) {
    logError("Firestore GET failed", { path: relativePath, status: r.status, bodyPreview: raw.slice(0, 400) });
    throw new Error(`firestore: ${raw}`);
  }
  return JSON.parse(raw);
}

async function getUserEmail(projectId, accessToken, uid) {
  const doc = await firestoreGetDoc(projectId, accessToken, `users/${uid}`);
  if (!doc) return null;
  const email = String(stringField(doc, "email")).trim();
  return email || null;
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
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { _nonJson: raw.slice(0, 500) };
  }
  if (!r.ok) {
    logError("Resend API failed", { status: r.status, body: parsed });
    throw new Error(`resend: ${raw}`);
  }
  return parsed;
}

function buildBilingualBody({ zh, en, postId }) {
  return (
    "【繁體中文】\n\n" +
    zh +
    "\n\n貼文編號：" +
    postId +
    MAIL_DIVIDER +
    "[English]\n\n" +
    en +
    "\n\nPost ID: " +
    postId +
    "\n"
  );
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

  const envPresent = {
    RESEND_API_KEY: !!resendKey,
    RESEND_FROM: !!resendFrom,
    FIREBASE_WEB_API_KEY: !!webApiKey,
    FIREBASE_SERVICE_ACCOUNT_JSON: !!saJson,
  };
  if (!resendKey || !resendFrom || !webApiKey || !saJson) {
    const missing = Object.entries(envPresent)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    logError("missing env", missing);
    return new Response(
      JSON.stringify({
        error: "Server email env not configured",
        missingEnv: missing,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    return new Response(JSON.stringify({ error: "Missing Authorization Bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const uid = await verifyIdToken(idToken, webApiKey);
  if (!uid) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
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

  const { kind, postId, responseUserId, reportType, targetId, fromEmail, message } = body ?? {};

  /** About page contact form → site owner inbox. */
  if (kind === "contact") {
    const contactTo = String(process.env.CONTACT_EMAIL || "claire1342t@gmail.com").trim();
    const emailNorm = String(fromEmail || "").trim().toLowerCase();
    const messageText = String(message || "").trim();
    if (!emailNorm || !emailNorm.includes("@")) {
      return new Response(JSON.stringify({ error: "fromEmail required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!messageText || messageText.length < 2) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (messageText.length > 5000) {
      return new Response(JSON.stringify({ error: "message too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const resendBody = await sendResend({
        apiKey: resendKey,
        from: resendFrom,
        to: contactTo,
        subject: "【Findsomeone】聯絡表單訊息",
        text:
          "來自 About 頁聯絡表單\n\n" +
          `寄件者 email：${emailNorm}\n` +
          `使用者 UID：${uid}\n\n` +
          messageText,
      });
      return new Response(JSON.stringify({ ok: true, resend: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      logError("contact failed", String(e?.message || e));
      return new Response(JSON.stringify({ error: String(e?.message || e) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  /** Notify admin when a user submits a report (no Firestore recipient lookup). */
  if (kind === "reportSubmitted") {
    const notifyTo = String(process.env.REPORT_NOTIFY_EMAIL || "").trim();
    if (!notifyTo) {
      return new Response(JSON.stringify({ ok: false, reason: "notify_email_not_configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (reportType !== "post" && reportType !== "chat") {
      return new Response(JSON.stringify({ error: "reportType must be post or chat" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!targetId || typeof targetId !== "string") {
      return new Response(JSON.stringify({ error: "targetId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const simpleLine = "Findsomeone有新的檢舉";
    try {
      const resendBody = await sendResend({
        apiKey: resendKey,
        from: resendFrom,
        to: notifyTo,
        subject: simpleLine,
        text: simpleLine,
      });
      return new Response(JSON.stringify({ ok: true, resend: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      logError("reportSubmitted failed", String(e?.message || e));
      return new Response(JSON.stringify({ error: String(e?.message || e) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!postId || typeof postId !== "string") {
    return new Response(JSON.stringify({ error: "postId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessToken;
  let projectId;
  try {
    ({ accessToken, projectId } = await getGoogleAccessToken(saJson));
  } catch (e) {
    logError("Firestore auth failed", String(e?.message || e));
    return new Response(JSON.stringify({ error: "Auth to Firestore failed", detail: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const postDoc = await firestoreGetDoc(projectId, accessToken, `posts/${postId}`);
  if (!postDoc) {
    return new Response(JSON.stringify({ error: "Post not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authorUid = stringField(postDoc, "authorUid");
  if (!authorUid) {
    return new Response(JSON.stringify({ error: "Post missing authorUid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    if (kind === "mapResponseSubmitted") {
      if (uid === authorUid) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const respDoc = await firestoreGetDoc(projectId, accessToken, `posts/${postId}/responses/${uid}`);
      if (!respDoc) {
        return new Response(JSON.stringify({ error: "Response not found" }), {
          status: 412,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const toPoster = await getUserEmail(projectId, accessToken, authorUid);
      if (!toPoster) {
        return new Response(JSON.stringify({ ok: false, reason: "author_has_no_email" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resendBody = await sendResend({
        apiKey: resendKey,
        from: resendFrom,
        to: toPoster,
        subject: "【Findsomeone】有人回覆了你的貼文 | Someone replied to your post",
        text: buildBilingualBody({
          zh: "你好，\n\n有人在 Findsomeone 地圖上回覆了你的一篇貼文，並已提交驗證答案。\n請登入網站並前往「個人」頁面檢視回覆、決定是否接受。",
          en: "Hello,\n\nSomeone has replied to your post on Findsomeone and submitted verification answers.\nPlease log in and go to your Profile page to review the response and decide whether to accept it.",
          postId,
        }),
      });
      return new Response(JSON.stringify({ ok: true, resend: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "posterAcceptedResponse" || kind === "posterRejectedResponse") {
      if (uid !== authorUid) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!responseUserId || typeof responseUserId !== "string") {
        return new Response(JSON.stringify({ error: "responseUserId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const responseDoc = await firestoreGetDoc(
        projectId,
        accessToken,
        `posts/${postId}/responses/${responseUserId}`,
      );
      if (!responseDoc) {
        return new Response(JSON.stringify({ error: "Response not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const responderUid = String(stringField(responseDoc, "responderUid") || responseUserId).trim() || responseUserId;
      const toResponder = await getUserEmail(projectId, accessToken, responderUid);
      if (!toResponder) {
        return new Response(JSON.stringify({ ok: false, reason: "responder_has_no_email" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let resendBody;
      if (kind === "posterAcceptedResponse") {
        resendBody = await sendResend({
          apiKey: resendKey,
          from: resendFrom,
          to: toResponder,
          subject:
            "【Findsomeone】貼文主已接受：可以開始匿名聊天 | Your response was accepted: anonymous chat is now open",
          text: buildBilingualBody({
            zh: "你好，\n\n你回覆的一篇貼文已被作者按下「就是你！」。\n匿名聊天室已開啟，請登入網站並從「聊天」進入對話。",
            en: "Hello,\n\nThe post owner accepted your response (\"That's you!\").\nAn anonymous chat room is now open. Please log in and open Chat to continue.",
            postId,
          }),
        });
      } else {
        resendBody = await sendResend({
          apiKey: resendKey,
          from: resendFrom,
          to: toResponder,
          subject:
            "【Findsomeone】貼文主標記為可能認錯了 | The post owner marked your response as not a match",
          text: buildBilingualBody({
            zh: "你好，\n\n你回覆的一篇貼文已被作者標記為「可能認錯了」。\n若仍符合條件，可依網站說明再次嘗試。",
            en: "Hello,\n\nThe post owner marked your response as \"possibly not a match\".\nIf you still think it matches, you may try again according to the app instructions.",
            postId,
          }),
        });
      }
      return new Response(JSON.stringify({ ok: true, resend: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported kind" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    logError("handler exception", String(e?.message || e));
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
