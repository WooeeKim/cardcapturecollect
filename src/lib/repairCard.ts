import original from '../assets/repair/hoodie-original.jpg'
import { CUTOFF } from './fixFills'
import { loadImage } from './preload'
import type { State } from './store'

// One-time repair for a card whose see-through fill the first fixFills version turned into the full line color
// (lines and fill had the same color, so the drawing alone can't tell them apart).
// The drawer's screenshot of how it used to look gives the colors; the card itself keeps its exact shape.
const GRID = { w: 48, h: 96 }

type Px = { c: HTMLCanvasElement; d: Uint8ClampedArray }
async function pixels(src: string): Promise<Px> {
  const img = new Image()
  await loadImage(img, src)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return { c, d: ctx.getImageData(0, 0, c.width, c.height).data }
}

// bounding box of the "inked" pixels
function bbox(p: Px, inked: (i: number) => boolean) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = 0; y < p.c.height; y++)
    for (let x = 0; x < p.c.width; x++)
      if (inked((y * p.c.width + x) * 4)) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

// coarse silhouette inside the box, to check the card really is that drawing
function silhouette(p: Px, b: ReturnType<typeof bbox>, inked: (i: number) => boolean) {
  const out = new Uint8Array(GRID.w * GRID.h)
  for (let gy = 0; gy < GRID.h; gy++)
    for (let gx = 0; gx < GRID.w; gx++) {
      const x = Math.floor(b.x0 + ((gx + 0.5) / GRID.w) * b.w)
      const y = Math.floor(b.y0 + ((gy + 0.5) / GRID.h) * b.h)
      out[gy * GRID.w + gx] = inked((y * p.c.width + x) * 4) ? 1 : 0
    }
  return out
}

function thumbOf(c: HTMLCanvasElement, side = 200) {
  const t = document.createElement('canvas')
  t.width = t.height = side
  const w = c.width * 0.773
  t.getContext('2d')!.drawImage(c, c.width * 0.113, 0, w, w, 0, 0, side, side)
  return t.toDataURL('image/png')
}

export async function repairCards(s: State) {
  const out: Record<string, { image: string; thumb?: string }> = {}
  const old = Object.values(s.cards).filter((c) => c.image && c.createdAt < CUTOFF)
  if (!old.length) return out
  const shot = await pixels(original)
  const shotInk = (i: number) => Math.min(shot.d[i], shot.d[i + 1], shot.d[i + 2]) < 225
  const sb = bbox(shot, shotInk)
  const ss = silhouette(shot, sb, shotInk)
  for (const card of old) {
    try {
      const p = await pixels(card.image)
      const ink = (i: number) => p.d[i + 3] > 60
      const b = bbox(p, ink)
      if (b.w < 20 || b.h < 20) continue
      const cs = silhouette(p, b, ink)
      let both = 0, either = 0
      for (let i = 0; i < cs.length; i++) {
        both += cs[i] & ss[i]
        either += cs[i] | ss[i]
      }
      if (both / either < 0.8) continue // not this drawing
      // colors from the screenshot at the same spot; the card's own alpha keeps the outline and the holes
      const ctx = p.c.getContext('2d')!
      const data = ctx.getImageData(0, 0, p.c.width, p.c.height)
      const d = data.data
      for (let y = 0; y < p.c.height; y++)
        for (let x = 0; x < p.c.width; x++) {
          const i = (y * p.c.width + x) * 4
          const a = d[i + 3] / 255
          if (!a) continue
          const sx = Math.min(shot.c.width - 1, Math.max(0, Math.round(sb.x0 + ((x - b.x0 + 0.5) / b.w) * sb.w)))
          const sy = Math.min(shot.c.height - 1, Math.max(0, Math.round(sb.y0 + ((y - b.y0 + 0.5) / b.h) * sb.h)))
          const j = (sy * shot.c.width + sx) * 4
          // seen = color·a + white·(1−a) → color, so it looks the same over the white card
          for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.round(255 - (255 - shot.d[j + k]) / a))
        }
      ctx.putImageData(data, 0, 0)
      out[card.id] = { image: p.c.toDataURL('image/png'), thumb: card.thumb ? thumbOf(p.c) : undefined }
    } catch {
      /* broken image: leave it */
    }
  }
  return out
}
