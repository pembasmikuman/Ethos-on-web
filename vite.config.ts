import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: 'script-defer',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,wasm,ttf,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6_000_000,
      },
      manifest: {
        name: 'Ethos',
        short_name: 'Ethos',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        background_color: '#0A0A0B',
        theme_color: '#0A0A0B',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
});
