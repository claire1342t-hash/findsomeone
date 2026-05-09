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
  where,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { formatRelativeSmart } from "../utils/relativeTime.js";
import { sendEmail } from "../utils/sendEmail.js";
import "./Chat.css";

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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("不當內容");
  const [reportOtherText, setReportOtherText] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSubmittedForChat, setReportSubmittedForChat] = useState(false);
  const messagesBottomRef = useRef(null);
  const inputRef = useRef(null);

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
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
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

  const submitChatReport = async () => {
    if (!chatId || !user) return;
    const trimmedOther = reportOtherText.trim();
    if (reportReason === "其他" && !trimmedOther) {
      setReportError("請填寫其他原因內容。");
      return;
    }
    setReportBusy(true);
    setReportError("");
    try {
      await addDoc(collection(db, "reports"), {
        type: "chat",
        targetId: chatId,
        reportedBy: user.uid,
        reason: reportReason,
        reasonDetail: reportReason === "其他" ? trimmedOther : "",
        createdAt: serverTimestamp(),
        status: "pending",
      });
      try {
        await sendEmail({ kind: "reportSubmitted", reportType: "chat", targetId: chatId });
      } catch (mailErr) {
        console.error("[Chat] report admin notify email failed", mailErr);
      }
      setReportSubmittedForChat(true);
      setReportReason("不當內容");
      setReportOtherText("");
    } catch (err) {
      console.error(err);
      setReportError(err.message || String(err));
    } finally {
      setReportBusy(false);
    }
  };

  const openChatReportModal = async () => {
    if (!chatId) return;
    setReportOpen(true);
    setReportError("");
    setReportReason("不當內容");
    setReportOtherText("");
    if (!user) {
      setReportSubmittedForChat(false);
      return;
    }
    try {
      const q = query(
        collection(db, "reports"),
        where("type", "==", "chat"),
        where("targetId", "==", chatId),
        where("reportedBy", "==", user.uid),
      );
      const snap = await getDocs(q);
      setReportSubmittedForChat(!snap.empty);
    } catch (err) {
      console.error(err);
      setReportSubmittedForChat(false);
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
                    <button
                      type="button"
                      className="chat-end-btn chat-report-btn"
                      onClick={openChatReportModal}
                    >
                      檢舉
                    </button>
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
                    {shouldShowTime ? <div className="chat-msg__time">{formatRelativeSmart(msg.createdAt, language, undefined, "")}</div> : null}
                  </article>
                );
              })}
              <div ref={messagesBottomRef} aria-hidden="true" />
            </div>

            <footer className="chat-input-row">
              <input
                ref={inputRef}
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
      {reportOpen ? (
        <div className="chat-report-modal-backdrop" role="dialog" aria-modal="true" aria-label="檢舉聊天室">
          <div className="chat-report-modal">
            <h3>檢舉聊天室</h3>
            {reportSubmittedForChat ? (
              <>
                <p className="chat-report-modal__ok">您的檢舉已送出，我們會盡快處理。</p>
                <div className="chat-report-modal__actions">
                  <button
                    type="button"
                    className="chat-report-modal__btn chat-report-modal__btn--primary"
                    onClick={() => {
                      setReportOpen(false);
                      setMenuOpen(false);
                    }}
                  >
                    確定
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="chat-report-modal__label">
                  原因
                  <select
                    className="chat-report-modal__select"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    <option value="不當內容">不當內容</option>
                    <option value="騷擾">騷擾</option>
                    <option value="垃圾訊息">垃圾訊息</option>
                    <option value="其他">其他</option>
                  </select>
                </label>
                {reportReason === "其他" ? (
                  <label className="chat-report-modal__label">
                    其他內容
                    <textarea
                      className="chat-report-modal__textarea"
                      value={reportOtherText}
                      onChange={(e) => setReportOtherText(e.target.value)}
                      placeholder="請輸入補充內容"
                    />
                  </label>
                ) : null}
                {reportError ? <p className="chat-report-modal__error">{reportError}</p> : null}
                <div className="chat-report-modal__actions">
                  <button
                    type="button"
                    className="chat-report-modal__btn chat-report-modal__btn--ghost"
                    onClick={() => setReportOpen(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="chat-report-modal__btn chat-report-modal__btn--primary"
                    disabled={reportBusy}
                    onClick={submitChatReport}
                  >
                    {reportBusy ? t("post.saving") : "送出檢舉"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
