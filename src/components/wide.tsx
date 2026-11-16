import type { CSSProperties, ReactNode } from 'react'
import { PHONE_H, PHONE_W, WIDE_H, useLayout } from '../lib/layout'

// Landscape tablet helpers (lib/layout.ts).

// A piece of a phone layout (Figma 402×874 px, children positioned as on the phone) moved on the wide screen:
// the phone point `from` lands on `to`, optionally scaled around it. --cut is 0 inside, so phone `top`s are exact.
// The box itself lets touches through; its direct children take them as usual (unless they opt out themselves).
export function Shift({ from, to, scale = 1, className = '', style, children }: { from: [number, number]; to: [number, number]; scale?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className={`pointer-events-none absolute [&>*:not(.pointer-events-none)]:pointer-events-auto ${className}`}
      style={{
        left: to[0] - from[0],
        top: to[1] - from[1],
        width: PHONE_W,
        height: PHONE_H,
        transformOrigin: `${from[0]}px ${from[1]}px`,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        ['--cut' as string]: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// On the wide screen, phone pieces only when wide (otherwise rendered as is).
export function WideShift(props: Parameters<typeof Shift>[0]) {
  const { wide } = useLayout()
  return wide ? <Shift {...props} /> : <>{props.children}</>
}

// A screen without a landscape design: the phone layout in a phone-wide column in the middle.
// `className` paints the whole screen behind it (the screen's own background, so the sides match).
export function Column({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { wide, w } = useLayout()
  if (!wide) return <>{children}</>
  return (
    <div className={`absolute inset-0 ${className}`}>
      {/* a phone WIDE_H tall: things pinned to the bottom (Bottom) move up by the difference */}
      <div className="absolute inset-y-0" style={{ left: (w - PHONE_W) / 2, width: PHONE_W, ['--cut' as string]: PHONE_H - WIDE_H }}>
        {children}
      </div>
    </div>
  )
}
