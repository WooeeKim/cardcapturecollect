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
  const phone = matchMedia('(pointer: coarse)').matches
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
// <site>/#/admin = team card gallery (normal page, no phone frame)
const admin = location.hash === '#/admin'
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
  const unscroll = () => {
    if (scrollX || scrollY) scrollTo(0, 0)
  }
  addEventListener('scroll', unscroll)
  addEventListener('focusout', () => setTimeout(unscroll, 50))
  visualViewport?.addEventListener('resize', unscroll)
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
