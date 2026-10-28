import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API is proxied, so the browser talks to one origin (no CORS set-up needed).
// 127.0.0.1 (not "localhost"): on Windows, Node resolves localhost to IPv6 ::1 first while
// uvicorn listens on IPv4 127.0.0.1, which made every /api call fail (stats showed "-").
// Port 8765 (not 8000): 8000 is often taken by another program; Vite then forwarded /api to that
// program and every call came back 404. Web port 5288 (not 5173): 5173 is the default of every
// Vite project, so another project's site (e.g. SplitPay) answered there. strictPort = no silent moving.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5288,
    strictPort: true,
    proxy: { '/api': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8765', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8765', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
