import { useEffect, useState } from 'react'

// Typewriter headline after the Framer "Smart Typewriter Pro": human-ish typing with timing
// variation, delete-and-retype loop, blinking bar caret, and no layout jump (the longest
// phrase reserves the space). Reduced motion shows the first phrase, static.
const TYPE_MS = 55
const DELETE_MS = 28
const HOLD_MS = 2200
const GAP_MS = 400

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Slightly longer pauses after punctuation and spaces read as natural typing.
const typeDelay = (ch: string) => TYPE_MS * (0.6 + Math.random() * 0.8) + (/[.,!?]/.test(ch) ? 180 : ch === ' ' ? 40 : 0)

interface Props {
  phrases: string[]
  className?: string
  /** Hold off typing until true (e.g. while a preloader covers the page). */
  start?: boolean
}

export default function Typewriter({ phrases, className, start = true }: Props) {
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(reducedMotion ? phrases[0].length : 0)
  const [deleting, setDeleting] = useState(false)

  const phrase = phrases[index]
  const idle = !deleting && length === phrase.length

  useEffect(() => {
    if (reducedMotion || !start) return
    let delay: number
    let step: () => void
    if (!deleting && length < phrase.length) {
      delay = typeDelay(phrase[length])
      step = () => setLength(length + 1)
    } else if (!deleting) {
      delay = HOLD_MS
      step = () => setDeleting(true)
    } else if (length > 0) {
      delay = DELETE_MS
      step = () => setLength(length - 1)
    } else {
      delay = GAP_MS
      step = () => {
        setDeleting(false)
        setIndex((index + 1) % phrases.length)
      }
    }
    const id = setTimeout(step, delay)
    return () => clearTimeout(id)
  }, [start, length, deleting, phrase, index, phrases.length])

  const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a), '')

  return (
    <h2 className={`typewriter${className ? ` ${className}` : ''}`}>
      <span className="sr-only">{phrases[0]}</span>
      <span className="typewriter-stack" aria-hidden>
        <span className="typewriter-ghost">{longest}</span>
        <span className="typewriter-live">
          {phrase.slice(0, length)}
          <span className={`typewriter-caret${idle ? ' blink' : ''}`} />
        </span>
      </span>
    </h2>
  )
}
