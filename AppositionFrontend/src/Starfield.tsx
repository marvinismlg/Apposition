import { useEffect, useRef } from 'react'

// Page background after the Framer "Stars Galaxy" component, at its default settings: stars fly
// out from the centre with a gentle twinkle. Colours follow the theme. Reduced motion draws one
// still frame.
const STARS = 1000
const SPEED = 2
const SPREAD = 5
const FOCAL = 2
const TWINKLE = 0.35
const SIZE = 2
const FADE_IN_RANGE = 5
const REVERSE_FLY = true

type Star = { x: number; y: number; z: number; tw: number }

const createStar = (): Star => ({
  x: (Math.random() - 0.5) * SPREAD,
  y: (Math.random() - 0.5) * SPREAD,
  z: Math.random(),
  tw: Math.random() * Math.PI * 2,
})

export default function Starfield({ background, starColor }: { background: string; starColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const stars = Array.from({ length: STARS }, createStar)
    let frame = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (still) draw()
    }

    const draw = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.globalAlpha = 1
      ctx.fillStyle = background
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = starColor
      for (const s of stars) {
        const depth = s.z * FOCAL + 0.001
        const px = w / 2 + (s.x / depth) * w
        const py = h / 2 + (s.y / depth) * h
        if (!still) {
          s.z += (REVERSE_FLY ? 1 : -1) * SPEED * 0.002
          if (s.z <= 0 || s.z > 1) Object.assign(s, createStar())
          s.tw += TWINKLE * 0.05
        }
        ctx.globalAlpha = Math.max(0, 1 - s.z / FADE_IN_RANGE)
        ctx.beginPath()
        ctx.arc(px, py, Math.max(0, SIZE * (1 - s.z) * (1 + Math.sin(s.tw) * TWINKLE)), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const animate = () => {
      draw()
      frame = requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener('resize', resize)
    if (still) draw()
    else animate()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [background, starColor])

  return <canvas ref={canvasRef} className="starfield" aria-hidden />
}
