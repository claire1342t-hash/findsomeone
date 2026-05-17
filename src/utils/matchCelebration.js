import confetti from "canvas-confetti";

const COLORS = ["#ff6b8a", "#ff9eb5", "#ff4d6d", "#fff", "#ffccd5"];

function fireFullScreenFallingConfetti() {
  const stripes = 12;
  const totalParticles = 720;
  for (let i = 0; i < stripes; i += 1) {
    const x = (i + 0.5) / stripes;
    confetti({
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
  }
}

/** Full-screen confetti (canvas-confetti). Does not change page theme. */
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
