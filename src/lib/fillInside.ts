// The paper is white while drawing, so unpainted spots inside a figure (face, shirt) look white —
// but they'd be see-through on the town ground. This fills "inside the drawing" with white under the lines.
//
// Outlines are rarely closed (and the eraser opens them too), so it works from the picture itself:
//  1. the ink is thinned to 1-cell centre lines; their free tips are the loose line ends
//  2. each tip looks *ahead along its own direction* for another line and, if one is close enough,
//     an invisible bridge closes the gap. "Close enough" grows with the tip's run since its last sharp
//     corner: after a long smooth arc (a circle) a big gap is forgiven, a short piece after a corner
//     (a ㄹ tail) only bridges a tiny one — the same for big and small drawings.
//     Tips pointing at nothing (arms, legs, open letters) stay open.
//  3. whatever the paper's edge can't reach through lines + bridges is inside.
const W = 400 // working width (the mask is smoothed when scaled back up)
const REACH = 0.25 // bridge reach, fraction of the tip's run since the last sharp corner
const MAX_REACH = 0.12 // …but never more than this fraction of the width
const MIN_REACH = 0.035 // …and always at least this (short pieces still close hairline gaps)
const CONE = (40 * Math.PI) / 180 // how far off the line's direction a bridge may go
const CORNER = (70 * Math.PI) / 180 // a turn sharper than this (over ~8 cells each side) is a corner
const SPUR = 6 // thinning leaves little side twigs at line ends; shorter ones are dropped

type P = { x: number; y: number }

// cells reachable from the edge without crossing `wall`
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

// Zhang–Suen thinning: ink → 1-cell-wide centre lines (needs a 1-cell empty border)
function thin(m: Uint8Array, w: number) {
  const p = new Array<number>(8)
  let changed = true
  while (changed) {
    changed = false
    for (const pass of [0, 1]) {
      const kill: number[] = []
      for (let i = w + 1; i < m.length - w - 1; i++) {
        if (!m[i]) continue
        // P2..P9 clockwise from north
        p[0] = m[i - w]; p[1] = m[i - w + 1]; p[2] = m[i + 1]; p[3] = m[i + w + 1]
        p[4] = m[i + w]; p[5] = m[i + w - 1]; p[6] = m[i - 1]; p[7] = m[i - w - 1]
        const b = p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7]
        if (b < 2 || b > 6) continue
        let a = 0
        for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++
        if (a !== 1) continue
        if (pass === 0 ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6] : p[0] * p[2] * p[6] || p[0] * p[4] * p[6]) continue
        kill.push(i)
      }
      for (const i of kill) m[i] = 0
      if (kill.length) changed = true
    }
  }
  return m
}

const around = (w: number) => [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]

// how many separate line pieces meet at a skeleton cell: 1 = a tip, 2 = a line, 3+ = a crossing
function branches(sk: Uint8Array, w: number, i: number) {
  const ring = [i - w, i - w + 1, i + 1, i + w + 1, i + w, i + w - 1, i - 1, i - w - 1]
  let n = 0
  for (let k = 0; k < 8; k++) if (!sk[ring[k]] && sk[ring[(k + 1) % 8]]) n++
  if (!n && ring.some((j) => sk[j])) n = 1 // fully surrounded blob cell
  return n
}

// drop short twigs: tip → junction runs shorter than SPUR
function prune(sk: Uint8Array, w: number) {
  const off = around(w)
  const nb = (i: number) => off.map((o) => i + o).filter((j) => sk[j])
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < sk.length; i++) {
      if (!sk[i] || branches(sk, w, i) !== 1) continue
      const path = [i]
      let prev = -1
      let cur = i
      while (path.length <= SPUR) {
        const next = nb(cur).filter((j) => j !== prev && !path.includes(j))
        if (next.length !== 1) break
        prev = cur
        cur = next[0]
        if (branches(sk, w, cur) > 2) break // reached a junction
        path.push(cur)
      }
      if (path.length <= SPUR && branches(sk, w, cur) > 2) for (const j of path) sk[j] = 0
    }
  }
}

// from a tip, follow the line back the straightest way (through crossings), up to `max` cells
function trace(sk: Uint8Array, w: number, tip: number, max: number) {
  const off = around(w)
  const seen = new Set([tip])
  const path = [tip]
  let cur = tip
  while (path.length < max) {
    const next = off.map((o) => cur + o).filter((j) => sk[j] && !seen.has(j))
    if (!next.length) break
    let pick = next[0]
    if (next.length > 1) {
      const from = path[Math.max(0, path.length - 6)]
      const dx = (cur % w) - (from % w)
      const dy = Math.floor(cur / w) - Math.floor(from / w)
      let bestDot = -Infinity
      for (const j of next) {
        // judge each branch by where it leads a few cells on (crossings are a little knotted)
        let tipJ = j
        const walked = new Set([cur, ...next])
        for (let k = 0; k < 6; k++) {
          const nx = off.map((o) => tipJ + o).find((q) => sk[q] && !walked.has(q) && !seen.has(q))
          if (nx === undefined) break
          walked.add(nx)
          tipJ = nx
        }
        const ex = (tipJ % w) - (cur % w)
        const ey = Math.floor(tipJ / w) - Math.floor(cur / w)
        const dot = (ex * dx + ey * dy) / (Math.hypot(ex, ey) * (Math.hypot(dx, dy) || 1))
        if (dot > bestDot) (bestDot = dot), (pick = j)
      }
    }
    for (const j of next) seen.add(j) // don't wander back into side branches
    path.push(pick)
    cur = pick
  }
  return path
}

// bridges from every free tip to the line it points at
// w: mask row width; paper: the paper's width in cells (sets the reach cap and direction window)
function bridges(sk: Uint8Array, w: number, paper = w) {
  const pts: number[] = []
  for (let i = 0; i < sk.length; i++) if (sk[i]) pts.push(i)
  const xy = (i: number): P => ({ x: i % w, y: Math.floor(i / w) })
  const out: [P, P][] = []
  for (const tip of pts) {
    if (branches(sk, w, tip) !== 1) continue
    const path = trace(sk, w, tip, Math.ceil((MAX_REACH / REACH) * paper)).map(xy)
    // running length along the traced line
    const s = [0]
    for (let i = 1; i < path.length; i++) s.push(s[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y))
    const len = s[s.length - 1]
    if (len < 3) continue
    const end = path[0]
    const ref = path[s.findIndex((v) => v >= Math.min(len / 3, paper * 0.02))]
    const dx = end.x - ref.x
    const dy = end.y - ref.y
    const dl = Math.hypot(dx, dy)
    if (dl < 1) continue
    // run: how far back from the tip the line goes before a sharp corner
    const K = 8
    let run = len
    for (let i = K; i < path.length - K; i++) {
      const a = path[i - K]
      const b = path[i]
      const c = path[i + K]
      const cos = ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y) || 1)
      if (Math.acos(Math.max(-1, Math.min(1, cos))) > CORNER) {
        run = s[i]
        break
      }
    }
    const reach = Math.min(MAX_REACH * paper, Math.max(MIN_REACH * paper, REACH * run))
    // own line: only parts far along it count (not the stretch right behind the tip)
    const along = new Map<number, number>()
    path.forEach((p, i) => along.set(p.y * w + p.x, s[i]))
    // the closest line straight ahead
    const find = (cone: number, far: number) => {
      let best: P | null = null
      let bestScore = Infinity
      for (const j of pts) {
        const q = xy(j)
        const vx = q.x - end.x
        const vy = q.y - end.y
        const d = Math.hypot(vx, vy)
        if (d < 1.5 || d > far) continue
        const sj = along.get(j)
        if (sj !== undefined && sj < 2.5 * d + 6) continue
        const ang = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / (d * dl))))
        if (ang > cone) continue
        const score = d * (1 + ang / cone)
        if (score < bestScore) (bestScore = score), (best = q)
      }
      return best
    }
    const best = find(CONE, reach)
    if (best) out.push([end, best])
  }
  return out
}

// picture → same picture with white inside (as a canvas)
async function fill(src: Blob, trimmed = false) {
  const bmp = await createImageBitmap(src)
  const pad = 4 // stored drawings are trimmed to the ink: give the outside room to flow around
  const w = Math.min(W, bmp.width) + pad * 2
  const k = (w - pad * 2) / bmp.width
  const h = Math.round(bmp.height * k) + pad * 2
  const small = document.createElement('canvas')
  small.width = w
  small.height = h
  const sctx = small.getContext('2d')!
  sctx.drawImage(bmp, pad, pad, w - pad * 2, h - pad * 2)
  let px = sctx.getImageData(0, 0, w, h)
  const ink = new Uint8Array(w * h)
  // lines = drawn pixels that aren't white (white is paper colour / an earlier inside-fill)
  for (let i = 0; i < ink.length; i++) {
    const d = px.data
    ink[i] = d[i * 4 + 3] > 20 && !(d[i * 4] > 235 && d[i * 4 + 1] > 235 && d[i * 4 + 2] > 235) ? 1 : 0
  }
  const sk = thin(ink.slice(), w)
  prune(sk, w)
  // invisible bridges, drawn on their own; walls = real lines + bridges (not white, which may be an old fill)
  sctx.clearRect(0, 0, w, h)
  sctx.strokeStyle = '#000'
  sctx.lineWidth = 2
  sctx.lineCap = 'round'
  // a stored picture is cut to the drawing; the paper was at least as wide as 0.7 × the drawing's height
  const paper = trimmed ? Math.max(w - pad * 2, (h - pad * 2) * 0.7) : w - pad * 2
  for (const [a, b] of bridges(sk, w, paper)) {
    sctx.beginPath()
    sctx.moveTo(a.x, a.y)
    sctx.lineTo(b.x, b.y)
    sctx.stroke()
  }
  px = sctx.getImageData(0, 0, w, h)
  const wall = new Uint8Array(w * h)
  for (let i = 0; i < wall.length; i++) wall[i] = ink[i] || px.data[i * 4 + 3] > 20 ? 1 : 0
  const outside = floodOutside(wall, w, h)
  for (let i = 0; i < wall.length; i++) px.data.set(!outside[i] && !ink[i] ? [255, 255, 255, 255] : [0, 0, 0, 0], i * 4)
  sctx.putImageData(px, 0, 0)

  const out = document.createElement('canvas')
  out.width = bmp.width
  out.height = bmp.height
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, pad, pad, w - pad * 2, h - pad * 2, 0, 0, out.width, out.height) // white inside
  // drawing on top. A stored card may carry stray white from an earlier, looser fill: white that's now outside goes.
  const top = document.createElement('canvas')
  top.width = bmp.width
  top.height = bmp.height
  const tctx = top.getContext('2d')!
  tctx.drawImage(bmp, 0, 0)
  if (trimmed) {
    const img = tctx.getImageData(0, 0, top.width, top.height)
    const d = img.data
    for (let y = 0; y < top.height; y++)
      for (let x = 0; x < top.width; x++) {
        const i = (y * top.width + x) * 4
        if (d[i + 3] && d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235 && outside[(Math.round(y * k) + pad) * w + Math.round(x * k) + pad]) d[i + 3] = 0
      }
    tctx.putImageData(img, 0, 0)
  }
  ctx.drawImage(top, 0, 0)
  return out
}

// a finished drawing (the whole paper)
export async function fillInside(blob: Blob): Promise<Blob> {
  const out = await fill(blob)
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
}

// a stored card picture (data URL) → PNG data URL
export async function fillInsideImage(src: string) {
  return (await fill(await (await fetch(src)).blob(), true)).toDataURL('image/png')
}
