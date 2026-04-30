import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import "./Chat.css";

function formatRelativeTime(value, language) {
  if (!value?.toDate) return "";
  const diffMs = Math.max(0, Date.now() - value.toDate().getTime());
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return language === "en" ? "Just now" : language === "ja" ? "たった今" : "剛剛";
  if (min < 60) return language === "en" ? `${min}m ago` : language === "ja" ? `${min}分前` : `${min}分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return language === "en" ? `${hr}h ago` : language === "ja" ? `${hr}時間前` : `${hr}小時前`;
  const day = Math.floor(hr / 24);
  return language === "en" ? `${day}d ago` : language === "ja" ? `${day}日前` : `${day}天前`;
}

const TIME_GROUP_MS = 3 * 60 * 1000;

function toMillis(value) {
  return value?.toDate?.()?.getTime?.() ?? null;
}

export default function ChatPage() {
  const { t, language } = useLanguage();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const messagesBottomRef = useRef(null);

  const senderRole = useMemo(() => {
    if (!user || !chat) return null;
    if (user.uid === chat.posterUid) return "poster";
    if (user.uid === chat.responderUid) return "responder";
    return null;
  }, [user, chat]);

  const partnerName = useMemo(() => {
    if (!chat || !senderRole) return "";
    return senderRole === "poster"
      ? chat.responderAnonymousName || chat.responderName
      : chat.posterAnonymousName || chat.posterName;
  }, [chat, senderRole]);

  const deleteChatCompletely = async (id) => {
    const messagesRef = collection(db, "chats", id, "messages");
    const snap = await getDocs(messagesRef);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "chats", id));
  };

  useEffect(() => {
    if (loading) return undefined;
    if (!user) {
      navigate("/login", { replace: true });
      return undefined;
    }
    if (!chatId) {
      navigate("/profile", { replace: true });
      return undefined;
    }
    return onSnapshot(doc(db, "chats", chatId), async (snap) => {
      if (!snap.exists()) {
        setChat(null);
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      const expireAt = data.expiresAt?.toDate?.();
      if (expireAt && expireAt.getTime() <= Date.now()) {
        setExpired(true);
        try {
          await deleteChatCompletely(chatId);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      setExpired(false);
      setChat(data);
    });
  }, [chatId, loading, navigate, user]);

  useEffect(() => {
    if (!chatId) return undefined;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [chatId]);

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatId]);

  const sendMessage = async () => {
    if (!chatId || !senderRole) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderRole,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "chats", chatId),
        {
          lastMessageText: trimmed,
          lastMessageSenderRole: senderRole,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setText("");
    } catch (err) {
      console.error(err);
    }
  };

  const endChat = async () => {
    const ok = window.confirm(t("chat.endWarning"));
    if (!ok || !chatId) return;
    try {
      await deleteChatCompletely(chatId);
      navigate("/profile", { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="chat-page">
      <SiteHeader />
      <main className="chat-main">
        {expired ? (
          <div className="chat-ended">{t("chat.ended")}</div>
        ) : !chat ? (
          <div className="chat-ended">{t("chat.notFound")}</div>
        ) : (
          <section className="chat-card">
            <header className="chat-card__header">
              <h1>{partnerName || t("chat.anonymousPartner")}</h1>
              <div className="chat-menu-wrap">
                <button type="button" className="chat-menu-btn" onClick={() => setMenuOpen((v) => !v)}>
                  ⋯
                </button>
                {menuOpen ? (
                  <div className="chat-menu">
                    <button type="button" className="chat-end-btn" onClick={endChat}>
                      {t("chat.endButton")}
                    </button>
                    <p>{t("chat.endWarning")}</p>
                  </div>
                ) : null}
              </div>
            </header>

            <div className="chat-messages">
              {messages.map((msg, index) => {
                const mine = msg.senderRole === senderRole;
                const next = messages[index + 1];
                const currentMs = toMillis(msg.createdAt);
                const nextMs = toMillis(next?.createdAt);
                const isSameSenderBurst =
                  !!next &&
                  next.senderRole === msg.senderRole &&
                  currentMs != null &&
                  nextMs != null &&
                  nextMs - currentMs <= TIME_GROUP_MS;
                const shouldShowTime = !isSameSenderBurst;
                return (
                  <article key={msg.id} className={`chat-msg ${mine ? "is-mine" : "is-their"}`}>
                    <div className="chat-msg__bubble">{msg.text}</div>
                    {shouldShowTime ? <div className="chat-msg__time">{formatRelativeTime(msg.createdAt, language)}</div> : null}
                  </article>
                );
              })}
              <div ref={messagesBottomRef} aria-hidden="true" />
            </div>

            <footer className="chat-input-row">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("chat.inputPlaceholder")}
              />
              <button type="button" onClick={sendMessage}>
                ➤
              </button>
            </footer>
          </section>
        )}
        <Link className="chat-back-link" to="/profile">
          {t("chat.backToProfile")}
        </Link>
      </main>
    </div>
  );
}
