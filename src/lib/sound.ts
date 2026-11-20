// Sound effects, Web Audio only: recorded clips (assets/sounds, cut from the team's recordings: table taps, pen /
// marker / eraser on paper, a bubble pop, a page turn, the card move-in swish, the card-finished chime, the throw
// swoosh) with small synthesized layers. Developer accounts only for now: a switch on My Page, off by default
// (soundForAccount); regular accounts hear nothing.
// iPhone (Safari 17+): audio session "ambient" = mixes with the user's music instead of stopping it, and obeys
// the silent switch. Browsers only allow sound after a tap, so the first pointerdown unlocks it (installSound).

import tap2 from '../assets/sounds/tap-2.wav'
import tap4 from '../assets/sounds/tap-4.wav'
import popClip from '../assets/sounds/pop.wav'
import eraserLoop from '../assets/sounds/eraser-loop.wav'
import penLoop from '../assets/sounds/pen-loop.wav'
import markerLoop from '../assets/sounds/marker-loop.wav'
import pageClip from '../assets/sounds/page.wav'
import moveInClip from '../assets/sounds/move-in.wav'
import cardDoneClip from '../assets/sounds/card-done.wav'
import arriveClip from '../assets/sounds/arrive.wav'
import flyClip from '../assets/sounds/fly.wav'

const CLIPS = { tap2, tap4, pop: popClip, pen: penLoop, marker: markerLoop, eraser: eraserLoop, page: pageClip, moveIn: moveInClip, cardDone: cardDoneClip, arrive: arriveClip, fly: flyClip }
type Clip = keyof typeof CLIPS
const buffers: Partial<Record<Clip, AudioBuffer>> = {}
let loading = false
function loadClips(c: AudioContext) {
  if (loading) return
  loading = true
  for (const [name, url] of Object.entries(CLIPS) as [Clip, string][]) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => c.decodeAudioData(b))
      .then((buf) => (buffers[name] = buf), () => {})
  }
}

const SFX_KEY = 'subwayseal.sfx'
const read = (k: string, dflt: boolean) => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? dflt : v === 'on'
  } catch {
    return dflt
  }
}
const write = (k: string, on: boolean) => {
  try {
    localStorage.setItem(k, on ? 'on' : 'off')
  } catch {
    /* private mode: works until reload */
  }
}

// not shown to users yet: regular accounts never hear it. Developer (admin) accounts get a switch on My Page,
// off until they turn it on.
let sfxOn = false
export const soundEnabled = () => sfxOn
export function soundForAccount(admin: boolean) {
  sfxOn = admin && read(SFX_KEY, false)
}

let ctx: AudioContext | null = null
let sfxBus: GainNode
function ac() {
  if (!ctx) {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } }
      if (nav.audioSession) nav.audioSession.type = 'ambient'
    } catch {
      /* older Safari */
    }
    ctx = new AudioContext()
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.6
    sfxBus.connect(ctx.destination)
  }
  return ctx
}
// a ready context, or null when effects are off / audio isn't unlocked yet
function live() {
  if (!sfxOn || !ctx || ctx.state !== 'running') return null
  return ctx
}

// ---------- building blocks ----------
function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, gain = 0.3, to = freq as number, at = 0 } = {}) {
  const c = live()
  if (!c) return
  const t = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(sfxBus)
  o.start(t)
  o.stop(t + dur + 0.02)
}
const vary = (x: number, amt = 0.08) => x * (1 + (Math.random() * 2 - 1) * amt) // never quite the same twice

// one recorded clip; rate = playback speed (pitch goes with it). Returns false if not loaded yet.
function clip(name: Clip, { rate = 1, gain = 0.6 } = {}) {
  const c = live()
  const buf = buffers[name]
  if (!c || !buf) return false
  const s = c.createBufferSource()
  s.buffer = buf
  s.playbackRate.value = rate
  const g = c.createGain()
  g.gain.value = gain
  s.connect(g).connect(sfxBus)
  s.start()
  return true
}

// ---------- the sounds ----------
export const sfx = {
  // 휙: a resident thrown (the card-flying swoosh); louder and higher the harder the throw (speed in world px/s)
  fly(speed: number) {
    if (speed < 350) return
    const k = Math.min(1, speed / 1900)
    clip('fly', { rate: vary(0.85 + 0.4 * k, 0.04), gain: 0.3 + 0.6 * k })
  },
  // 통: bounced off the ground — a tap slowed down
  bounce() {
    clip('tap2', { rate: vary(0.75, 0.05), gain: 0.55 })
    tone(vary(260), 0.12, { to: 150, gain: 0.15 })
  },
  // 툭: landed — a slower, heavier tap with a low thud under it
  land() {
    clip('tap2', { rate: vary(0.55, 0.05), gain: 0.7 })
    tone(vary(130), 0.14, { to: 60, gain: 0.3 })
  },
  // 사락: page turn (switching town)
  page() {
    clip('page', { rate: vary(1, 0.06), gain: 0.7 })
  },
  // 휙휙: a card flies into its town (move in / migrate)
  moveIn() {
    clip('moveIn', { gain: 0.9 })
  },
  // 띠링: a drawing just became a card
  cardDone() {
    clip('cardDone', { gain: 0.7 })
  },
  // 띠링: first look at a card in the town it just moved into (sent there or migrated; the camera follows it)
  arrive() {
    clip('arrive', { gain: 0.7 })
  },
  // 톡: any button
  tap() {
    clip('tap4', { rate: vary(1.1, 0.06), gain: 0.35 })
  },
  // 뽁: a tap on a spot that does nothing (shown by the touch glow, lib/touchGlow.ts)
  pop() {
    clip('pop', { rate: vary(1, 0.05), gain: 0.5 })
  },
}

// ---------- drawing: pen / marker on paper, looped while a stroke is drawn, as loud as the hand is fast ----------
let draw: { src: AudioBufferSourceNode; g: GainNode } | null = null
export function drawStart(tool: 'pen' | 'highlighter' | 'eraser') {
  drawEnd()
  const c = live()
  const buf = buffers[tool === 'pen' ? 'pen' : tool === 'eraser' ? 'eraser' : 'marker']
  if (!c || !buf) return
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.playbackRate.value = vary(1, 0.04)
  const g = c.createGain()
  g.gain.value = 0
  src.connect(g).connect(sfxBus)
  src.start(0, Math.random() * buf.duration) // a different bit of the recording each stroke
  draw = { src, g }
}
// speed = finger speed on the paper, screen px/s
export function drawMove(speed: number) {
  if (!draw || !ctx) return
  const level = Math.min(1, speed / 900) * 0.9
  draw.g.gain.setTargetAtTime(level, ctx.currentTime, 0.04)
}
export function drawEnd() {
  if (!draw || !ctx) return
  const { src, g } = draw
  draw = null
  g.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
  src.stop(ctx.currentTime + 0.2)
}

export function setSound(on: boolean) {
  sfxOn = on
  write(SFX_KEY, on)
  if (on) sfx.tap()
}
// call once at start: unlocks audio on the first tap, tap sound on buttons, silent in the background
export function installSound() {
  const unlock = () => {
    const c = ac()
    loadClips(c)
    if (c.state !== 'running') c.resume().catch(() => {})
  }
  addEventListener('pointerdown', unlock, { capture: true, passive: true })
  // a tap on something that does nothing: a soft pop. Only a tap: pressing and dragging (panning the town,
  // scrolling a list) stays quiet, so it plays on release if the finger hardly moved.
  // [data-quiet] = an area that should make no sound at all (the color spectrum and opacity slider)
  const ACTIVE = 'button, a, input, textarea, select, label, [role="button"], [contenteditable="true"], canvas, [data-walker], [data-pull], [data-quiet]'
  const presses = new Map<number, { x: number; y: number; t: number }>()
  const opts = { capture: true, passive: true }
  addEventListener('pointerdown', (e) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest?.(ACTIVE)) presses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp })
  }, opts)
  addEventListener('pointermove', (e) => {
    const p = presses.get(e.pointerId)
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) presses.delete(e.pointerId)
  }, opts)
  addEventListener('pointerup', (e) => {
    const p = presses.get(e.pointerId)
    presses.delete(e.pointerId)
    if (p && e.timeStamp - p.t < 600 && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 10) sfx.pop()
  }, opts)
  addEventListener('pointercancel', (e) => presses.delete(e.pointerId), opts)
  addEventListener(
    'click',
    (e) => {
      const el = e.target as HTMLElement
      if (el.closest?.('button') && !el.closest('[data-quiet]')) sfx.tap()
    },
    { capture: true, passive: true },
  )
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend().catch(() => {})
    else ctx.resume().catch(() => {})
  })
}
