import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
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
 * All response docs for this user (responderUid field OR legacy doc id == uid).
 * @param {import("firebase/firestore").Firestore} db
 */
export async function fetchResponderResponseDocs(db, uid) {
  const [byField, byDocId] = await Promise.all([
    getDocs(query(collectionGroup(db, "responses"), where("responderUid", "==", uid))),
    getDocs(query(collectionGroup(db, "responses"), where(documentId(), "==", uid))),
  ]);
  const byPath = new Map();
  for (const responseDoc of [...byField.docs, ...byDocId.docs]) {
    byPath.set(responseDoc.ref.path, responseDoc);
  }
  return [...byPath.values()];
}

/**
 * @param {import("firebase/firestore").Firestore} db
 * @param {string} userUid
 * @param {import("firebase/firestore").QueryDocumentSnapshot[]} responseDocs
 */
export async function enrichResponseDocs(db, userUid, responseDocs) {
  const enriched = await Promise.all(
    responseDocs.map(async (responseDoc) => {
      const postRef = responseDoc.ref.parent?.parent;
      const postId = postRef?.id;
      const responseData = responseDoc.data();
      const path = responseDoc.ref.path;

      if (!postId) {
        return {
          path,
          response: responseData,
          post: null,
          chatDeleted: false,
        };
      }

      try {
        const postSnap = await getDoc(doc(db, "posts", postId));
        const chatId = typeof responseData.chatId === "string" ? responseData.chatId : "";
        let chatDeleted = false;
        if (chatId) {
          const chatSnap = await getDoc(doc(db, "chats", chatId));
          chatDeleted = !chatSnap.exists();
        }
        return {
          path,
          response: responseData,
          post: postSnap.exists() ? { id: postSnap.id, ...postSnap.data() } : null,
          chatDeleted,
        };
      } catch (err) {
        console.error("[repliedPosts] enrich response failed", postId, err);
        return {
          path,
          response: responseData,
          post: null,
          chatDeleted: false,
        };
      }
    }),
  );

  enriched.sort((a, b) => {
    const ta = a.response?.createdAt?.toDate?.()?.getTime?.() ?? 0;
    const tb = b.response?.createdAt?.toDate?.()?.getTime?.() ?? 0;
    return tb - ta;
  });
  return enriched;
}

/**
 * @param {import("firebase/firestore").Firestore} db
 * @param {string} userUid
 * @param {import("firebase/firestore").QueryDocumentSnapshot[]} indexDocs
 */
export async function enrichRepliedPostIndexDocs(db, userUid, indexDocs) {
  const rows = await Promise.all(
    indexDocs.map(async (indexDoc) => {
      const postId = indexDoc.id;
      const index = indexDoc.data();
      const path = `posts/${postId}/responses/${userUid}`;
      try {
        const postSnap = await getDoc(doc(db, "posts", postId));
        const chatId = typeof index.chatId === "string" ? index.chatId : "";
        let chatDeleted = false;
        if (chatId) {
          const chatSnap = await getDoc(doc(db, "chats", chatId));
          chatDeleted = !chatSnap.exists();
        }
        return {
          path,
          response: {
            status: index.status,
            attemptCount: index.attemptCount,
            createdAt: index.respondedAt,
            chatId,
          },
          post: postSnap.exists() ? { id: postSnap.id, ...postSnap.data() } : null,
          chatDeleted,
        };
      } catch (err) {
        console.error("[repliedPosts] enrich index failed", postId, err);
        return {
          path,
          response: {
            status: index.status,
            attemptCount: index.attemptCount,
            createdAt: index.respondedAt,
            chatId: index.chatId,
          },
          post: null,
          chatDeleted: false,
        };
      }
    }),
  );

  rows.sort((a, b) => {
    const ta = a.response?.createdAt?.toDate?.()?.getTime?.() ?? 0;
    const tb = b.response?.createdAt?.toDate?.()?.getTime?.() ?? 0;
    return tb - ta;
  });
  return rows;
}

/** Load from posts/.../responses via collectionGroup (source of truth). */
export async function loadRepliedPostsFromResponses(db, userUid) {
  const responseDocs = await fetchResponderResponseDocs(db, userUid);
  return enrichResponseDocs(db, userUid, responseDocs);
}

/**
 * One-time migration: copy collectionGroup responses into repliedPosts index.
 * @param {import("firebase/firestore").Firestore} db
 */
export async function backfillRepliedPostsIndex(db, uid) {
  const docs = await fetchResponderResponseDocs(db, uid);
  if (docs.length === 0) return 0;

  await Promise.all(
    docs.map(async (responseDoc) => {
      const postId = responseDoc.ref.parent?.parent?.id;
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
  return docs.length;
}
