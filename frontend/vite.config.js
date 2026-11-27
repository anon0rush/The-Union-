import dns from 'node:dns';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

dns.setDefaultResultOrder('ipv4first');

const BACKEND = 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['yjs', 'y-protocols', '@tiptap/y-tiptap', '@tiptap/pm'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          yjs: ['yjs', 'y-websocket', 'y-indexeddb'],
        },
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: !process.env.CI && !process.env.NO_OPEN,
    proxy: {
      '/api': BACKEND,
      '/collab': { target: BACKEND.replace('http', 'ws'), ws: true },
    },
  },
});
