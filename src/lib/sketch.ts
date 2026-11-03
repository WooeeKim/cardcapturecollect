// 손으로 그은 듯한 선 경로 (Figma 나은 섹션 컴포넌트와 같은 방식).
// 시드를 고정해 매번 같은 모양이 나온다.

type Pt = [number, number]

function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// 점들을 부드러운 곡선(Catmull-Rom → 베지어)으로 잇는다
function smooth(pts: Pt[]) {
  const f = (n: number) => n.toFixed(1)
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const [p1, p2] = [pts[i], pts[i + 1]]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

function roundedRectPoints(w: number, h: number, r: number, step: number) {
  const pts: Pt[] = []
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step))
    for (let i = 0; i < n; i++) pts.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n])
  }
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i < 4; i++) {
      const a = a0 + ((Math.PI / 2) * i) / 4
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  }
  edge(r, 0, w - r, 0)
  arc(w - r, r, -Math.PI / 2)
  edge(w, r, w, h - r)
  arc(w - r, h - r, 0)
  edge(w - r, h, r, h)
  arc(r, h - r, Math.PI / 2)
  edge(0, h - r, 0, r)
  arc(r, r, Math.PI)
  return pts
}

// 흔들리는 둥근 사각형. 시작점이 랜덤이고 끝이 살짝 겹쳐 손으로 한 바퀴 그은 느낌.
export function wobblyRect(w: number, h: number, r: number, seed: number, jitter = 0.7) {
  const R = rng(seed)
  let pts = roundedRectPoints(w, h, Math.min(r, w / 2, h / 2), 10).map(
    ([x, y]): Pt => [x + (R() - 0.5) * 2 * jitter, y + (R() - 0.5) * 2 * jitter],
  )
  const k = Math.floor(R() * pts.length)
  pts = pts.slice(k).concat(pts.slice(0, k))
  pts.push(pts[0].map((v) => v + (R() - 0.5) * 2) as Pt, pts[1].map((v) => v + (R() - 0.5) * 2) as Pt)
  return smooth(pts)
}

// 흔들리는 원 (팔레트 색 방울, 동그라미 표시)
export function wobblyCircle(cx: number, cy: number, r: number, seed: number, jitter = 0.07) {
  const R = rng(seed)
  const n = 16
  const pts: Pt[] = []
  for (let i = 0; i <= n + 1; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + (R() - 0.5) * 2 * jitter
    pts.push([cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)])
  }
  return smooth(pts)
}

// 흔들리는 가로선
export function wobblyLine(len: number, seed: number, amp = 1.4) {
  const R = rng(seed)
  const pts: Pt[] = []
  for (let x = 0; x <= len; x += 12) pts.push([x, (R() - 0.5) * amp])
  return smooth(pts)
}

// 꼭짓점은 살리고 변만 흔들기 (연필·지우개 같은 도구 그림)
export function wobblyPoly(points: Pt[], seed: number, closed = true, jitter = 0.45) {
  const R = rng(seed)
  const ps = closed ? [...points, points[0]] : points
  const parts: string[] = []
  for (let i = 0; i < ps.length - 1; i++) {
    const [[x1, y1], [x2, y2]] = [ps[i], ps[i + 1]]
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 10))
    const seg: Pt[] = []
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const j = k === 0 || k === n ? 0 : jitter
      seg.push([x1 + (x2 - x1) * t + (R() - 0.5) * 2 * j, y1 + (y2 - y1) * t + (R() - 0.5) * 2 * j])
    }
    parts.push(smooth(seg))
  }
  return parts.join(' ')
}
