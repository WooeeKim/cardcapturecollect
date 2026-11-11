// The app frame (#root) is CSS-transformed by main.tsx: scaled to the window, and on phones held
// sideways rotated so the app stays portrait. Pointer client coords must go through the inverse.

let inverse = new DOMMatrix()
export function setFrameMatrix(m: DOMMatrix) {
  inverse = m.inverse()
}

// client px → #root layout px
export function framePoint(clientX: number, clientY: number) {
  const p = inverse.transformPoint(new DOMPoint(clientX, clientY))
  return { x: p.x, y: p.y }
}

// client px → layout px of `el` (el may be scaled inside the frame, but not rotated)
export function toLocal(clientX: number, clientY: number, el: HTMLElement | Element) {
  const r = el.getBoundingClientRect()
  const a = framePoint(r.left, r.top)
  const b = framePoint(r.right, r.bottom)
  const p = framePoint(clientX, clientY)
  const w = (el as HTMLElement).offsetWidth
  const s = (w && Math.abs(b.x - a.x) / w) || 1
  return { x: (p.x - Math.min(a.x, b.x)) / s, y: (p.y - Math.min(a.y, b.y)) / s }
}
