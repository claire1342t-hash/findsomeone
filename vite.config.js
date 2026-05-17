import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Expose REACT_APP_* env vars to match .env naming (Vite default is VITE_* only).
export default defineConfig({
  plugins: [react()],
  envPrefix: "REACT_APP_",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/leaflet") || id.includes("node_modules/react-leaflet")) {
            return "leaflet";
          }
          if (id.includes("node_modules/leaflet.markercluster")) {
            return "leaflet-cluster";
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
