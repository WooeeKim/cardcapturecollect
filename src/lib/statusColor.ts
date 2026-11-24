import { isWarm, warmRGB } from './warm'

// Phone status bar = the colour at the top of the screen.
// On a phone (and as a home-screen web app) iOS / Android paint the status bar area from the page, not from the
// app frame: the page background (body) and <meta name="theme-color">. They used to be fixed (#fff / #f9f9f9),
// so the bar stood out above the town's #f0f0f0 sky. Here they follow whatever is showing at the top of the screen:
// the colours under that point are blended top-down (a dimmed overlay darkens it too), after every screen change.

type RGBA = [number, number, number, number]

// any CSS colour (rgb, oklab from Tailwind, …) → RGBA, by painting it on a 1-pixel canvas
let px: CanvasRenderingContext2D | null = null
function parse(c: string): RGBA | null {
  if (!c || c === 'transparent') return null
  px ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  if (!px) return null
  px.clearRect(0, 0, 1, 1)
  px.fillStyle = '#000'
  px.fillStyle = c
  px.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = px.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255]
}

// colour seen at a screen point: element backgrounds under it, top-most first, laid over each other until opaque
function colorAt(x: number, y: number): string | null {
  let out: [number, number, number] = [0, 0, 0]
  let left = 1 // how much of what's below still shows through
  for (const el of document.elementsFromPoint(x, y)) {
    const c = parse(getComputedStyle(el).backgroundColor)
    if (!c || c[3] === 0) continue
    const a = c[3] * Number(getComputedStyle(el).opacity || 1)
    out = [out[0] + c[0] * a * left, out[1] + c[1] * a * left, out[2] + c[2] * a * left]
    left *= 1 - a
    if (left < 0.01) break
  }
  if (left > 0.99) return null
  // whatever is left shows the page behind: assume the frame's own paper colour
  let rgb = out.map((v) => v + 240 * left) as [number, number, number]
  // warm colours (admins): the page is read before the frame's colour filter, so map it the same way
  if (isWarm()) rgb = warmRGB(...rgb)
  const hex = rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

let meta: HTMLMetaElement | null = null
let last = ''

function update() {
  if (!document.documentElement.classList.contains('phone')) return
  const color = colorAt(innerWidth / 2, 2)
  if (!color || color === last) return
  last = color
  meta ??= document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', color)
  document.body.style.background = color
}

export function installStatusColor() {
  const root = document.getElementById('root')
  if (!root) return
  let quick = 0
  let settled = 0
  // right away, and again once fade / slide-in animations have finished
  const schedule = () => {
    cancelAnimationFrame(quick)
    clearTimeout(settled)
    quick = requestAnimationFrame(update)
    settled = window.setTimeout(update, 450)
  }
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true })
  addEventListener('resize', schedule)
  addEventListener('warmchange', schedule)
  schedule()
}
