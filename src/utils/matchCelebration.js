import confetti from "canvas-confetti";

const COLORS = ["#ff6b8a", "#ff9eb5", "#ff4d6d", "#fff", "#ffccd5"];
const SEEN_STORAGE_KEY = "findsomeone:matchCelebrationSeen";
/** Max wait before navigation / next step (confetti may finish sooner). */
const CELEBRATION_MAX_MS = 4000;

function fireFullScreenFallingConfetti() {
  const stripes = 12;
  const totalParticles = 720;
  const promises = [];
  for (let i = 0; i < stripes; i += 1) {
    const x = (i + 0.5) / stripes;
    const burst = confetti({
      particleCount: Math.max(14, Math.floor(totalParticles / stripes)),
      angle: 90,
      spread: 160,
      startVelocity: 32 + Math.random() * 12,
      gravity: 1.05,
      decay: 0.92,
      origin: { x, y: -0.08 },
      colors: COLORS,
      ticks: 450,
      zIndex: 260,
    });
    if (burst && typeof burst.then === "function") {
      promises.push(burst);
    }
  }
  return promises;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Full-screen confetti (fire-and-forget). For admin preview only. */
export function beginMatchCelebration() {
  let cancelled = false;
  const tConfetti = window.setTimeout(() => {
    if (!cancelled) fireFullScreenFallingConfetti();
  }, 100);
  return {
    cancel() {
      cancelled = true;
      window.clearTimeout(tConfetti);
    },
  };
}

/** Runs confetti immediately; resolves when bursts finish or after CELEBRATION_MAX_MS. */
export function runMatchCelebration() {
  const promises = fireFullScreenFallingConfetti();
  const allDone =
    promises.length > 0
      ? Promise.all(promises).catch(() => undefined)
      : Promise.resolve();
  return Promise.race([allDone, delay(CELEBRATION_MAX_MS)]);
}

function readSeenCelebrationKeys() {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

/** @param {string} responsePath Firestore path, e.g. posts/{id}/responses/{uid} */
export function markResponderCelebrationSeen(responsePath) {
  if (!responsePath) return;
  const seen = readSeenCelebrationKeys();
  seen.add(responsePath);
  localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seen]));
}

/** @param {string} responsePath */
export function hasSeenResponderCelebration(responsePath) {
  return readSeenCelebrationKeys().has(responsePath);
}

/**
 * Accepted responses the responder has not celebrated on Profile yet.
 * @param {{ path: string; response: { status?: string } }[]} repliedPosts
 */
export function getPendingResponderCelebrations(repliedPosts) {
  const seen = readSeenCelebrationKeys();
  return repliedPosts.filter((row) => {
    if (String(row.response?.status || "").toLowerCase() !== "accepted") return false;
    return row.path && !seen.has(row.path);
  });
}
