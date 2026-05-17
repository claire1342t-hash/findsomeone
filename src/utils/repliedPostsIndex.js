import {
  collection,
  collectionGroup,
  doc,
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

async function isChatDeleted(db, chatId) {
  if (!chatId) return false;
  try {
    const chatSnap = await getDoc(doc(db, "chats", chatId));
    return !chatSnap.exists();
  } catch {
    return true;
  }
}

/**
 * Load responses via users/{uid}/repliedPosts index + direct get on posts/.../responses/{uid}.
 * Does not use collectionGroup (avoids rules/list issues on the client hot path).
 * @param {import("firebase/firestore").Firestore} db
 */
export async function fetchResponderResponseDocs(db, uid) {
  const byPath = new Map();
  const indexSnap = await getDocs(collection(db, "users", uid, "repliedPosts"));

  await Promise.all(
    indexSnap.docs.map(async (indexDoc) => {
      const postId = indexDoc.id;
      const path = `posts/${postId}/responses/${uid}`;
      if (byPath.has(path)) return;
      try {
        const responseSnap = await getDoc(doc(db, "posts", postId, "responses", uid));
        if (responseSnap.exists()) {
          byPath.set(path, responseSnap);
        }
      } catch (err) {
        console.error("[repliedPosts] direct response read failed", postId, err);
      }
    }),
  );

  return [...byPath.values()];
}

/**
 * Optional discovery for backfill only (requires collection-group list rules).
 * @param {import("firebase/firestore").Firestore} db
 */
async function discoverResponsesViaCollectionGroup(db, uid) {
  try {
    const snap = await getDocs(
      query(collectionGroup(db, "responses"), where("responderUid", "==", uid)),
    );
    return snap.docs;
  } catch (err) {
    console.warn("[repliedPosts] collectionGroup discovery skipped", err);
    return [];
  }
}

/**
 * @param {import("firebase/firestore").Firestore} db
 * @param {string} userUid
 * @param {import("firebase/firestore").DocumentSnapshot[]} responseDocs
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
        const chatDeleted = await isChatDeleted(db, chatId);
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
        const postRef = doc(db, "posts", postId);
        const responseRef = doc(db, "posts", postId, "responses", userUid);
        const [postSnap, responseSnap] = await Promise.all([getDoc(postRef), getDoc(responseRef)]);

        const responseData = responseSnap.exists()
          ? responseSnap.data()
          : {
              status: index.status,
              attemptCount: index.attemptCount,
              createdAt: index.respondedAt,
              chatId: index.chatId,
            };

        const chatId = typeof responseData.chatId === "string" ? responseData.chatId : "";
        const chatDeleted = await isChatDeleted(db, chatId);

        return {
          path,
          response: responseData,
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

/** Load replied posts for Profile (index + direct reads only). */
export async function loadRepliedPostsFromResponses(db, userUid) {
  const responseDocs = await fetchResponderResponseDocs(db, userUid);
  return enrichResponseDocs(db, userUid, responseDocs);
}

/**
 * Populate users/{uid}/repliedPosts from collectionGroup (once), then return row count.
 * @param {import("firebase/firestore").Firestore} db
 */
export async function backfillRepliedPostsIndex(db, uid) {
  const discovered = await discoverResponsesViaCollectionGroup(db, uid);

  await Promise.all(
    discovered.map(async (responseDoc) => {
      const postId = responseDoc.ref.parent?.parent?.id;
      if (!postId) return;
      const data = responseDoc.data();
      if (!data.responderUid) {
        try {
          await setDoc(responseDoc.ref, { responderUid: uid }, { merge: true });
        } catch (err) {
          console.error("[repliedPosts] patch responderUid failed", postId, err);
        }
      }
      await upsertRepliedPostIndex(db, uid, postId, {
        respondedAt: data.createdAt || serverTimestamp(),
        status: data.status || "pending",
        attemptCount: data.attemptCount ?? 1,
        chatId: typeof data.chatId === "string" ? data.chatId : "",
      });
    }),
  );

  const docs = await fetchResponderResponseDocs(db, uid);
  return docs.length;
}
