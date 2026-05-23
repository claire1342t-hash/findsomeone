import { doc, getDoc } from "firebase/firestore";

/** @param {import("firebase/firestore").Firestore} db */
export async function isUserBanned(db, uid) {
  if (!db || !uid) return false;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() && snap.data()?.isBanned === true;
}

/** @param {import("firebase/firestore").Firestore} db */
export async function ensureUserNotBanned(db, uid) {
  if (await isUserBanned(db, uid)) {
    const err = new Error("user banned");
    err.code = "app/user-banned";
    throw err;
  }
}
