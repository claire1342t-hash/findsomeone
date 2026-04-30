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

export async function deletePostCascade(postId, ownerUid) {
  const responsesSnap = await getDocs(collection(db, "posts", postId, "responses"));
  const chatIds = new Set();
  responsesSnap.docs.forEach((d) => {
    const id = d.data()?.chatId;
    if (typeof id === "string" && id) chatIds.add(id);
  });

  const chatsSnap = await getDocs(query(collection(db, "chats"), where("postId", "==", postId)));
  chatsSnap.docs.forEach((d) => chatIds.add(d.id));

  await Promise.allSettled(responsesSnap.docs.map((d) => deleteDoc(d.ref)));
  await Promise.allSettled(Array.from(chatIds).map((chatId) => deleteChatCascade(chatId)));
  await deleteDoc(doc(db, "posts", postId));

  if (ownerUid) {
    await deleteDoc(doc(db, "users", ownerUid, "ownedPosts", postId));
  }
}
