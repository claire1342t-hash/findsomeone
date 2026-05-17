import {
  collectionGroup,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

/** @param {import("firebase/firestore").Firestore} db */
export function repliedPostIndexRef(db, uid, postId) {
  return doc(db, "users", uid, "repliedPosts", postId);
}

/**
 * Mirror a map response into users/{uid}/repliedPosts for fast Profile listing.
 * @param {import("firebase/firestore").Firestore} db
 */
export async function upsertRepliedPostIndex(db, uid, postId, fields) {
  await setDoc(repliedPostIndexRef(db, uid, postId), fields, { merge: true });
}

/**
 * One-time migration: copy collectionGroup responses into repliedPosts index.
 * @param {import("firebase/firestore").Firestore} db
 */
export async function backfillRepliedPostsIndex(db, uid) {
  const q = query(collectionGroup(db, "responses"), where("responderUid", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  await Promise.all(
    snap.docs.map(async (responseDoc) => {
      const postRef = responseDoc.ref.parent?.parent;
      const postId = postRef?.id;
      if (!postId) return;
      const data = responseDoc.data();
      await upsertRepliedPostIndex(db, uid, postId, {
        respondedAt: data.createdAt || serverTimestamp(),
        status: data.status || "pending",
        attemptCount: data.attemptCount ?? 1,
        chatId: typeof data.chatId === "string" ? data.chatId : "",
      });
    }),
  );
  return snap.size;
}
