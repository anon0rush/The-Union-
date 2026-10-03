import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Yjs breaks in subtle ways if two copies end up in the bundle.
    dedupe: ['yjs', 'y-protocols', '@tiptap/y-tiptap', '@tiptap/pm'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/collab': { target: 'ws://localhost:4000', ws: true },
    },
  },
});
