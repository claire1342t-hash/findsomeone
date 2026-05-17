import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AppRoutes } from "./routes.jsx";
import "./index.css";

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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
