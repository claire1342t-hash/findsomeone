import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase.js";

const POST_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 86400000;

/**
 * Chat expiry badge (expiresAt field). Same i18n keys as post expiry badges.
 * @returns {{ textKey: string, tone: "gray" | "orange" | "red" } | null}
 */
export function getChatExpiryBadge(expiresAt, now = new Date()) {
  if (!expiresAt?.toDate) return null;
  const msLeft = expiresAt.toDate().getTime() - now.getTime();
  if (msLeft <= 0) return null;
  const ceilDays = Math.ceil(msLeft / MS_PER_DAY);
  if (ceilDays > 3) return null;
  if (ceilDays === 3) {
    return { textKey: "chat.expiresBadgeThree", tone: "gray" };
  }
  if (ceilDays === 2) {
    return { textKey: "chat.expiresBadgeTwo", tone: "orange" };
  }
  if (ceilDays === 1) {
    if (msLeft < MS_PER_DAY) {
      return { textKey: "chat.expiresBadgeLessOne", tone: "red" };
    }
    return { textKey: "chat.expiresBadgeOne", tone: "red" };
  }
  return null;
}

export function isPostExpired(createdAt, isPinned = false) {
  if (isPinned === true) return false;
  const createdMs = createdAt?.toDate?.()?.getTime?.();
  if (!createdMs) return false;
  return Date.now() - createdMs >= POST_EXPIRE_MS;
}

/**
 * Same rules as chat list: badge only when ≤3 days remain until post expiry (createdAt + 7 days).
 * Reuses i18n keys `chat.expiresBadge*`.
 *
 * @returns {{ textKey: string, tone: "gray" | "orange" | "red" } | null}
 */
export function getPostExpiryBadge(createdAt, now = new Date(), isPinned = false) {
  if (isPinned === true) return null;
  const createdMs = createdAt?.toDate?.()?.getTime?.();
  if (!createdMs) return null;
  const expireMs = createdMs + POST_EXPIRE_MS;
  const msLeft = expireMs - now.getTime();
  if (msLeft <= 0) return null;
  const ceilDays = Math.ceil(msLeft / MS_PER_DAY);
  if (ceilDays > 3) return null;
  if (ceilDays === 3) {
    return { textKey: "chat.expiresBadgeThree", tone: "gray" };
  }
  if (ceilDays === 2) {
    return { textKey: "chat.expiresBadgeTwo", tone: "orange" };
  }
  if (ceilDays === 1) {
    if (msLeft < MS_PER_DAY) {
      return { textKey: "chat.expiresBadgeLessOne", tone: "red" };
    }
    return { textKey: "chat.expiresBadgeOne", tone: "red" };
  }
  return null;
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
