import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "../lib/firebaseApp.js";
import { getEmailVerificationActionSettings } from "../utils/authEmailAction.js";
import { SiteHeader } from "../components/SiteHeader.jsx";
import { Footer } from "../components/Footer.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { EmailDomainHint } from "../components/EmailDomainHint.jsx";
import { useEmailDomainSuggestion } from "../hooks/useEmailDomainSuggestion.js";
import "./Account.css";

/**
 * @param {unknown} err
 * @param {(key: string) => string} t
 * @returns {string | null} message to show, or null to clear / hide error
 */
function friendlyAuthError(err, t) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/redirect-cancelled-by-user" ||
    code === "auth/cancelled-popup-request"
  ) {
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
  if (code === "app/user-banned") {
    return t("login.errorBanned");
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
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailSuggestion = useEmailDomainSuggestion(email);

  useEffect(() => {
    if (!loading && user) {
      navigate("/profile", { replace: true });
    }
  }, [loading, user, navigate]);

  const goLogin = () => {
    setMode("login");
    setError("");
    setSuccess("");
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const auth = await getFirebaseAuth();
      const emailNorm = email.trim().toLowerCase();
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, emailNorm, password);
        const name = displayName.trim() || emailNorm.split("@")[0] || "User";
        await updateProfile(cred.user, { displayName: name });
        const db = await getDb();
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            email: emailNorm,
            displayName: name,
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
        try {
          const action = getEmailVerificationActionSettings();
          if (action) {
            await sendEmailVerification(cred.user, action);
          } else {
            await sendEmailVerification(cred.user);
          }
        } catch (verifyErr) {
          console.error("sendEmailVerification", verifyErr);
        }
      } else {
        const cred = await signInWithEmailAndPassword(auth, emailNorm, password);
        const db = await getDb();
        const userSnap = await getDoc(doc(db, "users", cred.user.uid));
        if (userSnap.exists() && userSnap.data()?.isBanned === true) {
          await signOut(auth);
          const bannedErr = new Error("user banned");
          bannedErr.code = "app/user-banned";
          throw bannedErr;
        }
      }
      navigate("/profile", { replace: true });
    } catch (err) {
      const msg = friendlyAuthError(err, t);
      setError(msg === null ? "" : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const auth = await getFirebaseAuth();
      const emailNorm = email.trim().toLowerCase();
      if (!emailNorm) {
        setError(t("login.errorInvalidEmail"));
        return;
      }
      const action = getEmailVerificationActionSettings();
      if (action) {
        await sendPasswordResetEmail(auth, emailNorm, action);
      } else {
        await sendPasswordResetEmail(auth, emailNorm);
      }
      setSuccess(t("login.forgotSuccess"));
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        setError(
          code === "auth/invalid-email" ? t("login.errorInvalidEmail") : t("login.forgotErrorNotFound"),
        );
      } else {
        setError(t("login.errorGeneric"));
      }
    } finally {
      setBusy(false);
    }
  };

  const titleKey =
    mode === "forgot" ? "login.forgotTitle" : mode === "register" ? "login.title" : "login.title";

  return (
    <div className="home-page account-page app-shell">
      <SiteHeader />
      <main className="account-main">
        <h1 className="account-title">{t(titleKey)}</h1>
        <div className="account-card">
          {mode === "forgot" ? (
            <form className="account-form" onSubmit={handleForgotSubmit}>
              <div className="account-field">
                <label className="account-label" htmlFor="forgot-email">
                  {t("login.email")}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  className="account-input"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                  autoComplete="email"
                />
                <EmailDomainHint suggestion={emailSuggestion} onApply={setEmail} />
              </div>
              {error ? (
                <p className="account-error" role="alert">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="account-success" role="status">
                  {success}
                </p>
              ) : null}
              <button type="submit" className="account-btn account-btn--primary" disabled={busy || loading}>
                {t("login.forgotSubmit")}
              </button>
            </form>
          ) : (
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
                <EmailDomainHint suggestion={emailSuggestion} onApply={setEmail} />
              </div>
              <div className="account-field">
                <label className="account-label" htmlFor="login-password">
                  {t("login.password")}
                </label>
                <div className="account-password-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className="account-input account-input--password"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    className="account-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t("login.hidePasswordAria") : t("login.showPasswordAria")}
                  >
                    {showPassword ? t("login.hidePassword") : t("login.showPassword")}
                  </button>
                </div>
                {mode === "login" ? (
                  <p className="account-forgot-row">
                    <button
                      type="button"
                      className="account-link-btn"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                        setSuccess("");
                      }}
                    >
                      {t("login.forgotPassword")}
                    </button>
                  </p>
                ) : null}
              </div>
              {error ? (
                <p className="account-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="account-btn account-btn--primary" disabled={busy || loading}>
                {mode === "register" ? t("login.registerSubmit") : t("login.signInSubmit")}
              </button>
            </form>
          )}
          {mode === "forgot" ? (
            <p className="account-switch">
              <button type="button" className="account-link-btn" onClick={goLogin}>
                {t("login.backToLogin")}
              </button>
            </p>
          ) : (
            <p className="account-switch">
              {mode === "register" ? (
                <>
                  {t("login.hasAccount")}{" "}
                  <button type="button" className="account-link-btn" onClick={goLogin}>
                    {t("login.goLogin")}
                  </button>
                </>
              ) : (
                <>
                  {t("login.noAccount")}{" "}
                  <button
                    type="button"
                    className="account-link-btn"
                    onClick={() => {
                      setMode("register");
                      setError("");
                      setSuccess("");
                    }}
                  >
                    {t("login.goRegister")}
                  </button>
                </>
              )}
            </p>
          )}
          <p className="account-back">
            <Link to="/">{t("login.backHome")}</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default Login;
