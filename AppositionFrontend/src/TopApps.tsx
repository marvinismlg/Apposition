import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import './TopApps.css'

interface ChartApp {
  id: string
  name: string
  artistName: string
  artworkUrl100: string
  url: string
}

interface Figure {
  value: string
  note: string
}

interface Publisher {
  company: string
  revenue?: Figure
  valuation?: Figure
  users?: Figure
}

// Apple's public top-charts feed. It sends no CORS headers, so the browser goes through the
// /apple-rss proxy: vite.config.ts locally, the vercel.json rewrite when deployed.
const FEED = '/apple-rss/api/v2/us/apps/top-free/10/apps.json'

// App-level revenue and user counts are only sold by paid trackers (Sensor Tower, Appfigures), so
// these are the publisher's company-wide public figures. Monthly revenue = latest reported
// annual/quarterly figure ÷ 12 or 3. Hand-maintained: update when new numbers come out.
const FIGURES_AS_OF = 'Sep 2026'
const PUBLISHERS: [RegExp, Publisher][] = [
  [
    /^meta platforms/i,
    {
      company: 'Meta',
      revenue: { value: '~$20B', note: 'Q2 2026: $60.8B' },
      valuation: { value: '$1.9T', note: 'market cap' },
      users: { value: '3.6B', note: 'daily, all Meta apps' },
    },
  ],
  [
    /^openai/i,
    {
      company: 'OpenAI',
      revenue: { value: '~$3.3B', note: '$40B run-rate, Aug 2026' },
      valuation: { value: '$852B', note: 'Mar 2026 round' },
      users: { value: '1B', note: 'weekly, ChatGPT' },
    },
  ],
  [
    /^(bytedance|tiktok)/i,
    {
      company: 'ByteDance',
      revenue: { value: '~$10B', note: '2025: $120B+ (reported)' },
      valuation: { value: '$600B+', note: 'Apr 2026 share sale' },
      users: { value: '~1.9B', note: 'monthly, TikTok (est.)' },
    },
  ],
  [
    /^kalshi/i,
    {
      company: 'Kalshi',
      revenue: { value: '~$333M', note: '$4B run-rate, Jul 2026' },
      valuation: { value: '$22B', note: 'May 2026 round' },
      users: { value: '5.1M', note: 'monthly active' },
    },
  ],
  [
    /^vinted/i,
    {
      company: 'Vinted',
      revenue: { value: '~€92M', note: '2025: €1.1B' },
      valuation: { value: '€8B', note: 'Apr 2026 share sale' },
      users: { value: '100M+', note: 'registered members' },
    },
  ],
  [
    /^depop/i,
    {
      company: 'Depop (eBay)',
      valuation: { value: '$1.2B', note: '2026 acquisition' },
      users: { value: '7M', note: 'active buyers' },
    },
  ],
]

// Snapshot of the US Top Free chart on 26 Sep 2026, shown if the live feed can't be reached.
const SNAPSHOT: ChartApp[] = [
  { id: '6760173601', name: 'Muse from Meta', artistName: 'Meta Platforms, Inc.', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/73/72/9b/73729ba4-8f07-dabc-9e4c-07ee3d667630/HatchAppIconPublic-0-0-1x_U007ephone-0-1-0-sRGB-0-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/muse-from-meta/id6760173601' },
  { id: '1658822260', name: 'Momo: AI Photo & Video Maker', artistName: 'SCALEUP YAZILIM HIZMETLERI', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/64/54/cb/6454cb9a-2e57-f757-8cfc-53f9a99e5744/AppIcon-0-0-1x_U007ephone-0-1-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/momo-ai-photo-video-maker/id1658822260' },
  { id: '6448311069', name: 'ChatGPT', artistName: 'OpenAI OpCo, LLC', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/e6/9a/0e/e69a0e54-a15f-4b2a-cb42-84788edb896e/AppIcon-0-0-1x_U007epad-0-0-0-1-0-P3-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/chatgpt/id6448311069' },
  { id: '632064380', name: 'Vinted: Pre-loved marketplace', artistName: 'Vinted Limited', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/eb/96/7a/eb967a41-a61b-91e0-445f-d69024e823fd/VintedAppIcon-0-0-1x_U007epad-0-1-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/vinted-pre-loved-marketplace/id632064380' },
  { id: '6761538521', name: 'StoryReel: Drama Shorts & TV', artistName: 'Equinox Enterprises Technology Limited', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/fa/d8/be/fad8be6f-eead-eccd-1c4d-016a9283545e/AppIcon-0-0-1x_U007ephone-0-1-0-0-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/storyreel-drama-shorts-tv/id6761538521' },
  { id: '6754134922', name: 'PineDrama - Short Dramas', artistName: 'TikTok Ltd.', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/98/b7/fb/98b7fbce-3ff4-9400-c352-db149a7aeec4/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/pinedrama-short-dramas/id6754134922' },
  { id: '1500855883', name: 'CapCut: Photo & Video Editor', artistName: 'Bytedance Pte. Ltd', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a9/7d/61/a97d6162-c9cb-8fa3-d671-dae8538cb974/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883' },
  { id: '518684914', name: 'Depop - Buy & Sell Clothes', artistName: 'Depop Ltd', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ea/28/97/ea289765-a44d-8d66-8aaa-a933f2cddb1f/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/depop-buy-sell-clothes/id518684914' },
  { id: '1632713844', name: 'Kalshi: Trade Football & more', artistName: 'KalshiEX LLC', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/ea/e9/0f/eae90f74-6976-de1e-aca9-481daf8bfd40/AppIcon-0-0-1x_U007ephone-0-1-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/kalshi-trade-football-more/id1632713844' },
  { id: '6741796873', name: 'TikTok Pro - Events', artistName: 'TikTok Ltd.', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/8e/c6/1d/8ec61d8b-34a1-dbb1-ec6c-6267090aba11/AppIcon_TikTok-0-0-1x_U007emarketing-0-8-0-85-220.png/100x100bb.png', url: 'https://apps.apple.com/us/app/tiktok-pro-events/id6741796873' },
]

const COPIES = [0, 1, 2]

const cleanArtist = (artist: string) => artist.replace(/\u200c/g, '').trim()

function publisherFor(artist: string) {
  return PUBLISHERS.find(([re]) => re.test(cleanArtist(artist)))?.[1]
}

// The strip pauses on hover, so the tile holds still while its dropdown is open. If the dropdown
// would poke past either side of the window, skip it rather than show it cut off; if there's no
// room below the tile (the strip sits at the bottom of the first screen), open it upward.
const DROP_WIDTH = 230
function checkDropFits(e: SyntheticEvent<HTMLLIElement>) {
  const tile = e.currentTarget.querySelector('.top-app')
  if (!tile) return
  const { left, width, top, bottom } = tile.getBoundingClientRect()
  const center = left + width / 2
  const fits = center - DROP_WIDTH / 2 >= 0 && center + DROP_WIDTH / 2 <= document.documentElement.clientWidth
  e.currentTarget.dataset.drop = fits ? 'on' : 'off'
  const height = e.currentTarget.querySelector<HTMLElement>('.top-app-drop')?.offsetHeight ?? 0
  const roomBelow = window.innerHeight - bottom
  e.currentTarget.dataset.dropDir = roomBelow < height + 12 && top > roomBelow ? 'up' : 'down'
}

const ROWS = [
  ['revenue', 'Monthly revenue'],
  ['valuation', 'Valuation'],
  ['users', 'Users'],
] as const

export default function TopApps() {
  const [apps, setApps] = useState<ChartApp[]>(SNAPSHOT)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(FEED)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { feed: { results: ChartApp[] } }) => {
        if (cancelled || !data.feed.results.length) return
        setApps(data.feed.results.slice(0, 10))
        setLive(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // The list is rendered three times so the strip still fills wide screens while one copy scrolls
  // off the left; copies after the first are hidden from AT.
  const tile = (app: ChartApp, i: number, copy: number) => {
    const p = publisherFor(app.artistName)
    const summary = ROWS.map(([key, label]) => `${label} ${p?.[key]?.value ?? 'undisclosed'}`).join(', ')
    return (
      <li
        key={`${copy}-${app.id}`}
        className="top-app-item"
        aria-hidden={copy > 0 || undefined}
        onMouseEnter={checkDropFits}
        onFocus={checkDropFits}
      >
        <a
          className="top-app"
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={copy > 0 ? -1 : undefined}
          aria-label={`#${i + 1} ${app.name} by ${p?.company ?? cleanArtist(app.artistName)}. ${summary}`}
        >
          <img className="top-app-icon" src={app.artworkUrl100} alt="" loading="lazy" />
          <span className="top-app-name">{app.name.split(/[:\-–]/)[0].trim()}</span>
        </a>
        <div className="top-app-drop" aria-hidden>
          <p className="top-app-drop-head">
            <strong>{p?.company ?? cleanArtist(app.artistName)}</strong>
            <span>{p ? 'Company-wide, est.' : 'Private company'}</span>
          </p>
          <dl>
            {ROWS.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <strong>{p?.[key]?.value ?? '—'}</strong>
                  <span>{p?.[key]?.note ?? 'Not disclosed'}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </li>
    )
  }

  return (
    <section className="top-apps" aria-label="Top 10 free apps on the US App Store">
      <p className="top-apps-caption">
        <span className={`top-apps-dot${live ? ' live' : ''}`} aria-hidden />
        App Store Top 10 · Free · {live ? 'live chart' : 'snapshot 26 Sep 2026'} · hover an app for company
        revenue, valuation and users ({FIGURES_AS_OF}, public reports)
      </p>
      <div className="top-apps-track">
        <ul className="top-apps-strip" style={{ animationDuration: `${apps.length * 3.5}s` }}>
          {COPIES.map((copy) => apps.map((app, i) => tile(app, i, copy)))}
        </ul>
      </div>
    </section>
  )
}
