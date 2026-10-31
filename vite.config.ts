import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** The security headers Vercel sends, so `npm run preview` behaves like the live site. */
function productionHeaders(): Record<string, string> {
  const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
  }
  const all = vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []
  return Object.fromEntries(all.map((h) => [h.key, h.value]))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable on phones and computers. The service worker keeps the app's own files, so it opens at once and
    // without a connection; the firm's data, sign-in and client files on Supabase always come from the network.
    // A new version waits until the user chooses to reload (UpdatePrompt), so nobody loses something half typed.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['logo.jpeg', 'logo-mark.jpeg'],
      manifest: {
        id: '/',
        name: 'FSG Practice Manager',
        short_name: 'FSG',
        description: 'Clients, filings, tasks and the team at Fin Savvy Consultors LLP.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // jsPDF's extras for drawing HTML and SVG (html2canvas, DOMPurify, canvg). The requirements PDF uses neither,
        // so they are not downloaded onto every device in advance.
        globIgnores: ['**/html2canvas-*.js', '**/purify.es-*.js', '**/index.es-*.js'],
      },
    }),
  ],
  preview: { headers: productionHeaders() },
})
