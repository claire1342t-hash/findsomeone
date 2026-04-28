import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

const AuthContext = createContext(null);

async function syncUserDocument(user) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  await setDoc(
    ref,
    {
      email: user.email ?? "",
      displayName: user.displayName || user.email?.split("@")[0] || "User",
    },
    { merge: true },
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
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
  }, []);

  const signOut = () => firebaseSignOut(auth);

  const value = useMemo(() => ({ user, loading, signOut }), [user, loading]);

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
