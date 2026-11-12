import { loadImage } from './preload'
import type { State } from './store'

// One-time follow-up: the repaired "Wolpyeong" card got its thumbnail cut from the stored (already trimmed)
// drawing with the full-paper crop, so it zoomed into the cap. Re-cut it from the trimmed drawing:
// a square as wide as the drawing, from the top (head + shoulders).
const isRepaired = (c: State['cards'][string]) => c.serial === 'SN261112-04' && c.nickname === 'Wolpyeong' && c.mood === 'Sleepy'

export async function rethumbRepaired(s: State) {
  const out: Record<string, { thumb: string }> = {}
  for (const card of Object.values(s.cards)) {
    if (!card.thumb || !isRepaired(card)) continue
    const img = new Image()
    await loadImage(img, card.image)
    if (!img.naturalWidth) continue
    const side = 200
    const w = img.naturalWidth * 1.06 // a little air around the head
    const t = document.createElement('canvas')
    t.width = t.height = side
    t.getContext('2d')!.drawImage(img, -img.naturalWidth * 0.03, -img.naturalWidth * 0.04, w, w, 0, 0, side, side)
    out[card.id] = { thumb: t.toDataURL('image/png') }
  }
  return out
}
