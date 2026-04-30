import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./ChatList.css";

function formatRelativeTime(value) {
  if (!value?.toDate) return "—";
  const diffMs = Math.max(0, Date.now() - value.toDate().getTime());
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min}分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小時前`;
  const day = Math.floor(hr / 24);
  return `${day}天前`;
}

export default function ChatListPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [posterChats, setPosterChats] = useState([]);
  const [responderChats, setResponderChats] = useState([]);

  useEffect(() => {
    if (loading) return undefined;
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
  }, [loading, navigate, user]);

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

  if (loading || !user) return null;

  const randomHoverColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue} 85% 94%)`;
  };

  return (
    <div className="chat-list-page">
      <SiteHeader />
      <main className="chat-list-main">
        <h1 className="chat-list-title">聊天</h1>
        {chats.length === 0 ? (
          <div className="chat-list-empty">
            <p>還沒有聊天室，去地圖找找看吧！</p>
            <Link to="/map">前往地圖</Link>
          </div>
        ) : (
          <ul className="chat-list">
            {chats.map((chat) => {
              const isPoster = user.uid === chat.posterUid;
              const partnerName = isPoster
                ? chat.responderAnonymousName || chat.responderName
                : chat.posterAnonymousName || chat.posterName;
              const lastPreview = chat.lastMessageText || "尚無訊息";
              const mineRole = isPoster ? "poster" : "responder";
              const unread = chat.lastMessageSenderRole && chat.lastMessageSenderRole !== mineRole;
              const time = chat.updatedAt || chat.createdAt;
              return (
                <li key={chat.id}>
                  <Link
                    className="chat-list-item"
                    to={`/chat/${chat.id}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.setProperty("--chat-hover-bg", randomHoverColor());
                    }}
                  >
                    <div className="chat-list-item__avatar">{(partnerName || "?").slice(0, 1)}</div>
                    <div className="chat-list-item__body">
                      <p className="chat-list-item__name">{partnerName || "匿名夥伴"}</p>
                      <p className="chat-list-item__preview">{lastPreview}</p>
                    </div>
                    <div className="chat-list-item__meta">
                      <span className="chat-list-item__time">{formatRelativeTime(time)}</span>
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
