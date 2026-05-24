import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useDb } from "../hooks/useDb.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { RouteFallback } from "../components/RouteFallback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useRestorePageScroll } from "../hooks/useRestorePageScroll.js";
import { formatRelativeSmart } from "../utils/relativeTime.js";
import { getChatExpiryBadge } from "../utils/postLifecycle.js";
import "./ChatList.css";

export default function ChatListPage() {
  const { t, language } = useLanguage();
  const { user, loading } = useAuth();
  const db = useDb();
  const navigate = useNavigate();
  const [posterChats, setPosterChats] = useState([]);
  const [responderChats, setResponderChats] = useState([]);
  useRestorePageScroll();

  useEffect(() => {
    if (loading || !db) return undefined;
    if (!user) {
      navigate("/login", { replace: true });
      return undefined;
    }
    const q1 = query(collection(db, "chats"), where("posterUid", "==", user.uid));
    const q2 = query(collection(db, "chats"), where("responderUid", "==", user.uid));
    const unsub1 = onSnapshot(q1, (snap) => {
      setPosterChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(q2, (snap) => {
      setResponderChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [loading, navigate, user, db]);

  const chats = useMemo(() => {
    const map = new Map();
    [...posterChats, ...responderChats].forEach((chat) => {
      map.set(chat.id, chat);
    });
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.updatedAt?.toDate?.()?.getTime?.() ?? a.createdAt?.toDate?.()?.getTime?.() ?? 0;
      const tb = b.updatedAt?.toDate?.()?.getTime?.() ?? b.createdAt?.toDate?.()?.getTime?.() ?? 0;
      return tb - ta;
    });
  }, [posterChats, responderChats]);

  if (loading || !user) {
    return (
      <div className="chat-list-page">
        <SiteHeader />
        <RouteFallback />
      </div>
    );
  }

  return (
    <div className="chat-list-page">
      <SiteHeader />
      <main className="chat-list-main">
        <h1 className="chat-list-title">{t("chat.listTitle")}</h1>
        {chats.length === 0 ? (
          <div className="chat-list-empty">
            <p>{t("chat.listEmpty")}</p>
            <Link to="/map">{t("chat.goMap")}</Link>
          </div>
        ) : (
          <ul className="chat-list">
            {chats.map((chat) => {
              const isPoster = user.uid === chat.posterUid;
              const partnerName = isPoster
                ? chat.responderAnonymousName || chat.responderName
                : chat.posterAnonymousName || chat.posterName;
              const lastPreview = chat.lastMessageText || t("chat.noMessagesYet");
              const mineRole = isPoster ? "poster" : "responder";
              const unread = chat.lastMessageSenderRole && chat.lastMessageSenderRole !== mineRole;
              const time = chat.updatedAt || chat.createdAt;
              const expiryBadge = getChatExpiryBadge(chat.expiresAt);
              return (
                <li key={chat.id}>
                  <Link className="chat-list-item" to={`/chat/${chat.id}`}>
                    <div className="chat-list-item__avatar">{(partnerName || "?").slice(0, 1)}</div>
                    <div className="chat-list-item__body">
                      <p className="chat-list-item__name">{partnerName || t("chat.anonymousPartner")}</p>
                      <p className="chat-list-item__preview">{lastPreview}</p>
                    </div>
                    <div className="chat-list-item__meta">
                      {expiryBadge ? (
                        <span
                          className={`chat-list-item__expiry chat-list-item__expiry--${expiryBadge.tone}`}
                        >
                          {t(expiryBadge.textKey)}
                        </span>
                      ) : null}
                      <span className="chat-list-item__time">{formatRelativeSmart(time, language)}</span>
                      {unread ? <span className="chat-list-item__dot" aria-hidden="true" /> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
