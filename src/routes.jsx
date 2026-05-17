import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { RouteFallback } from "./components/RouteFallback.jsx";
import App from "./App.jsx";

const Post = lazy(() => import("./pages/Post.jsx"));
const MapPage = lazy(() => import("./pages/Map.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const ChatPage = lazy(() => import("./pages/Chat.jsx"));
const ChatListPage = lazy(() => import("./pages/ChatList.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const AdminPage = lazy(() => import("./pages/Admin.jsx"));

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/post" element={<Post />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/about" element={<About />} />
        <Route path="/chat" element={<ChatListPage />} />
        <Route path="/chat/:chatId" element={<ChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Suspense>
  );
}
