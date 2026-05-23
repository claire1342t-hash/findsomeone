/**
 * Derive Map verify UI flags from a response document snapshot.
 * @param {import("firebase/firestore").DocumentSnapshot | null | undefined} snap
 */
export function mapVerifyStateFromResponse(snap) {
  if (!snap?.exists()) {
    return { verifySubmitted: false, verifyLocked: false, previousRejectedOnce: false };
  }
  const data = snap.data();
  const status = String(data?.status || "");
  const attemptCount = Number(data?.attemptCount || 1);
  if (status === "rejected" && attemptCount >= 2) {
    return { verifySubmitted: false, verifyLocked: true, previousRejectedOnce: false };
  }
  if (status === "rejected" && attemptCount === 1) {
    return { verifySubmitted: false, verifyLocked: false, previousRejectedOnce: true };
  }
  if (status === "accepted") {
    return { verifySubmitted: true, verifyLocked: false, previousRejectedOnce: false };
  }
  return { verifySubmitted: true, verifyLocked: false, previousRejectedOnce: false };
}
