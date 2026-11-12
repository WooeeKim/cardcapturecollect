import { useEffect, useState } from 'react'

export const APP_NAME = 'card capture collect'

const HOLD_MS = 1000 // name stays on screen
const LEAVE_MS = 700 // blur transition into the app

// App name on launch: holds ~1s, then the whole cover blurs away and the app comes into focus underneath
// (the cover's backdrop blur eases from 14px to 0 while it fades, so the first screen "slides" into focus).
// Waits for `ready` so a slow account load never shows a half-loaded screen.
export function Splash({ ready }: { ready: boolean }) {
  const [held, setHeld] = useState(false)
  const [gone, setGone] = useState(false)
  const leaving = held && ready

  useEffect(() => {
    const t = window.setTimeout(() => setHeld(true), HOLD_MS)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => setGone(true), LEAVE_MS)
    return () => clearTimeout(t)
  }, [leaving])

  if (gone) return null
  const ease = `${LEAVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
  return (
    <div
      aria-hidden={leaving}
      className="splash absolute inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: leaving ? 'rgb(249 249 249 / 0)' : 'rgb(249 249 249 / 1)',
        backdropFilter: leaving ? 'blur(0px)' : 'blur(14px)',
        WebkitBackdropFilter: leaving ? 'blur(0px)' : 'blur(14px)',
        transition: `background-color ${ease}, backdrop-filter ${ease}, -webkit-backdrop-filter ${ease}`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* outer: leave transition; inner: fade-in on mount (an animation would override the outer's opacity if on one element) */}
      <div
        style={{
          opacity: leaving ? 0 : 1,
          filter: leaving ? 'blur(10px)' : 'blur(0px)',
          transform: leaving ? 'scale(1.06)' : 'scale(1)',
          transition: `opacity ${ease}, filter ${ease}, transform ${ease}`,
        }}
      >
        <h1 className="animate-fade-in text-center font-hand text-[40px] leading-[1.05] tracking-[-0.8px]">
          card
          <br />
          capture
          <br />
          collect
        </h1>
      </div>
    </div>
  )
}
