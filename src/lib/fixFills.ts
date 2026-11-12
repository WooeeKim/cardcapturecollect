import { loadImage } from './preload'
import type { State } from './store'

// One-time data fix: cards drawn before 2026-11-12 had the fill tool painted at 35% opacity.
// Those pixels are made solid in the light tint they showed on the white card, so walkers no longer show through each other.
export const CUTOFF = '2026-11-12T12:40:00.000Z' // fill became solid after this deploy
const OLD_ALPHA = 89 / 255 // 35% as stored in the PNG

async function solidify(src: string, force = false): Promise<string | null> {
  const img = new Image()
  await loadImage(img, src)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, c.width, c.height)
  const px = data.data
  // only touch drawings that really have see-through fill (lots of pixels around 35% alpha)
  let fill = 0
  for (let i = 3; i < px.length; i += 4) if (px[i] >= 80 && px[i] <= 98) fill++
  if (!force && fill < (px.length / 4) * 0.005) return null
  // keep the light tint it showed (color laid over the white card), but solid
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255
    if (a === 0 || a === 1) continue
    const solid = Math.min(1, a / OLD_ALPHA)
    // color seen = c·a + white·(1−a); stored with the new alpha so it shows the same over white
    for (let k = 0; k < 3; k++) px[i + k] = Math.round(255 - (255 - px[i + k]) * (a / solid))
    px[i + 3] = Math.round(solid * 255)
  }
  ctx.putImageData(data, 0, 0)
  return c.toDataURL('image/png')
}

// returns the fixed images by card id (empty when nothing needed fixing)
export async function fixOldFills(s: State) {
  const out: Record<string, { image: string; thumb?: string }> = {}
  for (const card of Object.values(s.cards)) {
    if (!card.image || card.createdAt >= CUTOFF) continue
    try {
      const image = await solidify(card.image)
      if (!image) continue
      out[card.id] = { image, thumb: card.thumb ? ((await solidify(card.thumb, true)) ?? card.thumb) : undefined }
    } catch {
      /* broken image: leave it */
    }
  }
  return out
}
