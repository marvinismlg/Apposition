import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { APP_ICONS } from './appIcons'
import { BLUES } from './icons'
import './Showcase.css'

const SCENE_MS = 5500

const SCENES = [
  {
    title: 'Describe your idea',
    text: 'Type one sentence. Add features and your audience if you like. Plain words work.',
  },
  {
    title: 'Scan the App Store',
    text: 'We search thousands of apps and score how similar each one is to your idea.',
  },
  {
    title: 'See the overlap',
    text: 'Every competitor is tagged with shared features, price, rating and what users complain about.',
  },
  {
    title: 'Find your edge',
    text: 'Get a ranked list of weaknesses to beat and features that set you apart.',
  },
]

const IDEAS = [
  'lets neighbours swap houseplants',
  'splits grocery bills with roommates',
  'matches runners at the same pace',
]
const QUERIES = ['no ads', 'offline mode', 'free chat', 'verified swaps']

const SPHERE_TILES = 44
const SPHERE = Array.from({ length: SPHERE_TILES }, (_, k) => {
  const y = 1 - (2 * (k + 0.5)) / SPHERE_TILES
  return { lat: (Math.asin(y) * 180) / Math.PI, lon: k * 137.508 }
})
const CLOUD = Array.from({ length: 22 }, (_, k) => ({
  x: ((k * 37) % 100) - 50,
  y: ((k * 53) % 100) - 50,
  depth: 0.55 + ((k * 29) % 45) / 100,
}))

function AppIcon({ index }: { index: number }) {
  const app = APP_ICONS[index % APP_ICONS.length]
  return <img src={app.url} alt="" title={app.name} decoding="async" draggable={false} />
}

function useTyping(words: string[], active: boolean) {
  const [state, setState] = useState({ text: '', word: 0 })

  useEffect(() => {
    if (!active) return
    let word = 0
    let n = 0
    let deleting = false
    let id = 0
    const tick = () => {
      const full = words[word]
      if (!deleting && n === full.length) {
        deleting = true
        id = window.setTimeout(tick, 1500)
        return
      }
      if (deleting && n === 0) {
        deleting = false
        word = (word + 1) % words.length
      }
      n += deleting ? -1 : 1
      setState({ text: words[word].slice(0, n), word })
      id = window.setTimeout(tick, deleting ? 28 : 60)
    }
    id = window.setTimeout(tick, 500)
    return () => {
      clearTimeout(id)
      setState({ text: '', word: 0 })
    }
  }, [active, words])

  return state
}

function useCount(target: number, active: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 3200)
      setN(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      setN(0)
    }
  }, [target, active])
  return n
}

/* ---------------- scenes ---------------- */

function DescribeScene({ active }: { active: boolean }) {
  const { text } = useTyping(IDEAS, active)
  return (
    <div className="sc-describe">
      <div className="sc-card">
        <p className="sc-label">I have an idea for an app that&hellip;</p>
        <p className="sc-typed">
          {text}
          <span className="caret" />
        </p>
        <ul>
          <li className="done">Features added</li>
          <li className="done">Audience set</li>
          <li>Find my competitors</li>
        </ul>
      </div>
    </div>
  )
}

function ScanScene({ active }: { active: boolean }) {
  const count = useCount(1284, active)
  return (
    <div className="sc-scan">
      <div className="sphere">
        {SPHERE.map((p, k) => (
          <span
            key={k}
            className="app-tile"
            style={{
              transform: `rotateY(${p.lon}deg) rotateX(${p.lat}deg) translateZ(150px)`,
              background: BLUES[k % BLUES.length],
            }}
          >
            <AppIcon index={k} />
          </span>
        ))}
      </div>
      <div className="pill">Scanning {count.toLocaleString()} apps&hellip;</div>
    </div>
  )
}

// Real competitor for the houseplant example (App Store listing, 26 Sep 2026). Tags stick to what
// the listing says; the similarity score is illustrative, as Apposition would score it.
const OVERLAP_APP = {
  name: 'Palmstreet',
  developer: 'Plant Identification, Inc.',
  rating: '4.8',
  icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d2/ee/f8/d2eef8a6-426e-81f3-fcd3-d0e107a5662a/AppIcon-0-0-1x_U007emarketing-0-11-0-85-220.png/100x100bb.jpg',
}

function OverlapScene() {
  return (
    <div className="sc-overlap">
      <div className="comp-card">
        <div className="comp-head">
          <span className="app-tile big" style={{ background: BLUES[1] }}>
            <img src={OVERLAP_APP.icon} alt="" decoding="async" draggable={false} />
          </span>
          <div>
            <strong>{OVERLAP_APP.name}</strong>
            <span>
              {OVERLAP_APP.developer} · <span className="nowrap">★ {OVERLAP_APP.rating}</span>
            </span>
          </div>
        </div>
        <span className="line" />
        <span className="line short" />
        <span className="line" />
      </div>
      <span className="sc-tag t1">64% similar</span>
      <span className="sc-tag t2">Free</span>
      <span className="sc-tag t3">Live plant auctions</span>
      <span className="sc-tag t4">Buy &amp; sell plants</span>
    </div>
  )
}

function EdgeScene({ active }: { active: boolean }) {
  const { text, word } = useTyping(QUERIES, active)
  return (
    <div className="sc-edge">
      {CLOUD.map((c, k) => (
        <span
          key={k}
          className={`app-tile${(k * 3 + word * 5) % 7 < 2 && text ? ' hit' : ''}`}
          style={
            {
              '--x': `${c.x * 4.2}px`,
              '--y': `${c.y * 2.6}px`,
              '--s': c.depth,
              background: BLUES[k % BLUES.length],
              animationDelay: `${-k * 0.37}s`,
            } as CSSProperties
          }
        >
          <AppIcon index={k + SPHERE_TILES} />
        </span>
      ))}
      <div className="search">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" />
        </svg>
        <span>{text || 'Search for a gap…'}</span>
        <span className="caret" />
      </div>
    </div>
  )
}

/* ---------------- showcase ---------------- */

export default function Showcase({ onTry }: { onTry: () => void }) {
  const [scene, setScene] = useState(0)
  const [hover, setHover] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const last = scene === SCENES.length - 1
  const playing = visible && !hover

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS)
    return () => clearTimeout(id)
  }, [scene, playing])

  return (
    <section
      id="how"
      ref={ref}
      className="showcase"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <p className="eyebrow">How it works</p>

      <div className="stage" aria-hidden>
        <div className={`scene${scene === 0 ? ' on' : ''}`}>
          <DescribeScene active={visible && scene === 0} />
        </div>
        <div className={`scene${scene === 1 ? ' on' : ''}`}>
          <ScanScene active={visible && scene === 1} />
        </div>
        <div className={`scene${scene === 2 ? ' on' : ''}`}>{scene === 2 && <OverlapScene />}</div>
        <div className={`scene${scene === 3 ? ' on' : ''}`}>
          <EdgeScene active={visible && scene === 3} />
        </div>
      </div>

      <div key={scene} className="copy" aria-live="polite">
        <h2>{SCENES[scene].title}</h2>
        <p>{SCENES[scene].text}</p>
      </div>

      <div className="controls">
        <div className="dots">
          {SCENES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Show step ${i + 1}: ${s.title}`}
              aria-current={i === scene}
              className={i === scene ? 'on' : undefined}
              onClick={() => setScene(i)}
            >
              {i === scene && (
                <span
                  key={scene}
                  style={{ animationDuration: `${SCENE_MS}ms`, animationPlayState: playing ? 'running' : 'paused' }}
                />
              )}
            </button>
          ))}
        </div>
        <button type="button" className="primary" onClick={last ? onTry : () => setScene(scene + 1)}>
          {last ? 'Try it now' : 'Continue'}
        </button>
      </div>
    </section>
  )
}
