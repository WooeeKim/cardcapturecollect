import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminPage from './AdminPage'
import App from './App'
import { Splash } from './components/Splash'
import { setFrameMatrix } from './lib/frame'
import { WIDE_H, WIDE_W, setWide } from './lib/wide'
import { preloadAssets } from './lib/preload'
import { installTouchGlow } from './lib/touchGlow'
import { installSound } from './lib/sound'

// The app is laid out in Figma frame px (402 wide).
// - PC: the whole 402×874 frame, scaled down to fit the window (never upscale).
// - Tablet (iPad, unfolded Fold): like PC, but scaled up to fill the screen.
//   Held sideways it switches to the 1194×834 landscape frame (lib/wide.ts, Figma 09 iPad 가로 (안)).
// - Phone: fills the screen width; the height follows the screen (--cut = how much shorter than 874).
//   The top TOP px (fake status bar area) are pushed off-screen. Held sideways, the app is rotated
//   back so it always stays portrait.
const TOP = 40
const FORCE_WIDE = new URLSearchParams(location.search).has('ipad')
// client px the whole frame is moved up so the focused text field sits above the on-screen keyboard
let kbLift = 0

function fit() {
  const root = document.getElementById('root')!
  const html = document.documentElement
  // phones with a stylus can report a "fine" main pointer; a small touch screen is still a phone (full width)
  const small = Math.min(screen.width, screen.height) <= 600
  const touch = matchMedia('(pointer: coarse)').matches || (matchMedia('(any-pointer: coarse)').matches && small)
  // iPad / unfolded Fold: filling the width there leaves a frame far shorter than 874 (bottom buttons ride up
  // onto the content), so tablets show the whole frame scaled to fit, like PC but allowed to grow.
  const tablet = touch && !small
  const phone = touch && !tablet
  // layout-viewport width: unlike innerWidth (iOS), it doesn't change if the page ever gets zoomed
  const innerWidth = html.clientWidth || window.innerWidth
  const raw = screen.orientation?.angle ?? Number((window as { orientation?: number }).orientation ?? 0)
  const angle = ((raw % 360) + 360) % 360
  const sideways = phone && (angle === 90 || angle === 270)
  let m = new DOMMatrix()
  let height = 874
  // iPad sideways (or ?ipad on a wide window): the 1194×834 landscape frame, scaled to fill the screen
  const wide = (tablet || FORCE_WIDE) && innerWidth > innerHeight
  setWide(wide)
  if (wide) {
    height = WIDE_H
    const pad = tablet ? 0 : 24
    const k = Math.max(0.3, Math.min(tablet ? Infinity : 1, (innerWidth - pad) / WIDE_W, (innerHeight - pad) / WIDE_H))
    m = m.translate((innerWidth - WIDE_W * k) / 2, (innerHeight - WIDE_H * k) / 2).scale(k)
    if (kbLift) m = new DOMMatrix().translate(0, kbLift).multiply(m)
  } else if (!phone) {
    // + the 13px bezel drawn outside the screen on each side (index.css #root outline)
    const k = Math.max(0.3, Math.min(tablet ? Infinity : 1, (innerWidth - 24 - 26) / 402, (innerHeight - 24 - 26) / 874))
    m = m.translate((innerWidth - 402 * k) / 2, (innerHeight - 874 * k) / 2).scale(k)
    if (tablet && kbLift) m = new DOMMatrix().translate(0, kbLift).multiply(m)
  } else {
    const w = sideways ? innerHeight : innerWidth
    const h = sideways ? innerWidth : innerHeight
    const k = w / 402
    height = h / k + TOP
    if (sideways) m = angle === 90 ? m.translate(0, innerHeight).rotate(-90) : m.translate(innerWidth, 0).rotate(90)
    m = m.translate(0, -TOP * k).scale(k)
    if (!sideways && kbLift) m = new DOMMatrix().translate(0, kbLift).multiply(m)
  }
  html.classList.toggle('phone', phone)
  html.classList.toggle('tablet', tablet)
  html.classList.toggle('wide', wide)
  html.style.setProperty('--cut', String(874 - height))
  root.style.width = wide ? `${WIDE_W}px` : ''
  root.style.height = `${height}px`
  root.style.transform = m.toString()
  setFrameMatrix(m)
}
// <site>/admin (or the older <site>/#/admin) = team card gallery (normal page, no phone frame)
const admin = /^\/admin\/?$/.test(location.pathname) || location.hash === '#/admin'
if (admin) document.documentElement.classList.add('admin')
else {
  fit()
  addEventListener('resize', fit)
  screen.orientation?.addEventListener('change', fit)
  addEventListener('orientationchange', () => setTimeout(fit, 100))
  pinPage()
}

// The frame is position: fixed, so the page itself must never zoom or stay scrolled: on phones that leaves
// touches landing away from what's drawn (lines appear off the finger). iOS ignores user-scalable=no, so
// its pinch (gesture*) is cancelled here, and the scroll it leaves after the keyboard closes is undone.
function pinPage() {
  const stop = (e: Event) => e.preventDefault()
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false })
  const vv = window.visualViewport
  const typing = () => document.activeElement?.matches('input, textarea, [contenteditable]') ?? false
  // Home-screen (standalone) iOS can keep the visual viewport shifted after the keyboard closes even with
  // scrollY = 0, so the offset is checked there too (not while typing: then the shift is the keyboard's).
  const unscroll = () => {
    const shifted = !!vv && !typing() && vv.scale < 1.01 && (vv.offsetTop !== 0 || vv.offsetLeft !== 0)
    if (scrollX || scrollY || shifted) scrollTo(0, 0)
  }
  addEventListener('scroll', unscroll)
  addEventListener('focusout', () => setTimeout(unscroll, 50))
  vv?.addEventListener('resize', unscroll)
  vv?.addEventListener('scroll', unscroll)

  // Standalone launch / coming back from the background can report the viewport size late, without a window
  // resize: re-fit then too (and once shortly after start), so the frame always matches the real screen.
  const refit = () => {
    fit()
    unscroll()
  }
  vv?.addEventListener('resize', refit)
  addEventListener('pageshow', refit)
  addEventListener('focusout', () => setTimeout(refit, 300))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && setTimeout(refit, 50))
  setTimeout(refit, 500)

  // The keyboard covers the bottom of the frame and the page can't scroll (see above), so the frame itself
  // moves up until the focused field is above the keyboard (through the frame matrix, so touches stay right).
  // A box marked data-own-keyboard (Draw › Memo) moves itself instead.
  const lift = () => {
    const el = document.activeElement
    let next = 0
    if (vv && typing() && el && !el.closest('[data-own-keyboard]') && /phone|tablet/.test(document.documentElement.className)) {
      const r = el.getBoundingClientRect()
      const visTop = vv.offsetTop + 8
      const visBottom = vv.offsetTop + vv.height - 12
      // field position without the current lift; a field taller than the space keeps its top visible
      next = Math.min(0, Math.max(visTop - (r.top - kbLift), visBottom - (r.bottom - kbLift)))
    }
    if (next !== kbLift) {
      kbLift = next
      fit()
    }
  }
  const liftLater = () => setTimeout(lift, 0)
  document.addEventListener('focusin', liftLater)
  document.addEventListener('focusout', liftLater)
  vv?.addEventListener('resize', liftLater)
  vv?.addEventListener('scroll', liftLater)
}

// The app name (Splash) shows right away while the handwriting font and every icon load, so the wait never
// looks blank. The app itself mounts once they're ready (screens never pop in piece by piece) and the splash
// blurs away after the app has also loaded the account.
function Boot() {
  const [loaded, setLoaded] = useState(false)
  const [appReady, setAppReady] = useState(false)
  useEffect(() => {
    preloadAssets().then(() => setLoaded(true))
  }, [])
  return (
    <>
      {loaded && <App onReady={() => setAppReady(true)} />}
      <Splash ready={loaded && appReady} />
    </>
  )
}
if (!admin) {
  installTouchGlow()
  installSound()
}
createRoot(document.getElementById('root')!).render(<StrictMode>{admin ? <AdminPage /> : <Boot />}</StrictMode>)
