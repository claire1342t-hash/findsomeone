import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useDb } from "../hooks/useDb.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { RouteFallback } from "../components/RouteFallback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { formatRelativeSmart } from "../utils/relativeTime.js";
import { sendEmail } from "../utils/sendEmail.js";
import { deleteChatCascade } from "../utils/postLifecycle.js";
import { ensureUserNotBanned } from "../utils/userBan.js";
import { beginMatchCelebration } from "../utils/matchCelebration.js";
import { useRestorePageScroll } from "../hooks/useRestorePageScroll.js";
import {
  DEFAULT_REPORT_REASON,
  isOtherReportReason,
  REPORT_REASON_OPTIONS,
} from "../i18n/reportReasons.js";
import "./Chat.css";

const TIME_GROUP_MS = 3 * 60 * 1000;
const SYSTEM_MSG_PARTNER_ENDED = "partnerEnded";

function systemMessageText(msg, t) {
  if (msg.text === SYSTEM_MSG_PARTNER_ENDED) {
    return t("chat.system.partnerEnded");
  }
  return msg.text;
}

function toMillis(value) {
  return value?.toDate?.()?.getTime?.() ?? null;
}

export default function ChatPage() {
  const { t, language } = useLanguage();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const db = useDb();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(DEFAULT_REPORT_REASON);
  const [reportOtherText, setReportOtherText] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSubmittedForChat, setReportSubmittedForChat] = useState(false);
  const [messagesReady, setMessagesReady] = useState(false);
  const messagesBottomRef = useRef(null);
  const inputRef = useRef(null);
  const celebrationCancelRef = useRef(null);
  useRestorePageScroll();

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

  useEffect(() => {
    if (loading || !db) return undefined;
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
          await deleteChatCascade(chatId);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      setExpired(false);
      setChat(data);
    });
  }, [chatId, loading, navigate, user, db]);

  useEffect(() => {
    if (!chatId || !db) return undefined;
    setMessagesReady(false);
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMessagesReady(true);
    });
  }, [chatId, db]);

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, chatId]);

  useEffect(() => {
    if (!user || !chat || !chatId || !senderRole || expired || !messagesReady) return undefined;

    const storageKey = `celebrated_${chatId}`;
    if (localStorage.getItem(storageKey)) return undefined;
    if (messages.length > 0) return undefined;

    try {
      localStorage.setItem(storageKey, "true");
    } catch (err) {
      console.error("[Chat] celebration localStorage failed", err);
    }

    celebrationCancelRef.current?.cancel();
    const { cancel } = beginMatchCelebration();
    celebrationCancelRef.current = cancel;

    return () => {
      celebrationCancelRef.current?.cancel();
      celebrationCancelRef.current = null;
    };
  }, [user, chat, chatId, senderRole, expired, messagesReady, messages.length]);

  const sendMessage = async () => {
    if (!db || !chatId || !senderRole) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await ensureUserNotBanned(db, user.uid);
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
    if (!ok || !chatId || !db) return;
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderRole: "system",
        text: SYSTEM_MSG_PARTNER_ENDED,
        createdAt: serverTimestamp(),
      });
      await new Promise((resolve) => {
        window.setTimeout(resolve, 1000);
      });
      await deleteChatCascade(chatId);
      navigate("/profile", { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  const submitChatReport = async () => {
    if (!db || !chatId || !user) return;
    const trimmedOther = reportOtherText.trim();
    if (isOtherReportReason(reportReason) && !trimmedOther) {
      setReportError(t("report.errorOtherRequired"));
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
        reasonDetail: isOtherReportReason(reportReason) ? trimmedOther : "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "pending",
      });
      try {
        await sendEmail({ kind: "reportSubmitted", reportType: "chat", targetId: chatId });
      } catch (mailErr) {
        console.error("[Chat] report admin notify email failed", mailErr);
      }
      setReportSubmittedForChat(true);
      setReportReason(DEFAULT_REPORT_REASON);
      setReportOtherText("");
    } catch (err) {
      console.error(err);
      setReportError(err.message || String(err));
    } finally {
      setReportBusy(false);
    }
  };

  const openChatReportModal = async () => {
    if (!db || !chatId) return;
    setReportOpen(true);
    setReportError("");
    setReportReason(DEFAULT_REPORT_REASON);
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

  if (loading || !user) {
    return (
      <div className="chat-page">
        <SiteHeader />
        <RouteFallback />
      </div>
    );
  }

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
                <button
                  type="button"
                  className="chat-menu-btn"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={t("chat.menuAria")}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div className="chat-menu">
                    <button
                      type="button"
                      className="chat-end-btn chat-report-btn"
                      onClick={openChatReportModal}
                    >
                      {t("report.menu")}
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
                if (msg.senderRole === "system") {
                  return (
                    <p key={msg.id} className="chat-msg-system">
                      {systemMessageText(msg, t)}
                    </p>
                  );
                }
                const mine = msg.senderRole === senderRole;
                const next = messages[index + 1];
                const currentMs = toMillis(msg.createdAt);
                const nextMs = toMillis(next?.createdAt);
                const isSameSenderBurst =
                  !!next &&
                  next.senderRole !== "system" &&
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
              <button type="button" onClick={sendMessage} aria-label={t("chat.sendAria")}>
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
        <div className="chat-report-modal-backdrop" role="dialog" aria-modal="true" aria-label={t("report.chat.aria")}>
          <div className="chat-report-modal">
            <h3>{t("report.chat.title")}</h3>
            {reportSubmittedForChat ? (
              <>
                <p className="chat-report-modal__ok">{t("report.success")}</p>
                <div className="chat-report-modal__actions">
                  <button
                    type="button"
                    className="chat-report-modal__btn chat-report-modal__btn--primary"
                    onClick={() => {
                      setReportOpen(false);
                      setMenuOpen(false);
                    }}
                  >
                    {t("report.confirm")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="chat-report-modal__label">
                  {t("report.reason.label")}
                  <select
                    className="chat-report-modal__select"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    {REPORT_REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                {isOtherReportReason(reportReason) ? (
                  <label className="chat-report-modal__label">
                    {t("report.other.label")}
                    <textarea
                      className="chat-report-modal__textarea"
                      value={reportOtherText}
                      onChange={(e) => setReportOtherText(e.target.value)}
                      placeholder={t("report.other.placeholder")}
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
                    {t("report.cancel")}
                  </button>
                  <button
                    type="button"
                    className="chat-report-modal__btn chat-report-modal__btn--primary"
                    disabled={reportBusy}
                    onClick={submitChatReport}
                  >
                    {reportBusy ? t("post.saving") : t("report.submit")}
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
