// The paper is white while drawing, so unpainted spots inside a figure (face, shirt) look white —
// but they'd be see-through on the town ground. This fills "inside the drawing" with white under the lines.
// Outlines are rarely closed, so plain flood fill won't do: the lines are first thickened so small gaps close,
// the outside is flood-filled from the paper's edge, then grown back by the same amount.
// Whatever the outside doesn't reach (and isn't ink) is inside. Gaps up to ~2·GAP of the width get bridged.
const W = 240 // working width (the mask is smoothed when scaled back up)
const GAP = 0.015 // closing radius, fraction of the paper width

// distance from every cell to the nearest set cell of `m`: two-pass chamfer (near-round), linear time
function dist(m: Uint8Array, w: number, h: number) {
  const D = 1.4142
  const d = new Float32Array(m.length)
  for (let i = 0; i < m.length; i++) d[i] = m[i] ? 0 : 1e9
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + 1)
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1)
        if (x > 0) v = Math.min(v, d[i - w - 1] + D)
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D)
      }
      d[i] = v
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let v = d[i]
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1)
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1)
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D)
        if (x > 0) v = Math.min(v, d[i + w - 1] + D)
      }
      d[i] = v
    }
  return d
}

// grows `m` by radius r
function grow(m: Uint8Array, w: number, h: number, r: number) {
  const d = dist(m, w, h)
  const out = new Uint8Array(m.length)
  for (let i = 0; i < m.length; i++) out[i] = d[i] <= r ? 1 : 0
  return out
}

// 1 = inside the figure (pure: unit-checkable)
export function insideMask(ink: Uint8Array, w: number, h: number, r: number) {
  const wall = grow(ink, w, h, r)
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
  const back = grow(outside, w, h, r)
  // candidate white = not outside, not ink
  const cand = new Uint8Array(w * h)
  for (let i = 0; i < cand.length; i++) cand[i] = !back[i] && !ink[i] ? 1 : 0
  // drop thin pieces (sealed tips of armpits, between legs…): keep a piece only if somewhere it's wider than 3r
  const notCand = new Uint8Array(w * h)
  for (let i = 0; i < cand.length; i++) notCand[i] = cand[i] ? 0 : 1
  const depth = dist(notCand, w, h)
  const seen = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  for (let start = 0; start < cand.length; start++) {
    if (!cand[start] || seen[start]) continue
    const piece = [start]
    seen[start] = 1
    let fat = false
    for (let k = 0; k < piece.length; k++) {
      const i = piece[k]
      if (depth[i] > 1.5 * r) fat = true
      const x = i % w
      const visit = (j: number) => {
        if (cand[j] && !seen[j]) {
          seen[j] = 1
          piece.push(j)
        }
      }
      if (x > 0) visit(i - 1)
      if (x < w - 1) visit(i + 1)
      if (i >= w) visit(i - w)
      if (i < cand.length - w) visit(i + w)
    }
    if (fat) for (const i of piece) out[i] = 1
  }
  // tuck the white a little under the lines so no see-through hairline shows at the edge
  const tuck = grow(out, w, h, 1.5)
  for (let i = 0; i < out.length; i++) if (tuck[i] && ink[i]) out[i] = 1
  return out
}

export async function fillInside(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const w = W
  const h = Math.round((bmp.height / bmp.width) * W)
  const small = document.createElement('canvas')
  small.width = w
  small.height = h
  const sctx = small.getContext('2d')!
  sctx.drawImage(bmp, 0, 0, w, h)
  const px = sctx.getImageData(0, 0, w, h)
  const ink = new Uint8Array(w * h)
  for (let i = 0; i < ink.length; i++) ink[i] = px.data[i * 4 + 3] > 20 ? 1 : 0
  const inside = insideMask(ink, w, h, Math.max(1, Math.round(GAP * w)))
  for (let i = 0; i < inside.length; i++) {
    px.data.set(inside[i] ? [255, 255, 255, 255] : [0, 0, 0, 0], i * 4)
  }
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
