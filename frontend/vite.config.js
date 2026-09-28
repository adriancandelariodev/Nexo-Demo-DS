import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// En desarrollo, /api/* se reenvía al backend (igual que la regla "rewrites" de vercel.json en producción)
const API = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
  preview: {
    port: 3000,
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
});
