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
 *
 * Debug: Vercel Dashboard → project → Logs (or Functions → select deployment → Logs).
 * Search for prefix `[sendEmail]`.
 */

import { SignJWT, importPKCS8 } from "jose";

export const config = { runtime: "edge" };

const LOG = "[sendEmail]";
const MAIL_DIVIDER = "\n\n------------------------------\n\n";

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
    console.log(`${LOG} token verify FAILED`, { status: r.status, bodyPreview: raw.slice(0, 400) });
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.log(`${LOG} token verify FAILED: non-JSON response`, raw.slice(0, 200));
    return null;
  }
  const uid = data.users?.[0]?.localId;
  if (typeof uid === "string") {
    console.log(`${LOG} token verify OK`, { uid });
    return uid;
  }
  console.log(`${LOG} token verify FAILED: no localId in response`, { keys: data ? Object.keys(data) : [] });
  return null;
}

async function getGoogleAccessToken(serviceAccountJson) {
  let sa;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch (e) {
    console.log(`${LOG} FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON`, String(e?.message || e));
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
    console.log(`${LOG} Google OAuth token FAILED`, { status: tok.status, bodyPreview: tokText.slice(0, 400) });
    throw new Error(`oauth token: ${tokText}`);
  }
  const json = JSON.parse(tokText);
  console.log(`${LOG} Firestore access token OK`, { projectId: sa.project_id });
  return { accessToken: json.access_token, projectId: sa.project_id };
}

function stringField(doc, key) {
  return doc?.fields?.[key]?.stringValue ?? "";
}

async function firestoreGetDoc(projectId, accessToken, relativePath) {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${relativePath}`;
  console.log(`${LOG} Firestore GET`, { path: relativePath });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const raw = await r.text();
  if (r.status === 404) {
    console.log(`${LOG} Firestore GET miss (404)`, { path: relativePath });
    return null;
  }
  if (!r.ok) {
    console.log(`${LOG} Firestore GET FAILED`, { path: relativePath, status: r.status, bodyPreview: raw.slice(0, 400) });
    throw new Error(`firestore: ${raw}`);
  }
  console.log(`${LOG} Firestore GET OK`, { path: relativePath });
  return JSON.parse(raw);
}

async function getUserEmail(projectId, accessToken, uid) {
  const doc = await firestoreGetDoc(projectId, accessToken, `users/${uid}`);
  if (!doc) return null;
  const email = String(stringField(doc, "email")).trim();
  console.log(`${LOG} user email resolved`, { uid, hasEmail: !!email });
  return email || null;
}

async function sendResend({ apiKey, from, to, subject, text }) {
  console.log(`${LOG} calling Resend API`, { to, subjectPreview: subject.slice(0, 40) });
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
  console.log(`${LOG} Resend response`, { status: r.status, body: parsed });
  if (!r.ok) {
    throw new Error(`resend: ${raw}`);
  }
  return parsed;
}

function buildTrilingualBody({ zh, en, ja, postId }) {
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
    MAIL_DIVIDER +
    "【日本語】\n\n" +
    ja +
    "\n\n投稿ID：" +
    postId +
    "\n"
  );
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    console.log(`${LOG} OPTIONS (preflight)`);
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    console.log(`${LOG} reject: method`, request.method);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`${LOG} POST received`);

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
  console.log(`${LOG} env presence (true = set)`, envPresent);

  if (!resendKey || !resendFrom || !webApiKey || !saJson) {
    const missing = Object.entries(envPresent)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    console.log(`${LOG} ABORT: missing env`, missing);
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
    console.log(`${LOG} ABORT: no Bearer token`);
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
    console.log(`${LOG} ABORT: JSON parse failed`, e);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { kind, postId, responseUserId } = body ?? {};
  console.log(`${LOG} payload`, { kind, postId, responseUserId });

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
    console.log(`${LOG} ABORT: FIREBASE_SERVICE_ACCOUNT_JSON parse or OAuth`, String(e?.message || e));
    return new Response(JSON.stringify({ error: "Auth to Firestore failed", detail: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const postDoc = await firestoreGetDoc(projectId, accessToken, `posts/${postId}`);
  if (!postDoc) {
    console.log(`${LOG} ABORT: post not found`, { postId });
    return new Response(JSON.stringify({ error: "Post not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authorUid = stringField(postDoc, "authorUid");
  if (!authorUid) {
    console.log(`${LOG} ABORT: post missing authorUid`);
    return new Response(JSON.stringify({ error: "Post missing authorUid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  console.log(`${LOG} post loaded`, { postId, authorUid });
  const to = await getUserEmail(projectId, accessToken, authorUid);
  if (!to) {
    console.log(`${LOG} done: author_has_no_email (not sent)`);
    return new Response(JSON.stringify({ ok: false, reason: "author_has_no_email" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (kind === "mapResponseSubmitted") {
      if (uid === authorUid) {
        console.log(`${LOG} ABORT: poster cannot trigger mapResponseSubmitted`);
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const respDoc = await firestoreGetDoc(projectId, accessToken, `posts/${postId}/responses/${uid}`);
      if (!respDoc) {
        console.log(`${LOG} ABORT: response doc missing`);
        return new Response(JSON.stringify({ error: "Response not found" }), {
          status: 412,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resendBody = await sendResend({
        apiKey: resendKey,
        from: resendFrom,
        to,
        subject:
          "【Findsomeone】有人回覆了你的貼文 | Someone replied to your post | あなたの投稿に返信がありました",
        text: buildTrilingualBody({
          zh: "你好，\n\n有人在 Findsomeone 地圖上回覆了你的一篇貼文，並已提交驗證答案。\n請登入網站並前往「個人」頁面檢視回覆、決定是否接受。",
          en: "Hello,\n\nSomeone has replied to your post on Findsomeone and submitted verification answers.\nPlease log in and go to your Profile page to review the response and decide whether to accept it.",
          ja: "こんにちは。\n\nFindsomeone の地図で、あなたの投稿に返信があり、本人確認の回答が送信されました。\nサイトにログインし、「プロフィール」ページで返信内容を確認して、受け入れるかどうかを決めてください。",
          postId,
        }),
      });
      console.log(`${LOG} SUCCESS mapResponseSubmitted`, resendBody);
      return new Response(JSON.stringify({ ok: true, resend: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "posterAcceptedResponse" || kind === "posterRejectedResponse") {
      if (uid !== authorUid) {
        console.log(`${LOG} ABORT: not author`, { uid, authorUid });
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
      let resendBody;
      if (kind === "posterAcceptedResponse") {
        resendBody = await sendResend({
          apiKey: resendKey,
          from: resendFrom,
          to,
          subject:
            "【Findsomeone】貼文主已接受：可以開始匿名聊天 | Your response was accepted: anonymous chat is now open | 投稿者が承認しました：匿名チャットを開始できます",
          text: buildTrilingualBody({
            zh: "你好，\n\n你回覆的一篇貼文已被作者按下「就是你！」（接受）。\n匿名聊天室已開啟，請登入網站並從「聊天」進入對話。",
            en: "Hello,\n\nThe post owner accepted your response (\"That's you!\").\nAn anonymous chat room is now open. Please log in and open Chat to continue.",
            ja: "こんにちは。\n\nあなたの返信は投稿者に承認されました（「あなたです！」）。\n匿名チャットが開始されました。ログインして「チャット」から会話を始めてください。",
            postId,
          }),
        });
      } else {
        resendBody = await sendResend({
          apiKey: resendKey,
          from: resendFrom,
          to,
          subject:
            "【Findsomeone】貼文主標記為可能認錯了 | The post owner marked your response as not a match | 投稿者が「人違いの可能性あり」と判定しました",
          text: buildTrilingualBody({
            zh: "你好，\n\n你回覆的一篇貼文已被作者標記為「可能認錯了」。\n若仍符合條件，可依網站說明再次嘗試。",
            en: "Hello,\n\nThe post owner marked your response as \"possibly not a match\".\nIf you still think it matches, you may try again according to the app instructions.",
            ja: "こんにちは。\n\nあなたの返信は投稿者に「人違いの可能性あり」と判定されました。\n条件に当てはまる場合は、サイトの案内に沿って再度お試しください。",
            postId,
          }),
        });
      }
      console.log(`${LOG} SUCCESS`, kind, resendBody);
      return new Response(JSON.stringify({ ok: true, resend: resendBody }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`${LOG} ABORT: unsupported kind`, kind);
    return new Response(JSON.stringify({ error: "Unsupported kind" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.log(`${LOG} EXCEPTION`, String(e?.message || e));
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
