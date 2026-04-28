import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Expose REACT_APP_* env vars to match .env naming (Vite default is VITE_* only).
export default defineConfig({
  plugins: [react()],
  envPrefix: "REACT_APP_",
})
