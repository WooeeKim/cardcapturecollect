import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminPage from './AdminPage'
import App from './App'
import { Splash } from './components/Splash'
import { setFrameMatrix } from './lib/frame'
import { preloadAssets } from './lib/preload'

// The app is laid out in Figma frame px (402 wide).
// - PC: the whole 402×874 frame, scaled down to fit the window (never upscale).
// - Phone: fills the screen width; the height follows the screen (--cut = how much shorter than 874).
//   The top TOP px (fake status bar area) are pushed off-screen. Held sideways, the app is rotated
//   back so it always stays portrait.
const TOP = 40

function fit() {
  const root = document.getElementById('root')!
  const html = document.documentElement
  // phones with a stylus can report a "fine" main pointer; a small touch screen is still a phone (full width)
  const phone =
    matchMedia('(pointer: coarse)').matches || (matchMedia('(any-pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 600)
  // layout-viewport width: unlike innerWidth (iOS), it doesn't change if the page ever gets zoomed
  const innerWidth = html.clientWidth || window.innerWidth
  const raw = screen.orientation?.angle ?? Number((window as { orientation?: number }).orientation ?? 0)
  const angle = ((raw % 360) + 360) % 360
  const sideways = phone && (angle === 90 || angle === 270)
  let m = new DOMMatrix()
  let height = 874
  if (!phone) {
    const k = Math.max(0.3, Math.min(1, (innerWidth - 24) / 402, (innerHeight - 24) / 874))
    m = m.translate((innerWidth - 402 * k) / 2, (innerHeight - 874 * k) / 2).scale(k)
  } else {
    const w = sideways ? innerHeight : innerWidth
    const h = sideways ? innerWidth : innerHeight
    const k = w / 402
    height = h / k + TOP
    if (sideways) m = angle === 90 ? m.translate(0, innerHeight).rotate(-90) : m.translate(innerWidth, 0).rotate(90)
    m = m.translate(0, -TOP * k).scale(k)
  }
  html.classList.toggle('phone', phone)
  html.style.setProperty('--cut', String(874 - height))
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
createRoot(document.getElementById('root')!).render(<StrictMode>{admin ? <AdminPage /> : <Boot />}</StrictMode>)
