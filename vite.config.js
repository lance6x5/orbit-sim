import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Read the version from package.json so the app can display it (semver).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // GitHub Pages serves the site from https://<user>.github.io/orbit-sim/
  base: '/orbit-sim/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.svg', 'logo-mark.svg'],
      manifest: {
        name: 'Gravitas - Gravity Sandbox',
        short_name: 'Gravitas',
        description: 'Gravitas: a gravity sandbox where every body attracts. Launch planets, build orbits, and learn how N-body physics simulations work.',
        theme_color: '#14112e',
        background_color: '#0b0a1a',
        display: 'standalone',
        start_url: '/orbit-sim/',
        scope: '/orbit-sim/',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
