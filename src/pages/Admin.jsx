import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useDb } from "../hooks/useDb.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { formatReportReason } from "../i18n/reportReasons.js";
import { getPostExpiryBadge, isPostExpired, deletePostCascade } from "../utils/postLifecycle.js";
import "./Admin.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCALE_BY_LANG = { zh: "zh-TW", en: "en-US", ja: "ja-JP" };

function formatDate(timestamp, language) {
  const date = timestamp?.toDate?.();
  if (!date) return "—";
  const locale = LOCALE_BY_LANG[language] || LOCALE_BY_LANG.zh;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getPostTitle(post, t) {
  const line = String(post?.description?.appearance ?? "")
    .split(/\r?\n/)[0]
    .trim();
  return line || t("admin.post.noTitle");
}

function getPostLocation(post) {
  const locText = String(post?.locationDescription ?? "").trim();
  if (locText) return locText;
  const lat = Number(post?.location?.lat);
  const lng = Number(post?.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return "—";
}

function isDeletedUser(userDoc) {
  return userDoc?.isDeleted === true || userDoc?.deleted === true || !!userDoc?.deletedAt;
}

function getExpiryStatusLabel(post, t) {
  if (post.isPinned) return t("admin.expiry.pinned");
  if (isPostExpired(post.createdAt, post.isPinned === true)) return t("admin.expiry.expired");
  const badge = getPostExpiryBadge(post.createdAt, undefined, post.isPinned === true);
  if (badge?.textKey === "chat.expiresBadgeThree") return t("admin.expiry.days3");
  if (badge?.textKey === "chat.expiresBadgeTwo") return t("admin.expiry.days2");
  if (badge?.textKey === "chat.expiresBadgeOne") return t("admin.expiry.days1");
  if (badge?.textKey === "chat.expiresBadgeLessOne") return t("admin.expiry.lessOne");
  return t("admin.expiry.active");
}

export default function AdminPage() {
  const { language, t } = useLanguage();
  const { user, loading } = useAuth();
  const db = useDb();
  const navigate = useNavigate();
  const [nowMs] = useState(() => Date.now());
  const [ready, setReady] = useState(false);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [reports, setReports] = useState([]);
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [actionBusy, setActionBusy] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !db) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!active) return;
        if (!snap.exists() || snap.data()?.isAdmin !== true) {
          navigate("/", { replace: true });
          return;
        }
        setReady(true);
      } catch (e) {
        console.error("admin access check", e);
        navigate("/", { replace: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [loading, navigate, user, db]);

  useEffect(() => {
    if (!ready || !db) return undefined;
    const unsubs = [
      onSnapshot(collection(db, "posts"), (snap) => {
        setPosts(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }),
      onSnapshot(collection(db, "users"), (snap) => {
        setUsers(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }),
      onSnapshot(collection(db, "chats"), (snap) => {
        setChats(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }),
      onSnapshot(collection(db, "reports"), (snap) => {
        setReports(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      }),
    ];
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [ready, db]);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);
  const chatsById = useMemo(() => {
    const map = new Map();
    chats.forEach((c) => map.set(c.id, c));
    return map;
  }, [chats]);
  const postsById = useMemo(() => {
    const map = new Map();
    posts.forEach((p) => map.set(p.id, p));
    return map;
  }, [posts]);

  const postCountByUser = useMemo(() => {
    const map = new Map();
    posts.forEach((p) => {
      const uid = p.authorUid;
      if (!uid) return;
      map.set(uid, (map.get(uid) || 0) + 1);
    });
    return map;
  }, [posts]);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const tb = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
        return tb - ta;
      }),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const keyword = postSearchQuery.trim().toLowerCase();
    if (!keyword) return sortedPosts;
    return sortedPosts.filter((post) => getPostTitle(post, t).toLowerCase().includes(keyword));
  }, [postSearchQuery, sortedPosts]);

  const activeUsers = useMemo(
    () =>
      users
        .map((item) => ({ ...item, _postCount: postCountByUser.get(item.id) || 0 }))
        .filter((item) => item._postCount > 10)
        .sort((a, b) => b._postCount - a._postCount),
    [postCountByUser, users],
  );

  const totalUsersExcludeDeleted = useMemo(
    () => users.filter((item) => !isDeletedUser(item)).length,
    [users],
  );

  const sortedReports = useMemo(
    () =>
      [...reports].sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const tb = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
        return tb - ta;
      }),
    [reports],
  );

  const stats = useMemo(() => {
    const recentCutoff = nowMs - 7 * DAY_MS;
    const recentPosts = posts.filter((post) => {
      const created = post.createdAt?.toDate?.()?.getTime?.();
      return typeof created === "number" && created >= recentCutoff;
    }).length;
    return {
      totalUsersExcludeDeleted,
      totalPosts: posts.length,
      totalMatches: chats.length,
      recentPosts,
    };
  }, [chats.length, nowMs, posts, totalUsersExcludeDeleted]);

  const setBusy = (key, busy) => {
    setActionBusy((prev) => ({ ...prev, [key]: busy }));
  };

  const handleDeletePost = async (post) => {
    const confirmed = window.confirm(t("admin.confirm.deletePost"));
    if (!confirmed) return;
    const key = `delete-post-${post.id}`;
    setBusy(key, true);
    setError("");
    try {
      await deletePostCascade(post.id, post.authorUid || "");
    } catch (e) {
      console.error("delete post", e);
      setError(t("admin.error.deletePost"));
    } finally {
      setBusy(key, false);
    }
  };

  const handleTogglePinned = async (post) => {
    if (!db) return;
    const key = `pin-post-${post.id}`;
    setBusy(key, true);
    setError("");
    try {
      await updateDoc(doc(db, "posts", post.id), { isPinned: !post.isPinned });
    } catch (e) {
      console.error("toggle pin", e);
      setError(t("admin.error.pin"));
    } finally {
      setBusy(key, false);
    }
  };

  const handleUpdateReportStatus = async (reportId, status) => {
    if (!db) return;
    const key = `report-${reportId}-${status}`;
    setBusy(key, true);
    setError("");
    try {
      await updateDoc(doc(db, "reports", reportId), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid || "",
      });
    } catch (e) {
      console.error("update report", e);
      setError(t("admin.error.report"));
    } finally {
      setBusy(key, false);
    }
  };

  if (!ready) return null;

  return (
    <div className="home-page app-shell admin-page">
      <SiteHeader />
      <main className="admin-main">
        <section className="admin-section">
          <h1 className="admin-title">{t("admin.title")}</h1>
          {error ? <p className="admin-error">{error}</p> : null}
          <div className="admin-stats-grid">
            <article className="admin-stat-card">
              <p>{t("admin.stat.users")}</p>
              <strong>{stats.totalUsersExcludeDeleted}</strong>
            </article>
            <article className="admin-stat-card">
              <p>{t("admin.stat.posts")}</p>
              <strong>{stats.totalPosts}</strong>
            </article>
            <article className="admin-stat-card">
              <p>{t("admin.stat.matches")}</p>
              <strong>{stats.totalMatches}</strong>
            </article>
            <article className="admin-stat-card">
              <p>{t("admin.stat.recentPosts")}</p>
              <strong>{stats.recentPosts}</strong>
            </article>
          </div>
        </section>

        <section className="admin-section">
          <h2>{t("admin.posts.title")}</h2>
          <div className="admin-search-row">
            <input
              type="text"
              className="admin-search-input"
              placeholder={t("admin.posts.searchPh")}
              value={postSearchQuery}
              onChange={(e) => setPostSearchQuery(e.target.value)}
            />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("admin.table.title")}</th>
                  <th>{t("admin.table.author")}</th>
                  <th>{t("admin.table.location")}</th>
                  <th>{t("admin.table.created")}</th>
                  <th>{t("admin.table.expiry")}</th>
                  <th>{t("admin.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => {
                  const author = usersById.get(post.authorUid);
                  const expiryStatus = getExpiryStatusLabel(post, t);
                  return (
                    <tr key={post.id}>
                      <td>{getPostTitle(post, t)}</td>
                      <td>{author?.email || post.authorUid || "—"}</td>
                      <td>{getPostLocation(post)}</td>
                      <td>{formatDate(post.createdAt, language)}</td>
                      <td>{expiryStatus}</td>
                      <td className="admin-actions-cell">
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post)}
                          disabled={!!actionBusy[`delete-post-${post.id}`]}
                        >
                          {t("admin.post.delete")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePinned(post)}
                          disabled={!!actionBusy[`pin-post-${post.id}`]}
                        >
                          {post.isPinned ? t("admin.post.unpin") : t("admin.post.pin")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>{t("admin.users.title")}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("admin.table.email")}</th>
                  <th>{t("admin.table.joinDate")}</th>
                  <th>{t("admin.table.postCount")}</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((item) => (
                  <tr key={item.id}>
                    <td>{item.email || "—"}</td>
                    <td>{formatDate(item.createdAt, language)}</td>
                    <td>{item._postCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>{t("admin.reports.title")}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("admin.table.reportedTitle")}</th>
                  <th>{t("admin.table.reporter")}</th>
                  <th>{t("admin.table.reason")}</th>
                  <th>{t("admin.table.submitted")}</th>
                  <th>{t("admin.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((report) => {
                  const reportedPost = report.type === "post" ? postsById.get(report.targetId) : null;
                  const reporter = usersById.get(report.reportedBy);
                  const reportedChat = report.type === "chat" ? chatsById.get(report.targetId) : null;
                  const reportedUid =
                    report.type === "chat" && reportedChat
                      ? report.reportedBy === reportedChat.posterUid
                        ? reportedChat.responderUid
                        : reportedChat.posterUid
                      : null;
                  const reportedUser = reportedUid ? usersById.get(reportedUid) : null;
                  const reportedTitle =
                    report.type === "post"
                      ? reportedPost
                        ? getPostTitle(reportedPost, t)
                        : t("admin.report.unavailablePost")
                      : reportedUser?.email || t("admin.report.unavailableUser");
                  const reasonText = formatReportReason(report.reason, report.reasonDetail, t) || "—";
                  const isResolved = report.status === "resolved";
                  return (
                    <tr key={report.id}>
                      <td>{reportedTitle}</td>
                      <td>{reporter?.email || "—"}</td>
                      <td>{reasonText}</td>
                      <td>{formatDate(report.createdAt, language)}</td>
                      <td className="admin-actions-cell">
                        <button
                          type="button"
                          className={`admin-report-resolve-btn ${isResolved ? "is-done" : "is-pending"}`}
                          onClick={() => handleUpdateReportStatus(report.id, "resolved")}
                          disabled={isResolved || !!actionBusy[`report-${report.id}-resolved`]}
                        >
                          {t("admin.report.resolved")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
