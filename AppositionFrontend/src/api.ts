import type { AnalysisResponse, AnalysisResult, Brief } from './types'

// Locally, Vite proxies /api to the C# backend (see vite.config.ts), so the base is empty.
// A deployed build sets VITE_API_BASE to the backend's public URL, e.g.
// https://apposition-api.onrender.com. It holds no secret: it ends up in the browser bundle.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

async function failure(res: Response) {
  // ASP.NET problem responses carry the message in "detail"; plain 400s are text.
  const body = await res.text()
  try {
    return new Error(JSON.parse(body).detail ?? body)
  } catch {
    return new Error(body || `Request failed (${res.status})`)
  }
}

/** Step 1: Gemini splits the pitch into idea, features and audience for review. */
export async function extractBrief(prompt: string): Promise<Brief> {
  const res = await fetch(`${API_BASE}/api/analysis/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw await failure(res)
  return res.json()
}

/** Step 2: the full analysis, using the brief with the founder's edited features. */
export async function analyzeIdea(prompt: string, brief: Brief): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/api/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, brief }),
  })
  if (!res.ok) throw await failure(res)
  return res.json()
}

/** Builds the Word report on the server and saves it through the browser. */
export async function downloadReport(result: AnalysisResult, planned: number[]) {
  const res = await fetch(`${API_BASE}/api/analysis/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result, planned }),
  })
  if (!res.ok) throw await failure(res)

  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'market_analysis.docx'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
