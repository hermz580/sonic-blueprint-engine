import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // HMR can be disabled with DISABLE_HMR=true (useful in hosted sandboxes).
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
