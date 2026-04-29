import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./firebase.js";
import "./index.css";
import App from "./App.jsx";
import Post from "./pages/Post.jsx";
import MapPage from "./pages/Map.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";

function PlaceholderPage({ title }) {
  return (
    <main className="home-main">
      <section className="hero-section">
        <div className="hero-copy">
          <h1>{title}</h1>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/post" element={<Post />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/about" element={<PlaceholderPage title="About page coming soon" />} />
            <Route path="/chat" element={<PlaceholderPage title="Chat page coming soon" />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
