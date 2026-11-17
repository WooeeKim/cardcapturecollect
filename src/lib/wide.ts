import { useSyncExternalStore } from 'react'

// iPad held sideways (Figma UX › 09 iPad 가로 (안)): the app frame is 1194×834 instead of the phone's 402×874,
// and screens switch to their landscape layout. Set by main.tsx (fit), read with useWide().
// <site>/?ipad forces it on any window that is wider than tall (to check the layout on a PC).
export const WIDE_W = 1194
export const WIDE_H = 834
// screens with no landscape design sit in a phone-width column in the middle (WideCol in components/ui.tsx)
export const COL_X = (WIDE_W - 402) / 2

let wide = false
const subs = new Set<() => void>()

export function setWide(v: boolean) {
  if (v === wide) return
  wide = v
  subs.forEach((f) => f())
}

export const isWide = () => wide

export function useWide() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => wide,
  )
}
