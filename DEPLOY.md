# Deploy the entire Apposition application on Vercel

One Vercel project builds and deploys the existing React frontend, C# API, and
Python analysis service. All public requests use the same domain. The deployment
configuration is `vercel.json` at the **repository root**.

```text
Browser -> Vercel frontend (/)
Browser -> Vercel C# service (/api/*) -> private Vercel Python service
Browser -> Vercel Apple RSS proxy (/apple-rss/*) -> Apple
```

The application's existing Apple and Gemini integrations remain in use. Model
weights and packages are downloaded during the container build. Hosting all
three services on Vercel does not remove those application/build dependencies.
No API key values, analysis algorithms, response shapes, or UI screens are changed.

## 1. Prepare the Vercel project

1. Sign in to [Vercel](https://vercel.com/dashboard) with the account/team that
   owns the application. Connect the GitHub repository under **Settings > Git**,
   or use **Add New > Project** to import it for a new project.
2. In **Settings > Build and Deployment**, set **Root Directory** to the repository
   root (leave it empty or use `.`). Do **not** select `AppositionFrontend` or
   `AppositionBackend`: Vercel needs access to all three service folders.
3. Clear the previous project-level Vite build, install, development, and output
   overrides. Use **Other** for a project-level Framework Preset if the dashboard
   requires one. The root `vercel.json` declares Vite and its build settings on
   the `frontend` service, and the container runtime on each backend service.
4. Enable **Fluid compute** in the project's function settings if this is an older
   project where it is disabled. Confirm the team can use **Services** and
   **Container Images**; both are currently documented as beta on all plans.
   A rejected beta feature must be enabled/available for the team before this
   configuration can deploy. Do not switch the project back to frontend-only mode.
   Under **Settings > Functions > Advanced Settings > Function CPU**, use the
   standard 2 GB / 1 vCPU setting to start (fixed on Hobby). On Pro/Enterprise,
   4 GB / 2 vCPUs is available if measurements show the analysis needs it.
   Fluid compute memory is configured in the dashboard, not in `vercel.json`.
5. Under **Settings > Environment Variables**, configure the following for both
   **Production** and **Preview** (and Development if using `vercel dev`):

   | Variable | Action |
   | --- | --- |
   | `GEMINI_KEY` | Copy the same existing secret value into Vercel. Do not rotate it, commit it, or prefix it with `VITE_`. If intentionally omitted, the app retains its existing no-Gemini fallback. |
   | `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | If previously configured, copy their existing values unchanged. Otherwise leave unset to retain the code's defaults. |
   | `VERCEL_SUPPORT_LARGE_FUNCTIONS` | Set to `1`, particularly for an older project. The Python image includes PyTorch and bundled model weights. |
   | `VITE_API_BASE` | Remove old values, including environment-specific and branch-specific overrides. The frontend uses same-origin `/api` requests. |
   | `PythonApiUrl` | Remove any manually configured value. Vercel generates it for the C# service through the `analysis` binding. |
   | `AllowedOrigins` | Remove the obsolete variable. The previous application policy did not use it; the active CORS policy is unchanged. |
   | `PORT`, `ASPNETCORE_URLS`, `ASPNETCORE_HTTP_PORTS`, `ASPNETCORE_HTTPS_PORT` | Remove old hosting overrides. Both images bind to `0.0.0.0` on Vercel's default port 80. If you intentionally set `PORT`, both images honor it. |

6. Keep **Automatically expose System Environment Variables** enabled so hosted
   builds and the API can recognize `VERCEL=1`. The frontend build rejects a
   stale external `VITE_API_BASE`, and the API rejects a missing service binding.
7. Save the settings. Changes to environment variables take effect in a new
   deployment. Neither backend needs a separately managed public domain.

Services, container images, and resource limits are described in
[Vercel Services](https://vercel.com/docs/services),
[Container Images](https://vercel.com/docs/functions/container-images), and
[large Functions](https://vercel.com/kb/guide/troubleshooting-function-250mb-limit).

## 2. What the configuration deploys

| Service | Source directory | Public routes |
| --- | --- | --- |
| `frontend` | `AppositionFrontend` | `/` and frontend assets |
| `api` | `AppositionBackend` | `/api/*`, `/health` |
| `analysis` | `AppositionBackend/CompetitorAnalysis` | None; accessible through the C# service binding |

The API route rule preserves `/api` because the existing C# controller expects it.
The Apple RSS proxy runs before the frontend rule. API requests are never rewritten
to `index.html`. There are no separate `/features` or `/results` pages: `src/App.tsx`
continues to switch screens through React state at `/`.

The `api` service declares a binding to `analysis`, named `PythonApiUrl`. Its value
is generated for each deployment, so a preview calls its own Python backend.
The C# client preserves any path prefix in that generated URL. Vercel handles
public HTTPS; the container accepts forwarded HTTP without redirecting it.
See [service bindings](https://vercel.com/docs/services/bindings).

Each backend has a `Dockerfile.vercel`. Both use the same languages, dependencies,
and entry points as before. The Python image bundles `all-MiniLM-L6-v2` and loads
the cached weights offline on startup. Matplotlib uses `/tmp` for its runtime
cache. Secrets are excluded from uploaded files and Docker build contexts.

The configuration allows 300 seconds per backend invocation. Memory comes from
the project's Function CPU setting (2 GB by default). Python is
limited to one request per instance to avoid overlapping model/report workloads
competing for that memory; Vercel can scale additional instances. This does not
change the threads used inside an individual analysis. The existing C# timeout
for a Python call remains three minutes.

These settings fit the documented Hobby ceilings, but do not establish that the
workload fits in practice or that Hobby is suitable for your usage. Verify peak
memory, cold starts, image size, duration, and plan eligibility before relying on
production. If Python runs out of memory, increase Function CPU in the dashboard
on a plan that permits it, redeploy, and recheck. See
[memory configuration](https://vercel.com/docs/functions/configuring-functions/memory)
and [function limits](https://vercel.com/docs/functions/limitations).

## 3. Commit the migration

Run these commands in PowerShell from the repository root. They stage only the
hosting migration files, including the removed configurations and renamed images:

```powershell
cd C:\Users\marvi\Downloads\Apposition-main
git switch -c deploy/vercel-services
git diff --check
git add -- .gitignore .vercelignore vercel.json render.yaml DEPLOY.md `
  AppositionFrontend/vercel.json AppositionFrontend/vite.config.ts `
  AppositionFrontend/src/api.ts AppositionFrontend/.env.example `
  AppositionBackend/.dockerignore AppositionBackend/Dockerfile `
  AppositionBackend/Dockerfile.vercel AppositionBackend/Program.cs `
  AppositionBackend/Services/PythonService.cs `
  AppositionBackend/CompetitorAnalysis/.dockerignore `
  AppositionBackend/CompetitorAnalysis/Dockerfile `
  AppositionBackend/CompetitorAnalysis/Dockerfile.vercel `
  AppositionBackend/CompetitorAnalysis/api.py
git diff --cached --stat
git diff --cached
git commit -m "Host frontend and backend services together on Vercel"
git push -u origin deploy/vercel-services
```

The deleted blueprint filename in this staging command is historical cleanup,
not an active hosting dependency. Review the staged diff before committing.
The `.env.example` contains placeholders only; actual `.env.local` files stay local.

## 4. Deploy and verify the preview

1. After the branch push, open the new preview under the Vercel project's
   **Deployments**. If the project was just imported, deploy the migration branch.
2. Confirm build output includes **all three services**. The first Python image
   build installs CPU PyTorch and downloads model weights, so it takes longer
   than a frontend-only build.
3. Confirm the root page loads with its styles, icons, and existing controls.
4. Open `https://<preview-domain>/health`. Expect HTTP 200 and `"ok"`. This checks
   C# only; the Python service intentionally has no public health URL.
5. Submit an idea. In browser DevTools > Network, confirm
   `POST https://<preview-domain>/api/analysis/brief` returns JSON and the feature
   editor appears. This checks the C# -> Python connection.
6. Review the features and run the analysis. Confirm
   `POST /api/analysis` succeeds and displays the existing results screen.
7. Download the Word report. Confirm `POST /api/analysis/report` returns a working
   `.docx` file rather than an HTML response or error page.
8. Confirm `/apple-rss/api/v2/us/apps/top-free/10/apps.json` returns JSON. The UI
   has an existing chart fallback, so seeing app tiles alone does not prove this
   proxy works.
9. Repeat the flow after the backends have been idle, and check service logs for
   startup, memory, or timeout errors. Test concurrent visitors before launch.
10. Merge the tested branch into the configured production branch (usually `main`).
    Vercel deploys all services together. Repeat steps 3-9 on the production domain.
    Retire the old provider's services only after this verification succeeds.

Vercel hosts and builds a connected copy of the application; GitHub remains the
source repository in this workflow. No push, account change, or production
deployment is performed just by editing these local files.

### Optional CLI workflow

With Docker Desktop installed and running, use the current Vercel CLI from the
repository root. A local service preview can run without linking a cloud project:

```powershell
npx vercel@latest dev -L
```

For a cloud preview, link to the **existing** application project when prompted:

```powershell
npx vercel@latest login
npx vercel@latest link
npx vercel@latest deploy
```

After validating that preview and the Production environment settings:

```powershell
npx vercel@latest deploy --prod
```

Use the Git workflow above when you want the deployed version tied to a reviewed
commit. Do not use an old prebuilt frontend-only `dist` directory for this deployment.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Only the frontend builds | Project Root Directory must be the repository root; clear old build/output overrides. |
| Build requests removal of `VITE_API_BASE` | Delete the value for that deployment environment, including branch overrides, then redeploy. |
| Configuration rejects `services` or `container` | Use the current Vercel CLI and verify Services/Container Images support for the project/team. |
| API calls return HTML or 404 | Confirm the root routing configuration is active and `/api/*` reaches `api`, not `frontend`. |
| C# startup reports a missing binding | Confirm `api.bindings` targets `analysis`; remove a manually configured `PythonApiUrl`. |
| Container requests fail immediately | Check the image starts successfully and listens on `0.0.0.0` at `PORT` (default 80). |
| C# responds with 502 | Inspect Python service logs and binding configuration; the existing error message mentions local port 8000 but also covers hosted upstream failures. |
| Python fails to start or exceeds memory | Inspect model loading and container build logs; verify the image includes the cached weights and fits the platform limits. |
| Request times out | Check the Python call's existing three-minute timeout, Vercel duration limits, and external API latency. |
| Report or analysis payload returns 413 | Check Vercel's request/response payload limits; a different transport would require a separate application change. |
| No AI summaries | Verify the same existing `GEMINI_KEY` and optional model settings are present at runtime. The no-key fallback is unchanged. |

The live deployment is the final validation of container startup, private service
bindings, memory, cold starts, Apple/Gemini calls, and report payload size. A local
frontend or C# build alone cannot establish these.

## Existing local development

The original three-terminal workflow still works: Python on port 8000, C# on
port 5219, and Vite on port 5173. Leave `VITE_API_BASE` empty. See `README.md` for
dependency installation and startup commands. Docker is needed only for testing
the container deployment locally, not for that original workflow.

## Local validation of this migration

- Frontend production build with `VERCEL=1` and an empty API base: passed.
- C# build targeting .NET 10: passed using the installed .NET 11 preview SDK.
- Published Vercel configuration schema and compiled public route checks: passed.
- C# HTTP health, brief extraction, and report download with a mock Python server:
  passed, including a private URL path prefix and unchanged payloads. This local
  smoke check used .NET 11 runtime roll-forward because the exact .NET 10.0.12
  core runtime is absent. The deployment images still use .NET 10.
- Existing warnings remain: six frontend lint warnings and the C# dependency
  advisory for `Microsoft.OpenApi` 2.0.0. Dependency upgrades are outside this migration.
- Docker and a runnable Python environment are unavailable on this machine.
  Container builds/startup and live Apple/Gemini analysis must be verified with
  the preview procedure above; no production deployment has been performed.
