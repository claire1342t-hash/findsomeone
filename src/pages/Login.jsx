import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { CustomCursor } from "../components/CustomCursor.jsx";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./Account.css";

const googleProvider = new GoogleAuthProvider();

/**
 * @param {unknown} err
 * @param {(key: string) => string} t
 * @returns {string | null} message to show, or null to clear / hide error
 */
function friendlyAuthError(err, t) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (code === "auth/popup-closed-by-user") {
    return null;
  }
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return t("login.errorWrongCredential");
  }
  if (code === "auth/user-not-found") {
    return t("login.errorUserNotFound");
  }
  if (code === "auth/email-already-in-use") {
    return t("login.errorEmailInUse");
  }
  if (code === "auth/invalid-email") {
    return t("login.errorInvalidEmail");
  }
  return t("login.errorGeneric");
}

function Login() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/profile", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        await getRedirectResult(auth);
      } catch (error) {
        if (!alive) return;
        const msg = friendlyAuthError(error, t);
        setError(msg === null ? "" : msg);
      } finally {
        if (alive) {
          setBusy(false);
        }
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [t]);

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (e) {
      setBusy(false);
      const msg = friendlyAuthError(e, t);
      setError(msg === null ? "" : msg);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const name = displayName.trim() || email.trim().split("@")[0] || "User";
        await updateProfile(cred.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      navigate("/profile", { replace: true });
    } catch (err) {
      const msg = friendlyAuthError(err, t);
      setError(msg === null ? "" : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home-page account-page app-shell">
      <SiteHeader />
      <main className="account-main">
        <h1 className="account-title">{t("login.title")}</h1>
        <div className="account-card">
          <button type="button" className="account-btn account-btn--google" onClick={handleGoogle} disabled={busy || loading}>
            {t("login.google")}
          </button>
          <p className="account-divider">
            <span>{t("login.or")}</span>
          </p>
          <form className="account-form" onSubmit={handleEmailSubmit}>
            {mode === "register" ? (
              <div className="account-field">
                <label className="account-label" htmlFor="reg-name">
                  {t("login.displayName")}
                </label>
                <input
                  id="reg-name"
                  type="text"
                  className="account-input"
                  value={displayName}
                  onChange={(ev) => setDisplayName(ev.target.value)}
                  autoComplete="name"
                />
              </div>
            ) : null}
            <div className="account-field">
              <label className="account-label" htmlFor="login-email">
                {t("login.email")}
              </label>
              <input
                id="login-email"
                type="email"
                className="account-input"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="account-field">
              <label className="account-label" htmlFor="login-password">
                {t("login.password")}
              </label>
              <input
                id="login-password"
                type="password"
                className="account-input"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                minLength={6}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </div>
            {error ? <p className="account-error" role="alert">{error}</p> : null}
            <button type="submit" className="account-btn account-btn--primary" disabled={busy || loading}>
              {mode === "register" ? t("login.registerSubmit") : t("login.signInSubmit")}
            </button>
          </form>
          <p className="account-switch">
            {mode === "register" ? (
              <>
                {t("login.hasAccount")}{" "}
                <button type="button" className="account-link-btn" onClick={() => { setMode("login"); setError(""); }}>
                  {t("login.goLogin")}
                </button>
              </>
            ) : (
              <>
                {t("login.noAccount")}{" "}
                <button type="button" className="account-link-btn" onClick={() => { setMode("register"); setError(""); }}>
                  {t("login.goRegister")}
                </button>
              </>
            )}
          </p>
          <p className="account-back">
            <Link to="/">{t("login.backHome")}</Link>
          </p>
        </div>
      </main>
      <Footer />
      <CustomCursor />
    </div>
  );
}

export default Login;
