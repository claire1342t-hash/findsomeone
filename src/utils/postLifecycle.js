import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";

const POST_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

export function isPostExpired(createdAt) {
  const createdMs = createdAt?.toDate?.()?.getTime?.();
  if (!createdMs) return false;
  return Date.now() - createdMs >= POST_EXPIRE_MS;
}

export async function deleteChatCascade(chatId) {
  const messagesSnap = await getDocs(collection(db, "chats", chatId, "messages"));
  await Promise.allSettled(messagesSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "chats", chatId));
}

/**
 * Chats linked to this post still in their window (expiresAt in the future, or missing).
 */
export async function hasActiveChatsForPost(postId) {
  const chatsSnap = await getDocs(query(collection(db, "chats"), where("postId", "==", postId)));
  const now = Date.now();
  for (const d of chatsSnap.docs) {
    const expMs = d.data()?.expiresAt?.toDate?.()?.getTime?.();
    if (expMs == null || expMs > now) return true;
  }
  return false;
}

/** Deletes the post, all response subdocs, and ownedPosts index entry. Does not delete chats. */
export async function deletePostCascade(postId, ownerUid) {
  const responsesSnap = await getDocs(collection(db, "posts", postId, "responses"));
  await Promise.allSettled(responsesSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "posts", postId));

  if (ownerUid) {
    await deleteDoc(doc(db, "users", ownerUid, "ownedPosts", postId));
  }
}
