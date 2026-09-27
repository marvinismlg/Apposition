import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Apple's top-charts feed has no CORS headers; see TopApps.tsx
      '/apple-rss': {
        target: 'https://rss.marketingtools.apple.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/apple-rss/, ''),
      },
      // C# backend, "http" profile in AppositionBackend/Properties/launchSettings.json
      '/api': 'http://localhost:5219',
    },
  },
})
