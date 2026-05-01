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
import ChatPage from "./pages/Chat.jsx";
import ChatListPage from "./pages/ChatList.jsx";
import About from "./pages/About.jsx";

const ROOT_KEY = "__findsomeone_app_root__";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

const root = globalThis[ROOT_KEY] || createRoot(container);
globalThis[ROOT_KEY] = root;

root.render(
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
            <Route path="/about" element={<About />} />
            <Route path="/chat" element={<ChatListPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
