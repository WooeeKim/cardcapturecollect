import { useSyncExternalStore } from 'react'

// Frame layout chosen by main.tsx fit():
// - phone / PC / tablet held upright: the 402-wide Figma phone frame
// - tablet held sideways (`wide`): WIDE_H tall and as wide as the screen (w ≥ ~1000). Screens with a landscape
//   design (Figma "09 iPad 가로 (안)") lay their phone pieces out across it; the rest sit in a centered phone column.
export const PHONE_W = 402
export const PHONE_H = 874
export const WIDE_H = 834

export type Layout = { wide: boolean; w: number }
let layout: Layout = { wide: false, w: PHONE_W }
const subs = new Set<() => void>()

export function setLayout(wide: boolean, w: number) {
  w = Math.round(w)
  if (wide === layout.wide && w === layout.w) return
  layout = { wide, w }
  subs.forEach((f) => f())
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const useLayout = () => useSyncExternalStore(subscribe, () => layout)
