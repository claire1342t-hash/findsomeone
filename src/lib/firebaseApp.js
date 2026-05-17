const firebaseConfig = {
  apiKey: import.meta.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.REACT_APP_FIREBASE_APP_ID,
};

let appPromise = null;
/** @type {import("firebase/firestore").Firestore | null} */
let dbInstance = null;
/** @type {import("firebase/auth").Auth | null} */
let authInstance = null;

async function ensureApp() {
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ initializeApp }) => initializeApp(firebaseConfig));
  }
  return appPromise;
}

/** Firestore — loaded on demand (not on homepage initial bundle). */
export async function getDb() {
  if (!dbInstance) {
    const [{ getFirestore }, app] = await Promise.all([import("firebase/firestore"), ensureApp()]);
    dbInstance = getFirestore(app);
  }
  return dbInstance;
}

/** Auth — loads the Firebase auth iframe only when called. */
export async function getFirebaseAuth() {
  if (!authInstance) {
    const [{ getAuth }, app] = await Promise.all([import("firebase/auth"), ensureApp()]);
    authInstance = getAuth(app);
  }
  return authInstance;
}
