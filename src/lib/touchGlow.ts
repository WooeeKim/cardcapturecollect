// "Where am I pressing": a soft glow under every finger (or the pressed mouse button) that follows it and
// ripples out on release. Lives on <body>, outside the scaled #root, so plain viewport coordinates fit.
// Touch events (not pointer events) for fingers: pointer events get cancelled as soon as a list scrolls,
// touch events keep coming until the finger lifts.
const opts = { capture: true, passive: true }

export function installTouchGlow() {
  const dots = new Map<string, HTMLDivElement>()
  const down = (id: string, x: number, y: number) => {
    dots.get(id)?.remove()
    const el = document.createElement('div')
    el.className = 'touch-glow'
    el.style.translate = `${x}px ${y}px`
    document.body.append(el)
    dots.set(id, el)
  }
  const move = (id: string, x: number, y: number) => {
    const el = dots.get(id)
    if (el) el.style.translate = `${x}px ${y}px`
  }
  const up = (id: string) => {
    const el = dots.get(id)
    if (!el) return
    dots.delete(id)
    el.classList.add('touch-glow-out')
    el.addEventListener('animationend', () => el.remove(), { once: true })
  }

  // this listener is also what makes iOS Safari apply :active (the button press look in index.css)
  const lift = (e: TouchEvent) => { for (const t of e.changedTouches) up(`t${t.identifier}`) }
  addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      down(`t${t.identifier}`, t.clientX, t.clientY)
      // touchend goes to the touched element even if it left the page meanwhile (e.g. swiping to the next
      // town remounts the screen on pointerup), and then never reaches window: listen on the element too
      t.target.addEventListener('touchend', lift as EventListener, opts)
      t.target.addEventListener('touchcancel', lift as EventListener, opts)
    }
  }, opts)
  addEventListener('touchmove', (e) => { for (const t of e.changedTouches) move(`t${t.identifier}`, t.clientX, t.clientY) }, opts)
  addEventListener('touchend', lift, opts)
  addEventListener('touchcancel', lift, opts)

  // PC: mouse only (touch / pen already come through the touch events above)
  addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && e.button === 0 && down('m', e.clientX, e.clientY), opts)
  addEventListener('pointermove', (e) => e.pointerType === 'mouse' && move('m', e.clientX, e.clientY), opts)
  addEventListener('pointerup', (e) => e.pointerType === 'mouse' && up('m'), opts)
  addEventListener('pointercancel', (e) => e.pointerType === 'mouse' && up('m'), opts)
}
