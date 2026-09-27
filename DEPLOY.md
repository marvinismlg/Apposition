# Deploying Apposition

Two backend services run on **Render**; the website runs on **Vercel**.

```
Browser ──> Vercel (React site) ──> Render: apposition-api (C#) ──> Render: apposition-python (Python + Gemini)
```

The Gemini key lives only on Render, in the Python service's environment variables.
It is never in the repo or in the website's code.

## 1. Backends on Render

1. Sign in at https://dashboard.render.com with GitHub.
2. **New → Blueprint**, pick the `Apposition` repository. Render reads `render.yaml`
   and shows two services: `apposition-python` and `apposition-api`.
3. It asks for the values marked `sync: false`:
   - `GEMINI_KEY`: your Gemini API key.
   - `AllowedOrigins`: leave blank for now (you fill it in after step 2).
4. Click **Apply**. The first build takes about 10 minutes (the Python image
   downloads PyTorch and the embedding model).
5. When both are **Live**, open `apposition-api` and copy its URL, e.g.
   `https://apposition-api.onrender.com`. Check `<that URL>/health` shows `"ok"`.

**Plan:** the blueprint uses Render's **Free** plan. Free services sleep after 15
minutes without traffic; the first analysis after that waits for them to wake
(the Python service reloads its AI model, so allow 1–2 minutes). Open the site a
few minutes before a demo to wake them. Free instances get about 750 hours a month
per workspace, shared by both services. For always-on, change `plan: free` to
`plan: starter` (512 MB, about $7/month per service).

## 2. Website on Vercel

1. At https://vercel.com, **Add New → Project**, import the `Apposition` repository.
2. Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `AppositionFrontend`
   - Build command and output directory fill in automatically (`npm run build`, `dist`).
3. **Environment Variables:** add `VITE_API_BASE` = the `apposition-api` URL from
   step 1.5 (no trailing slash). This is only an address, not a secret.
4. **Deploy**, then copy the site URL, e.g. `https://apposition.vercel.app`.

## 3. Connect them

1. In Render, open `apposition-api` → **Environment** → set `AllowedOrigins` to the
   Vercel site URL. For several, separate with commas (e.g. add the preview domain).
2. Save; Render redeploys it. The website can now call the API.

## Changing things later

- New code on `main` redeploys both automatically (Render and Vercel watch the repo).
- Rotate the Gemini key: change `GEMINI_KEY` on `apposition-python` in Render.
- If you change `VITE_API_BASE` in Vercel, redeploy the site: the value is built in.

## Running locally (unchanged)

```
cd AppositionBackend/CompetitorAnalysis && ./.venv/bin/uvicorn api:app --port 8000
cd AppositionBackend && dotnet run --launch-profile http
cd AppositionFrontend && npm run dev
```
Put `GEMINI_KEY` in `AppositionBackend/CompetitorAnalysis/.env.local` (see `.env.example`).
