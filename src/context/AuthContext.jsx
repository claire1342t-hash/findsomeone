import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getDb, getFirebaseAuth } from "../lib/firebaseApp.js";
import { deferUntilIdle } from "../lib/deferUntilIdle.js";

const AuthContext = createContext(null);

const IDLE_AUTH_PATHS = new Set(["/", "/about"]);

async function syncUserDocument(user) {
  if (!user) return;
  const [{ doc, setDoc }, db] = await Promise.all([import("firebase/firestore"), getDb()]);
  const ref = doc(db, "users", user.uid);
  const emailNorm = String(user.email ?? "").trim().toLowerCase();
  await setDoc(
    ref,
    {
      email: emailNorm,
      displayName: user.displayName || (emailNorm ? emailNorm.split("@")[0] : "") || "User",
    },
    { merge: true },
  );
}

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authProfileEpoch, setAuthProfileEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    const startAuth = () => {
      if (cancelled) return;
      (async () => {
        const auth = await getFirebaseAuth();
        const { onAuthStateChanged } = await import("firebase/auth");
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
          setUser(nextUser);
          if (nextUser) {
            try {
              await syncUserDocument(nextUser);
            } catch (e) {
              console.error("syncUserDocument", e);
            }
          }
          setLoading(false);
        });
      })();
    };

    const cancelSchedule = IDLE_AUTH_PATHS.has(pathname)
      ? deferUntilIdle(startAuth)
      : (startAuth(), () => {});

    return () => {
      cancelled = true;
      cancelSchedule();
      unsubscribe();
    };
  }, [pathname]);

  const signOut = useCallback(async () => {
    const auth = await getFirebaseAuth();
    const { signOut: firebaseSignOut } = await import("firebase/auth");
    return firebaseSignOut(auth);
  }, []);

  const refreshAuthProfile = useCallback(async () => {
    const auth = await getFirebaseAuth();
    const { reload } = await import("firebase/auth");
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    try {
      await syncUserDocument(auth.currentUser);
    } catch (e) {
      console.error("syncUserDocument", e);
    }
    setAuthProfileEpoch((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signOut, refreshAuthProfile }),
    // authProfileEpoch: Firebase `reload()` mutates `user` in place; bump epoch so consumers re-read flags like emailVerified.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally depend on authProfileEpoch
    [user, loading, refreshAuthProfile, authProfileEpoch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
