import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// Port of the Framer "LogoPreloader": the logo rises in on a white screen, holds, then lifts out
// while the screen fades away. Skipped entirely for reduced motion.
type Phase = 'init' | 'loading' | 'logoOut' | 'done'

const HOLD_MS = 2000
const FADE_MS = 700
const EASE = 'cubic-bezier(.7,.2,.2,1)'

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const LOGO: Record<Exclude<Phase, 'done'>, { y: number; opacity: number }> = {
  init: { y: 80, opacity: 0 },
  loading: { y: 0, opacity: 1 },
  logoOut: { y: -80, opacity: 0 },
}

export default function Preloader({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'done' : 'init')

  useEffect(() => {
    if (reducedMotion) {
      onDone()
      return
    }
    const timers = [
      setTimeout(() => setPhase('loading'), 50),
      setTimeout(() => setPhase('logoOut'), HOLD_MS + 50),
      setTimeout(() => {
        setPhase('done')
        onDone()
      }, HOLD_MS + 50 + FADE_MS),
    ]
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  if (phase === 'done') return null
  const logo = LOGO[phase]

  return (
    <div
      className="preloader"
      role="status"
      aria-label="Loading"
      style={{ opacity: phase === 'logoOut' ? 0 : 1, transition: `opacity ${FADE_MS}ms ${EASE}` }}
    >
      <div
        className="preloader-logo"
        style={{
          transform: `translateY(${logo.y}px)`,
          opacity: logo.opacity,
          transition: `transform ${FADE_MS}ms ${EASE}, opacity ${FADE_MS}ms ${EASE}`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
