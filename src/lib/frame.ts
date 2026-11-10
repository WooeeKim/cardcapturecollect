// The app frame is CSS-scaled (main.tsx), so screen px ≠ layout px.
// Convert a pointer position to layout px relative to `el`.
export function toLocal(clientX: number, clientY: number, el: Element) {
  const r = el.getBoundingClientRect()
  const k = frameScale()
  return { x: (clientX - r.left) / k, y: (clientY - r.top) / k }
}

export function frameScale() {
  const root = document.getElementById('root')!
  return root.getBoundingClientRect().width / root.offsetWidth || 1
}
