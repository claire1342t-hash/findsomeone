import { app } from "./firebase.js";

let authInstance = null;

/** Loads Firebase Auth on demand (defers auth iframe until needed). */
export async function getFirebaseAuth() {
  if (!authInstance) {
    const { getAuth } = await import("firebase/auth");
    authInstance = getAuth(app);
  }
  return authInstance;
}
