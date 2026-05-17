import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Expose REACT_APP_* env vars to match .env naming (Vite default is VITE_* only).
export default defineConfig({
  plugins: [react()],
  envPrefix: "REACT_APP_",
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps, { hostType }) {
        if (hostType !== "html") return deps;
        return deps.filter((dep) => !dep.includes("leaflet") && !dep.includes("firebase"));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react-dom") ||
            /\/node_modules\/react\//.test(id) ||
            id.includes("node_modules/scheduler")
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            return "firebase";
          }
          if (id.includes("node_modules/canvas-confetti")) {
            return "confetti";
          }
        },
      },
    },
  },
})
