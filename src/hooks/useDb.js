import { useEffect, useState } from "react";
import { getDb } from "../lib/firebaseApp.js";

/**
 * @returns {import("firebase/firestore").Firestore | null}
 */
export function useDb() {
  const [db, setDb] = useState(null);

  useEffect(() => {
    let active = true;
    getDb().then((instance) => {
      if (active) setDb(instance);
    });
    return () => {
      active = false;
    };
  }, []);

  return db;
}
