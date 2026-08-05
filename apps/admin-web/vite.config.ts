import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Installable PWA: home-screen icon, opens fullscreen without a browser
    // bar. Ops installs it once on the office tablet/desktop and it feels
    // like an app — while keeping CSV export and the two-pane dispatch board.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Hill Express Admin',
        short_name: 'HE Admin',
        description: 'Dispatch, catalogue, COD reconciliation, reports.',
        theme_color: '#0B3D2E',
        background_color: '#0B3D2E',
        display: 'standalone',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://localhost:3000',
      // Uploaded banner artwork is stored as a relative path, so it has to
      // resolve here too — otherwise every preview 404s against Vite itself.
      '/uploads': 'http://localhost:3000',
    },
  },
});
