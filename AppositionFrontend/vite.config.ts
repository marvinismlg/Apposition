import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // The root vercel.json routes /api to the C# service on this deployment.
  // Reject an old external API address instead of building it into the browser bundle.
  if (command === 'build' && process.env.VERCEL === '1') {
    const apiBase = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE?.trim()
    if (apiBase) {
      throw new Error(
        'Remove VITE_API_BASE from this Vercel environment and redeploy. ' +
        'The API is hosted at /api on the same domain by the root vercel.json. See DEPLOY.md.',
      )
    }
  }

  return {
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
  }
})
