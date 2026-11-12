import type { Stroke } from '../components/DrawingCanvas'

// The paper is white while drawing, so unpainted spots inside a figure (face, shirt) look white —
// but they'd be see-through on the town ground. This fills "inside the drawing" with white under the lines.
//
// Outlines are rarely closed. Instead of a fixed gap size, each loose pen-stroke end looks *ahead along its own
// direction* for another line, and an invisible bridge closes the gap when it finds one:
//  - reach grows with the end's own run since its last sharp corner: after a long smooth arc (a circle) a big
//    gap is forgiven; a short piece after a corner (a ㄹ tail) only bridges a tiny one
//  - only within a cone ahead, so ends that point away (a ㄹ tail, arms, legs) don't get joined
// Then whatever the paper's edge can't reach through lines + bridges is inside.
const W = 400 // working width (the mask is smoothed when scaled back up)
const REACH = 0.25 // bridge reach, fraction of the end's run since the last sharp corner
const CORNER = (50 * Math.PI) / 180 // a turn sharper than this (over ~5 cells each side) is a corner
const MAX_REACH = 0.12 // …but never more than this fraction of the paper width
const CONE = (40 * Math.PI) / 180 // how far off the stroke's direction a bridge may go

type P = { x: number; y: number }

// cells reachable from the paper's edge without crossing `wall`
function floodOutside(wall: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (i: number) => {
    if (!wall[i] && !outside[i]) {
      outside[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x)
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1)
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (i >= w) push(i - w)
    if (i < w * (h - 1)) push(i + w)
  }
  return outside
}

// points every ~1 cell along the line, with the running length
function resample(pts: P[]) {
  const out: { x: number; y: number; s: number }[] = [{ ...pts[0], s: 0 }]
  let s = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.ceil(d))
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n, s: s + (d * k) / n })
    s += d
  }
  return out
}

// bridges between loose stroke ends and the line they point at (in mask cells)
export function bridges(strokes: P[][], w: number) {
  const lines = strokes.filter((p) => p.length > 1).map(resample)
  const out: [P, P][] = []
  lines.forEach((line, li) => {
    const len = line[line.length - 1].s
    if (len < 3) return
    for (const atEnd of [false, true]) {
      const end = atEnd ? line[line.length - 1] : line[0]
      // direction: from a little way back along the stroke to its end
      const back = Math.min(len / 3, w * 0.04)
      const ref = atEnd ? line.find((q) => q.s >= len - back)! : [...line].reverse().find((q) => q.s <= back)!
      const dx = end.x - ref.x
      const dy = end.y - ref.y
      const dl = Math.hypot(dx, dy)
      if (dl < 1) continue
      // run: how far back from this end the line goes before a sharp corner
      const K = 5
      let run = len
      const n = line.length
      for (let step = K; step < n - K; step++) {
        const i = atEnd ? n - 1 - step : step
        const a = line[i - K]
        const b = line[i]
        const c = line[i + K]
        const t = Math.acos(
          Math.max(-1, Math.min(1, ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y) || 1))),
        )
        if (t > CORNER) {
          run = Math.abs(end.s - b.s)
          break
        }
      }
      const reach = Math.min(MAX_REACH * w, Math.max(3, REACH * run))
      let best: P | null = null
      let bestScore = Infinity
      lines.forEach((other, oi) => {
        for (const q of other) {
          const vx = q.x - end.x
          const vy = q.y - end.y
          const d = Math.hypot(vx, vy)
          if (d < 1.5 || d > reach) continue
          // on its own stroke, only parts far along the line count (not the stretch right behind the end)
          if (oi === li && Math.abs(q.s - end.s) < 2.5 * d + 6) continue
          const ang = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / (d * dl))))
          if (ang > CONE) continue
          const score = d * (1 + ang / CONE)
          if (score < bestScore) {
            bestScore = score
            best = q
          }
        }
      })
      if (best) out.push([end, best])
    }
  })
  return out
}

export async function fillInside(blob: Blob, strokes: Stroke[] = []): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const w = W
  const h = Math.round((bmp.height / bmp.width) * W)
  const small = document.createElement('canvas')
  small.width = w
  small.height = h
  const sctx = small.getContext('2d')!
  sctx.drawImage(bmp, 0, 0, w, h)
  const ink = new Uint8Array(w * h)
  let px = sctx.getImageData(0, 0, w, h)
  for (let i = 0; i < ink.length; i++) ink[i] = px.data[i * 4 + 3] > 20 ? 1 : 0

  // invisible bridges, drawn into the mask only
  sctx.strokeStyle = '#000'
  sctx.lineWidth = 2
  sctx.lineCap = 'round'
  const lines = strokes.filter((s) => s.tool !== 'eraser').map((s) => s.points.map((p) => ({ x: p.x * w, y: p.y * h })))
  for (const [a, b] of bridges(lines, w)) {
    sctx.beginPath()
    sctx.moveTo(a.x, a.y)
    sctx.lineTo(b.x, b.y)
    sctx.stroke()
  }
  px = sctx.getImageData(0, 0, w, h)
  const wall = new Uint8Array(w * h)
  for (let i = 0; i < wall.length; i++) wall[i] = px.data[i * 4 + 3] > 20 ? 1 : 0
  const outside = floodOutside(wall, w, h)
  for (let i = 0; i < wall.length; i++) px.data.set(!outside[i] && !ink[i] ? [255, 255, 255, 255] : [0, 0, 0, 0], i * 4)
  sctx.putImageData(px, 0, 0)

  const out = document.createElement('canvas')
  out.width = bmp.width
  out.height = bmp.height
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, out.width, out.height) // white inside
  ctx.drawImage(bmp, 0, 0) // drawing on top
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
}
