import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

// Smooth wheel scrolling, after the Framer "NextSmoothScroll" component (which wraps Lenis) at its
// defaults: 1s duration, exponential ease-out, touch left native, off for reduced motion.
let lenis: Lenis | null = null

export function startSmoothScroll() {
  if (lenis || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  lenis = new Lenis({
    duration: 1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    anchors: true,
    autoRaf: true,
  })
  return () => {
    lenis?.destroy()
    lenis = null
  }
}

// Use this instead of window.scrollTo so programmatic scrolls ride the same easing.
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0)
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}
