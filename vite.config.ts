import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'icons/leftly-icon-192.png', 'icons/leftly-icon-512.png'],
      manifest: {
        id: '/',
        name: 'Leftly Budget Tracker',
        short_name: 'Leftly',
        description: "Local-first paycheck budget tracker. Know what's left.",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#050914',
        theme_color: '#050914',
        icons: [
          {
            src: '/icons/leftly-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/leftly-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [],
      },
    }),
  ],
})
