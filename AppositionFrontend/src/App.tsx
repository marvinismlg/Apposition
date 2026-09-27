import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { SubmitEvent, KeyboardEvent } from 'react'
import { analyzeIdea, downloadReport, extractBrief } from './api'
import LiquidGlassButton from './LiquidGlassButton'
import type { LiquidGlassButtonProps } from './LiquidGlassButton'
import Preloader from './Preloader'
import Typewriter from './Typewriter'
import Showcase from './Showcase'
import Starfield from './Starfield'
import { scrollToTop, startSmoothScroll } from './SmoothScroll'
import TopApps from './TopApps'
import type { AnalysisResponse, AnalysisResult, Brief, RankedApp, RevenueEstimate, Review, Verdict } from './types'
import './App.css'

type View = 'input' | 'extracting' | 'features' | 'loading' | 'results'
type SortKey = 'similarity' | 'rating' | 'price' | 'revenue'

const HEADLINES = [
  'Test and build faster with Apposition.',
  'Know your competition before you build.',
  'Find the gap your rivals missed.',
]

const STAGES = [
  'Searching the App Store',
  'Scoring similarity',
  'Reading competitor reviews',
  'Building your strategy',
]
const BRIEF_STAGES = ['Reading your idea', 'Finding its features']

// The real pipeline takes 20–60 s; the last stage holds until it answers.
const STAGE_MS = 2500

// One-line prompts; each names the idea, a few features and who it's for.
const EXAMPLES = [
  'lets neighbours swap houseplants and cuttings, with plant listings, in-app chat and a map of nearby swaps, for urban gardeners',
  'splits grocery bills between roommates automatically, with receipt scanning and payment reminders, for college students',
  'matches beginner runners with buddies at the same pace, with route sharing and group runs',
]


type Theme = 'light' | 'dark'

// index.html sets data-theme before first paint (saved choice, else the system setting).
const initialTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

const ThemeContext = createContext<Theme>('light')

function App() {
  const [view, setView] = useState<View>('input')
  const [prompt, setPrompt] = useState('')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [features, setFeatures] = useState<FeatureItem[]>([])
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preloading, setPreloading] = useState(true)
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(startSmoothScroll, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      // storage blocked: the toggle still works for this visit
    }
  }

  const landing = view === 'input'

  // Step 1: pull the features out of the pitch so the founder can edit them.
  const run = async () => {
    setView('extracting')
    setError(null)
    try {
      const extracted = await extractBrief(prompt.trim())
      setBrief(extracted)
      const source: FeatureSource = extracted.featuresInferred ? 'auto' : 'yours'
      setFeatures(extracted.keyFeatures.map((text) => ({ text, source })))
      setView('features')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setView('input')
    }
  }

  // Step 2: the full analysis with the edited feature list.
  const analyze = async () => {
    if (!brief) return
    setView('loading')
    setError(null)
    try {
      setAnalysis(await analyzeIdea(prompt.trim(), { ...brief, keyFeatures: features.map((f) => f.text) }))
      setView('results')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setView('features')
    }
  }

  const tryIt = () => {
    scrollToTop()
    document.querySelector<HTMLTextAreaElement>('.brief textarea')?.focus({ preventScroll: true })
  }

  const restart = () => {
    setPrompt('')
    setBrief(null)
    setFeatures([])
    setAnalysis(null)
    setView('input')
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`app${landing ? ' landing' : ''}${preloading ? ' preloading' : ''}`}>
        <Starfield
          background={theme === 'dark' ? '#000000' : '#ffffff'}
          starColor={theme === 'dark' ? '#ffffff' : '#1d3374'}
        />
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
        {preloading && (
          <Preloader onDone={() => setPreloading(false)}>
            <LogoMark className="preloader-mark" />
          </Preloader>
        )}
        <header className="hero">
          <Tiles />
          <Logo />
          <p className="tagline">Know your competition before you build.</p>
          <div className="hero-bar" aria-hidden />
        </header>

        <main className={view === 'results' ? 'wide' : undefined}>
          {view === 'input' && (
            <BriefForm prompt={prompt} setPrompt={setPrompt} onSubmit={run} error={error} introDone={!preloading} />
          )}
          {view === 'input' && <TopApps />}
          {landing && (
            <a className="scroll-hint" href="#how">
              How it works <span aria-hidden>↓</span>
            </a>
          )}
          {view === 'extracting' && <Loading stages={BRIEF_STAGES} caption="Reading your idea…" />}
          {view === 'features' && brief && (
            <FeatureEditor
              brief={brief}
              features={features}
              setFeatures={setFeatures}
              error={error}
              onBack={() => setView('input')}
              onAnalyze={analyze}
            />
          )}
          {view === 'loading' && <Loading stages={STAGES} caption="Scanning the App Store for your competitors…" />}
          {view === 'results' && analysis && <Results analysis={analysis} onRestart={restart} />}
        </main>

        {landing && <Showcase onTry={tryIt} />}

        <GlassFooter showHow={landing} />
      </div>
    </ThemeContext.Provider>
  )
}

/* ---------------- Prompt (ChatGPT-style composer) ---------------- */

interface BriefFormProps {
  prompt: string
  setPrompt: (p: string) => void
  onSubmit: () => void
  error: string | null
  introDone: boolean
}

const MAX_PROMPT_PX = 220
// Matches IdeaPrompt.MaxLength (C#) and MAX_IDEA_CHARS (Python).
const MAX_IDEA_CHARS = 1000

function BriefForm({ prompt, setPrompt, onSubmit, error, introDone }: BriefFormProps) {
  const tooLong = prompt.length > MAX_IDEA_CHARS
  const ready = prompt.trim().length > 0 && !tooLong

  // Grow with the text like a chat composer, up to a cap, then scroll.
  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_PROMPT_PX)}px`
  }

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (ready) onSubmit()
  }

  // Enter sends, Shift+Enter adds a new line.
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (ready) onSubmit()
    }
  }

  return (
    <form className="brief" onSubmit={handleSubmit}>
      <Typewriter className="landing-title" phrases={HEADLINES} start={introDone} />

      <div className="composer">
        <textarea
          ref={autosize}
          autoFocus
          rows={1}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            autosize(e.target)
          }}
          onKeyDown={onKey}
          placeholder="I have an idea for an app that…"
          aria-label="Describe your app idea"
          aria-describedby="idea-count"
          aria-invalid={tooLong || undefined}
        />
        <button type="submit" className="composer-send" disabled={!ready} aria-label="Find my competitors">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      <p className="composer-hint">
        Mention key features and who it's for to sharpen the results.{' '}
        <span id="idea-count" className={`char-count${tooLong ? ' over' : ''}`} aria-live="polite">
          {prompt.length.toLocaleString()}/{MAX_IDEA_CHARS.toLocaleString()}
        </span>
      </p>
      {tooLong && (
        <p className="error">
          Your idea is {(prompt.length - MAX_IDEA_CHARS).toLocaleString()} characters over the limit. Shorten it to
          analyze.
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button type="button" key={ex} className="chip ghost" onClick={() => setPrompt(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </form>
  )
}

/* ---------------- Features (review before analysis) ---------------- */

// Match MAX_FEATURES / MAX_FEATURE_CHARS in gemini_api.py and IdeaPrompt.cs.
const MAX_FEATURES = 8
const MAX_FEATURE_CHARS = 80

// Where a feature came from: named in the pitch, derived by Gemini because the
// pitch named none, picked from Gemini's suggestions, or typed by the founder.
type FeatureSource = 'yours' | 'auto' | 'suggested' | 'custom'

interface FeatureItem {
  text: string
  source: FeatureSource
}

const SOURCE_LABEL: Record<FeatureSource, string | null> = {
  yours: null,
  auto: 'auto',
  suggested: 'suggested',
  custom: 'added',
}

interface FeatureEditorProps {
  brief: Brief
  features: FeatureItem[]
  setFeatures: (f: FeatureItem[]) => void
  error: string | null
  onBack: () => void
  onAnalyze: () => void
}

function FeatureEditor({ brief, features, setFeatures, error, onBack, onAnalyze }: FeatureEditorProps) {
  const has = (text: string) => features.some((f) => f.text.toLowerCase() === text.toLowerCase())
  const full = features.length >= MAX_FEATURES

  const add = (text: string, source: FeatureSource) => {
    const clean = text.trim().replace(/\s+/g, ' ')
    if (clean && !has(clean) && !full) setFeatures([...features, { text: clean, source }])
  }

  return (
    <section className="features-step">
      <div className="card idea-card">
        <h2>Check your features</h2>
        <p className="summary">{brief.appIdea}</p>
        {brief.targetAudience && (
          <p className="muted small">
            For {brief.targetAudience}
            {brief.audienceInferred && ' (inferred)'}
          </p>
        )}
        {brief.status === 'unavailable' && (
          <p className="notice">Gemini couldn't read the pitch, so add your features yourself.</p>
        )}
        <p className="muted small">
          Each feature is checked against competitor listings. Remove any that don't fit and add what's missing.
        </p>

        <ul className="feature-list" aria-label="Features to compare">
          {features.map((f) => (
            <li key={f.text} className="chip feature-chip">
              {f.text}
              {SOURCE_LABEL[f.source] && <span className="feature-source">{SOURCE_LABEL[f.source]}</span>}
              <button
                type="button"
                className="feature-remove"
                onClick={() => setFeatures(features.filter((x) => x !== f))}
                aria-label={`Remove ${f.text}`}
              >
                ✕
              </button>
            </li>
          ))}
          <li>
            <AddFeature
              suggestions={brief.suggestedFeatures.filter((s) => !has(s))}
              disabled={full}
              onAdd={add}
            />
          </li>
        </ul>
        <p className={`muted small${full ? ' char-count over' : ''}`}>
          {features.length}/{MAX_FEATURES} features{full && ' — remove one to add another'}
        </p>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="actions">
        <GlassButton variant="secondary" label="Edit idea" onTap={onBack} />
        <GlassButton label="Analyze" disabled={features.length === 0} onTap={onAnalyze} />
      </div>
    </section>
  )
}

interface AddFeatureProps {
  suggestions: string[]
  disabled: boolean
  onAdd: (text: string, source: FeatureSource) => void
}

function AddFeature({ suggestions, disabled, onAdd }: AddFeatureProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const root = useRef<HTMLDivElement>(null)

  // Close when clicking anywhere outside the menu.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const addCustom = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd(text, 'custom')
    setText('')
  }

  return (
    <div className="add-feature" ref={root} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        className="chip ghost add-toggle"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        + Add feature <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="feature-menu card">
          <form onSubmit={addCustom}>
            <input
              autoFocus
              value={text}
              maxLength={MAX_FEATURE_CHARS}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your own feature"
              aria-label="Your own feature"
            />
            <button type="submit" disabled={!text.trim()}>
              Add
            </button>
          </form>
          {suggestions.length > 0 ? (
            <>
              <p className="muted small">Common in apps like this</p>
              <ul>
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => onAdd(s, 'suggested')}>
                      + {s}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted small">No more suggestions. Type your own above.</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Loading ---------------- */

function Loading({ stages, caption }: { stages: string[]; caption: string }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), STAGE_MS)
    return () => clearInterval(id)
  }, [stages])

  return (
    <section className="loading" aria-live="polite">
      <Orbit />
      <p className="fetch-caption">{caption}</p>
      <ul>
        {stages.map((label, i) => (
          <li key={label} className={i < stage ? 'done' : i === stage ? 'active' : undefined}>
            <span className="dot">{i < stage ? '✓' : ''}</span>
            {label}
            {i === stage && '…'}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------------- Results ---------------- */

// Gemini's verdict when it ran; otherwise the unverified embedding hint.
type CellVerdict = Verdict | 'candidate'

const VERDICT_LABEL: Record<CellVerdict, string> = {
  supported: 'Described',
  related: 'Related',
  candidate: 'Candidate',
  not_established: 'Not shown',
}

interface GridRow {
  feature: string
  cells: { verdict: CellVerdict; evidence: string }[]
}

interface ResultsProps {
  analysis: AnalysisResponse
  onRestart: () => void
}

function Results({ analysis: { brief, result }, onRestart }: ResultsProps) {
  const apps = result.results
  const gemini = result.analysis
  const revenue = useMemo(() => result.revenue ?? [], [result])
  const [sort, setSort] = useState<SortKey>('similarity')
  const [open, setOpen] = useState<number | null>(apps.length ? 0 : null)
  const [planned, setPlanned] = useState<Set<number>>(new Set())
  const [picked, setPicked] = useState<{ row: number; app: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sorting only reorders the cards; each keeps its ranked index, which the
  // reviews, explanations and evidence grid all refer to.
  const order = useMemo(() => {
    const indices = apps.map((_, i) => i)
    if (sort === 'rating') indices.sort((a, b) => apps[b].Rating - apps[a].Rating)
    if (sort === 'price') indices.sort((a, b) => priceValue(apps[a].Price) - priceValue(apps[b].Price))
    if (sort === 'revenue') indices.sort((a, b) => revenueValue(revenue[b]) - revenueValue(revenue[a]))
    return indices
  }, [apps, sort, revenue])

  // One log scale for every card's revenue bar, so the bars compare across apps.
  const revenueScale = useMemo(() => {
    const ranges = revenue.filter((r) => r.status === 'available' && r.likely).map((r) => r.likely!)
    if (!ranges.length) return null
    return { lo: Math.log(Math.min(...ranges.map((r) => r[0]))), hi: Math.log(Math.max(...ranges.map((r) => r[1]))) }
  }, [revenue])

  const grid = useMemo(() => evidenceGrid(result), [result])
  const ranking = useMemo(() => rankFeatures(grid), [grid])

  const explanation = (i: number) => gemini?.competitor_summaries.find((s) => s.app_index === i)?.explanation
  const reviewsFor = (i: number) => result.reviews.apps[i]?.reviews ?? []

  const togglePlanned = (i: number) =>
    setPlanned((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await downloadReport(result, [...planned].sort((a, b) => a - b))
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'The report could not be downloaded')
    } finally {
      setSaving(false)
    }
  }

  if (!apps.length) {
    return (
      <div className="results">
        <p className="card empty">
          No App Store listings matched this idea. Try naming what the app does in plainer words.
        </p>
        <div className="actions">
          <GlassButton variant="secondary" label="New idea" onTap={onRestart} />
        </div>
      </div>
    )
  }

  const pickedCell = picked && grid[picked.row]?.cells[picked.app]

  return (
    <div className="results">
      {brief.status === 'unavailable' && (
        <p className="notice">Gemini couldn't read the pitch, so no features were extracted. Ranking used your text as written.</p>
      )}
      {result.analysis_status === 'unavailable' && (
        <p className="notice">Gemini analysis is unavailable for this run. Feature cells show unverified embedding matches.</p>
      )}
      {result.review_status === 'partial' && <p className="notice">Reviews could not be loaded for some apps.</p>}
      {result.review_status === 'unavailable' && (
        <p className="notice">Competitor reviews could not be loaded, so there are no review-backed recommendations.</p>
      )}

      <section className="overview">
        <div className="card idea-card">
          <h2>{brief.appName || 'Your idea'}</h2>
          <p className="summary">{brief.appIdea}</p>
          {brief.keyFeatures.length > 0 && (
            <div className="chips">
              {brief.keyFeatures.map((f) => (
                <span key={f} className="chip">{f}</span>
              ))}
            </div>
          )}
          {(brief.targetAudience || brief.featuresInferred) && (
            <p className="muted small">
              {brief.targetAudience && `For ${brief.targetAudience}${brief.audienceInferred ? ' (inferred)' : ''}. `}
              {brief.featuresInferred && 'Features were inferred from your idea.'}
            </p>
          )}
          {gemini && <p>{gemini.overall_summary}</p>}
        </div>
        <div className="card stat-card">
          <strong>{apps.length}</strong>
          <span>closest of {result.candidate_count} App Store listings</span>
          <p className="muted small">
            Top match: {apps[0].AppName}, similarity index {Math.round(apps[0].similarity_percentage)}/100
          </p>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Closest apps</h2>
          <div className="segmented" role="group" aria-label="Sort competitors">
            {(['similarity', 'rating', 'price', 'revenue'] as SortKey[]).map((k) => (
              <button key={k} type="button" className={sort === k ? 'on' : undefined} onClick={() => setSort(k)}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small section-note">
          The similarity index (0–100) compares your idea with each full listing using sentence embeddings. It
          isn't a probability or a share of matching features.
        </p>
        <ul className="competitors">
          {order.map((i) => (
            <CompetitorCard
              key={apps[i].TrackId ?? i}
              rank={i + 1}
              app={apps[i]}
              explanation={explanation(i)}
              reviews={reviewsFor(i)}
              revenue={revenue[i]}
              revenueScale={revenueScale}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </ul>
      </section>

      {ranking.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Your features, most unique first</h2>
            <span className="muted">Counted from the evidence below</span>
          </div>
          <ol className="uniqueness">
            {ranking.map((f, i) => (
              <li key={f.feature} className="card">
                <span className="rank">{i + 1}</span>
                <div className="uniq-body">
                  <p className="issue">
                    {f.feature}{' '}
                    {f.described === 0 && f.related === 0 && <span className="sev low">gap</span>}
                    {f.described >= Math.ceil(apps.length * 0.6) && <span className="sev medium">common</span>}
                  </p>
                  <div className="uniq-bar" aria-hidden>
                    <span className="described" style={{ width: `${(f.described / apps.length) * 100}%` }} />
                    <span className="related" style={{ width: `${(f.related / apps.length) * 100}%` }} />
                  </div>
                  <p className="muted small">
                    {f.described} of {apps.length} listings describe it
                    {f.related > 0 && `; ${f.related} describe something related`}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {grid.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Feature evidence</h2>
            <span className="muted">
              {gemini ? 'Checked by Gemini against listing text' : 'Unverified embedding matches'}
            </span>
          </div>
          <div className="card evidence">
            <div className="evidence-scroll">
              <table className="evidence-grid">
                <thead>
                  <tr>
                    <th scope="col">Your feature</th>
                    {apps.map((a, i) => (
                      <th key={a.TrackId ?? i} scope="col">
                        <AppIcon name={a.AppName} url={a.ArtworkUrl || undefined} />
                        <span>{a.AppName}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row, r) => (
                    <tr key={row.feature}>
                      <th scope="row">{row.feature}</th>
                      {row.cells.map((cell, i) => (
                        <td key={i}>
                          <button
                            type="button"
                            className={`verdict ${cell.verdict}${picked?.row === r && picked.app === i ? ' on' : ''}`}
                            onClick={() => setPicked({ row: r, app: i })}
                            aria-label={`${row.feature} in ${apps[i].AppName}: ${VERDICT_LABEL[cell.verdict]}`}
                          >
                            {VERDICT_LABEL[cell.verdict]}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="evidence-detail" aria-live="polite">
              {picked && pickedCell ? (
                <>
                  <p className="small">
                    <strong>{grid[picked.row].feature}</strong> · {apps[picked.app].AppName}
                  </p>
                  {pickedCell.evidence ? (
                    <blockquote>“{pickedCell.evidence}”</blockquote>
                  ) : (
                    <p className="muted small">
                      The listing doesn't mention this. That doesn't prove the app lacks it.
                    </p>
                  )}
                </>
              ) : (
                <p className="muted small">Select a cell to see the listing passage behind it.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Fix what users complain about</h2>
          <span className="muted">From recent 1–2★ competitor reviews</span>
        </div>
        {gemini?.review_improvements.length ? (
          <ol className="beat-list">
            {gemini.review_improvements.map((item, i) => (
              <li key={item.complaint} className="card">
                <span className="rank">{i + 1}</span>
                <div>
                  <p className="issue">{item.complaint}</p>
                  <p className="fix">→ {item.recommendation}</p>
                  <ul className="citations">
                    {item.review_refs.map((ref) => {
                      const review = reviewsFor(ref.app_index)[ref.review_index]
                      return (
                        review && (
                          <li key={`${ref.app_index}-${ref.review_index}`}>
                            <span className="muted">
                              {apps[ref.app_index]?.AppName} · {stars(review.rating)}
                            </span>{' '}
                            “{ref.quote || review.title}”
                          </li>
                        )
                      )
                    })}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        ) : result.review_status === 'unavailable' ? (
          <p className="card empty">Review feeds were unavailable for this run.</p>
        ) : (
          <p className="card empty">
            No review-backed recommendations this time. Reviews may not have loaded, or the recent ones named no
            clear problem.
          </p>
        )}
      </section>

      {gemini && gemini.differentiation.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Ways to stand out</h2>
            <span className="muted">
              {planned.size}/{gemini.differentiation.length} planned
            </span>
          </div>
          <ul className="plan">
            {gemini.differentiation.map((d, i) => (
              <li key={d.idea}>
                <label className={`card plan-item${planned.has(i) ? ' checked' : ''}`}>
                  <input type="checkbox" checked={planned.has(i)} onChange={() => togglePlanned(i)} />
                  <div>
                    <p>
                      <strong>{d.idea}</strong>
                    </p>
                    <p className="muted small">{d.rationale}</p>
                    {d.supporting_app_indices.length > 0 && (
                      <p className="muted small">
                        Compared with{' '}
                        {d.supporting_app_indices
                          .map((j) => apps[j]?.AppName)
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saveError && <p className="error">{saveError}</p>}
      <div className="actions sticky">
        <GlassButton variant="secondary" label="New idea" onTap={onRestart} />
        <GlassButton
          label={saving ? 'Preparing…' : 'Download market analysis'}
          icon="arrow"
          disabled={saving}
          onTap={save}
        />
      </div>
    </div>
  )
}

interface CompetitorCardProps {
  rank: number
  app: RankedApp
  explanation?: string
  reviews: Review[]
  revenue?: RevenueEstimate
  revenueScale: { lo: number; hi: number } | null
  open: boolean
  onToggle: () => void
}

function CompetitorCard({ rank, app, explanation, reviews, revenue, revenueScale, open, onToggle }: CompetitorCardProps) {
  return (
    <li className={`card competitor${open ? ' open' : ''}`}>
      <button type="button" className="competitor-head" onClick={onToggle} aria-expanded={open}>
        <AppIcon name={app.AppName} url={app.ArtworkUrl || undefined} />
        <div className="competitor-meta">
          <strong>
            {rank}. {app.AppName}
          </strong>
          <span className="muted small">
            {app.Developer}
            {app.Genre && ` · ${app.Genre}`}
          </span>
          <span className="small">
            {app.Price || 'Price unknown'} ·{' '}
            {app.RatingCount ? (
              <>
                ★ {app.Rating.toFixed(1)} <span className="muted">({compact(app.RatingCount)})</span>
              </>
            ) : (
              <span className="muted">No ratings yet</span>
            )}
          </span>
          <RevenueLine revenue={revenue} />
        </div>
        <Ring value={app.similarity_percentage / 100} basis={app.score_basis} />
        <span className="chevron" aria-hidden>
          ›
        </span>
      </button>
      {open && (
        <div className="competitor-body">
          <RevenueDetail revenue={revenue} scale={revenueScale} />
          <div>
            <h3>Why it ranks here</h3>
            <p>{explanation ?? 'No Gemini explanation for this run.'}</p>
          </div>
          <div>
            <h3>Recent 1–2★ reviews</h3>
            {reviews.length ? (
              <ul className="reviews">
                {reviews.map((r, i) => (
                  <li key={i}>
                    <span className="stars" aria-label={`${r.rating} out of 5 stars`}>
                      {stars(r.rating)}
                    </span>{' '}
                    <strong>{r.title}</strong>
                    <p className="muted small">{clip(r.text, 220)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No recent 1- or 2-star reviews found.</p>
            )}
          </div>
          {app.AppStoreUrl && (
            <a className="small" href={app.AppStoreUrl} target="_blank" rel="noreferrer">
              View on the App Store ↗
            </a>
          )}
        </div>
      )}
    </li>
  )
}

/* ---------------- Revenue on the competitor cards ---------------- */

function RevenueLine({ revenue }: { revenue?: RevenueEstimate }) {
  if (revenue?.status === 'no_store_revenue') {
    return <span className="small muted">No App Store revenue (free, nothing to buy)</span>
  }
  if (revenue?.status !== 'available' || !revenue.estimate) return null
  return (
    <span className="small revenue-line">
      Est. revenue <strong>~{money(revenue.estimate)}/mo</strong>{' '}
      <span className={`sev ${revenue.confidence === 'medium' ? 'medium' : 'high'}`}>{revenue.confidence} confidence</span>
    </span>
  )
}

function RevenueDetail({ revenue, scale }: { revenue?: RevenueEstimate; scale: { lo: number; hi: number } | null }) {
  if (revenue?.status === 'no_store_revenue') {
    return (
      <div>
        <h3>Estimated revenue</h3>
        <p>
          Free with no in-app purchases, so it earns nothing through the App Store. Any income comes from ads,
          donations or outside the app.
        </p>
      </div>
    )
  }
  if (revenue?.status !== 'available' || !revenue.estimate || !revenue.likely || !scale) return null
  const pos = (v: number) => `${((Math.log(v) - scale.lo) / Math.max(scale.hi - scale.lo, 1e-9)) * 100}%`
  const [low, high] = revenue.likely
  return (
    <div>
      <h3>Estimated revenue</h3>
      <p>
        <strong>~{money(revenue.estimate)} / month</strong> <span className="muted small">before store fees</span>
      </p>
      <div className="revenue-bar" role="img" aria-label={`Likely ${money(low)} to ${money(high)} per month`}>
        <span className="revenue-range" style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }} />
        <span className="revenue-point" style={{ left: pos(revenue.estimate) }} />
      </div>
      <p className="muted small">
        Likely {money(low)}–{money(high)} · based on {revenue.basis}
        {revenue.paid_app && ' · paid app: not validated, treat as very rough'}. Bars share one scale across the
        competitors. Estimated from public store data, not reported revenue: in testing the likely range held about{' '}
        {revenue.confidence === 'medium' ? '3 in 4' : '2 in 3'} times.
      </p>
    </div>
  )
}

/* ---------------- Liquid glass ---------------- */

const GLASS_FONT = { fontFamily: 'var(--heading)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }

function GlassButton({
  variant = 'primary',
  ...props
}: LiquidGlassButtonProps & { variant?: 'primary' | 'secondary' }) {
  const primary = variant === 'primary'
  const dark = useContext(ThemeContext) === 'dark'
  return (
    <LiquidGlassButton
      material={primary ? 'tinted' : 'clear'}
      surface={dark ? 'dark' : 'light'}
      tint={primary ? 'var(--accent)' : '#fff'}
      textColor={primary ? 'var(--accent-ink)' : 'var(--text-h)'}
      icon={primary ? 'chevron' : 'none'}
      padding="13px 24px"
      font={GLASS_FONT}
      focusColor="var(--accent)"
      {...props}
    />
  )
}

function GlassFooter({ showHow }: { showHow: boolean }) {
  const toTop = scrollToTop
  return (
    <footer className="glass-footer">
      <div className="glass-footer-content">
        <div className="glass-footer-top">
          <div className="glass-footer-brand">
            <span className="glass-footer-logo">
              <LogoMark className="glass-footer-mark" />
              Apposition
            </span>
            <p>Know your competition before you build. App Store research, done in seconds.</p>
          </div>
          <nav className="glass-footer-links" aria-label="Footer">
            <div>
              <h3>Product</h3>
              <button type="button" onClick={toTop}>
                Analyze an idea
              </button>
              {showHow && <a href="#how">How it works</a>}
            </div>
          </nav>
        </div>
        <div className="glass-footer-divider" />
        <div className="glass-footer-bottom">
          <span>© {new Date().getFullYear()} Apposition</span>
          <GlassButton
            variant="secondary"
            label="Back to top"
            padding="8px 16px"
            font={{ ...GLASS_FONT, fontSize: 13 }}
            onTap={toTop}
          />
        </div>
      </div>
    </footer>
  )
}

/* ---------------- Small visuals ---------------- */

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="50" className="mark-disc" />
      <g className="mark-a">
        <circle cx="48" cy="50.8" r="30.5" fill="#fff" />
        <rect x="64.8" y="50.8" width="13.7" height="30.5" fill="#fff" />
        <circle cx="49.5" cy="47.3" r="15.3" className="mark-hole" />
        <rect x="61.6" y="58" width="3.2" height="12" className="mark-hole" />
      </g>
    </svg>
  )
}

const WORDMARK = [...'Apposition']

function Logo() {
  return (
    <h1 className="logo" aria-label="Apposition">
      <LogoMark className="logo-mark" />
      <span className="wordmark" aria-hidden>
        {WORDMARK.map((ch, i) => (
          <span key={i} style={{ animationDelay: `${0.35 + i * 0.05}s` }}>
            {ch}
          </span>
        ))}
      </span>
    </h1>
  )
}

const TILES = [8, 19, 31, 44, 58, 69, 81, 92]

function Tiles() {
  return (
    <div className="tiles" aria-hidden>
      {TILES.map((left, i) => (
        <span key={left} style={{ left: `${left}%`, animationDelay: `${(i * 1.13) % 9}s` }} />
      ))}
    </div>
  )
}

function Orbit() {
  return (
    <div className="orbit" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`orbit-ring r${i}`}>
          <span />
          <span />
        </div>
      ))}
      <LogoMark className="orbit-mark" />
    </div>
  )
}

function AppIcon({ name, url }: { name: string; url?: string }) {
  if (url) return <img className="app-icon" src={url} alt="" />
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7)
  return (
    <span className="app-icon" style={{ background: `hsl(${hue} 60% 55%)` }} aria-hidden>
      {name[0]}
    </span>
  )
}

function Ring({ value, basis }: { value: number; basis: string }) {
  const r = 22
  const c = 2 * Math.PI * r
  const pct = Math.round(value * 100)
  return (
    <div className="ring" title={`Similarity index ${pct}/100. ${basis}`}>
      <svg viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r={r} className="ring-track" />
        <circle
          cx="26"
          cy="26"
          r={r}
          className={`ring-fill ${pct >= 75 ? 'high' : pct >= 55 ? 'medium' : 'low'}`}
          strokeDasharray={c}
          style={{ strokeDashoffset: c * (1 - value), ['--c' as string]: c }}
        />
      </svg>
      <span>{pct}</span>
    </div>
  )
}

/* ---------------- Helpers ---------------- */

// $1.2M, $85K, $900: the estimates are ranges, so two significant figures is plenty.
function money(v: number) {
  if (v >= 1e9) return `$${+(v / 1e9).toPrecision(2)}B`
  if (v >= 1e6) return `$${+(v / 1e6).toPrecision(2)}M`
  if (v >= 1e3) return `$${+(v / 1e3).toPrecision(2)}K`
  return `$${Math.round(v)}`
}

function compact(n: number) {
  return Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}

// One row per user feature, one cell per ranked app, in ranked order.
function evidenceGrid(result: AnalysisResult): GridRow[] {
  if (result.analysis) {
    return result.analysis.feature_comparison.map((row) => {
      const byApp = new Map(row.competitors.map((c) => [c.app_index, c]))
      return {
        feature: row.feature,
        cells: result.results.map((_, i) => ({
          verdict: byApp.get(i)?.verdict ?? 'not_established',
          evidence: byApp.get(i)?.evidence ?? '',
        })),
      }
    })
  }
  return result.feature_matrix.rows.map((row) => ({
    feature: row.feature,
    cells: row.cells.map((c) => ({
      verdict: c.candidate_match ? 'candidate' : 'not_established',
      evidence: c.candidate_match ? (c.evidence[0]?.passage ?? '') : '',
    })),
  }))
}

// Most unique first: fewest listings describing it, then fewest related.
// Counted from the verdicts, never asked of Gemini; ties keep the founder's order.
function rankFeatures(grid: GridRow[]) {
  return grid
    .map((row, order) => ({
      feature: row.feature,
      described: row.cells.filter((c) => c.verdict === 'supported' || c.verdict === 'candidate').length,
      related: row.cells.filter((c) => c.verdict === 'related').length,
      order,
    }))
    .sort((a, b) => a.described - b.described || a.related - b.related || a.order - b.order)
}

// Unknown or not-applicable revenue sorts last.
function revenueValue(r?: RevenueEstimate) {
  if (r?.status === 'available' && r.estimate) return r.estimate
  return r?.status === 'no_store_revenue' ? 0 : -1
}

// Apple formats prices ("Free", "$2.99"); unknown prices sort last.
function priceValue(price: string) {
  if (/free/i.test(price)) return 0
  const n = parseFloat(price.replace(/[^0-9.]/g, ''))
  return Number.isNaN(n) ? Infinity : n
}

function stars(rating: number) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

export default App
