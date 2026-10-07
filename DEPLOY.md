# Deploying Apposition

Apposition uses **Vercel** for the React frontend and **Render** for the C# and Python backend services.

```text
Browser
   ↓
Vercel
React + TypeScript
   ↓
Render
C# ASP.NET API
   ↓
Render
Python FastAPI
   ↓
SentenceTransformers + Gemini + App Store data
```

**Live frontend:** https://apposition-gray.vercel.app/

The Gemini API key exists only inside the Python service's environment variables. It should never be committed to GitHub or exposed in frontend code.

## 1. Deploy the Backends on Render

The root `render.yaml` defines both backend services:

- `apposition-api` for the C# ASP.NET backend
- `apposition-python` for the Python analysis service

To deploy:

1. Sign into Render with GitHub.
2. Select **New → Blueprint**.
3. Import the `Apposition` repository.
4. Render automatically reads `render.yaml`.
5. Enter `GEMINI_KEY` when prompted.
6. Deploy both services.

The Python service takes longer to build because it installs the NLP dependencies and loads the SentenceTransformer model.

Once deployed, verify:

```text
https://apposition-python.onrender.com/health
```

and:

```text
https://apposition-api.onrender.com/health
```

Both should return a successful response.

### Python Service Connection

The C# backend communicates with Python using:

```text
PythonApiUrl
```

The Blueprint currently points this to:

```text
https://apposition-python.onrender.com
```

If Render assigns the Python service a different URL, update `PythonApiUrl` in the C# service's environment variables.

## 2. Deploy the Frontend on Vercel

In Vercel:

1. Select **Add New → Project**.
2. Import the `Apposition` repository.
3. Set the root directory to:

```text
AppositionFrontend
```

4. Vercel should detect **Vite** automatically.
5. Add the environment variable:

```text
VITE_API_BASE=https://apposition-api.onrender.com
```

Do not include a trailing slash.

`VITE_API_BASE` is only the public address of the backend. It is not a secret.

Deploy the project.

## 3. Environment Variables

### Render: `apposition-python`

```text
GEMINI_KEY=your-key
```

Optional:

```text
GEMINI_MODEL=...
GEMINI_FALLBACK_MODELS=...
```

These control which Gemini models the Python service attempts to use.

### Render: `apposition-api`

```text
PythonApiUrl=https://apposition-python.onrender.com
```

The repository also defines `AllowedOrigins`, although the current C# CORS policy allows all origins. If stricter CORS is added later, this variable can be used for the approved frontend domains.

### Vercel

```text
VITE_API_BASE=https://apposition-api.onrender.com
```

## 4. Deployment Flow

A deployed request moves through the application like this:

```text
User enters app idea
        ↓
React frontend
        ↓
C# ASP.NET API
        ↓
Apple iTunes Search API
        ↓
Python FastAPI
        ↓
SentenceTransformer ranking
Feature comparison
Review collection
Revenue estimation
Gemini analysis
        ↓
C# API
        ↓
React results page
```

When the user downloads a market report, Python generates the `.docx` and Matplotlib charts, sends the file bytes through the C# API, and the browser saves the report directly to the user's computer.

No user database or account system is required.

## 5. Updating the Application

Both platforms watch the GitHub repository.

Changes pushed to `main` can trigger new deployments for the connected Render and Vercel projects.

For environment changes:

- Change the Gemini key in the `apposition-python` Render environment.
- Change `PythonApiUrl` if the Python backend URL changes.
- Change `VITE_API_BASE` if the public C# API URL changes.
- Redeploy Vercel after changing a `VITE_` environment variable because Vite includes those values during the frontend build.

## 6. Running Locally

Three services must run locally.

### Python analysis API

```bash
cd AppositionBackend/CompetitorAnalysis
./.venv/bin/uvicorn api:app --port 8000
```

### C# API

```bash
cd AppositionBackend
dotnet run --launch-profile http
```

### React frontend

```bash
cd AppositionFrontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

For local Gemini access, copy:

```text
.env.example
```

to:

```text
AppositionBackend/CompetitorAnalysis/.env.local
```

and add:

```text
GEMINI_KEY=your-key
```

`.env.local` is ignored by Git and should never be committed.

## Deployment Summary

```text
Frontend     Vercel
Main API     Render / C# ASP.NET
Analysis     Render / Python FastAPI
AI           Google Gemini API
NLP          SentenceTransformers
App data     Apple APIs
Secrets      Render environment variables
Reports      Generated server-side and downloaded locally
```
