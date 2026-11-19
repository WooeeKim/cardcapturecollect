import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import triDown from '../assets/proto/v2/tri-down.svg'
import triUp from '../assets/proto/v2/tri-up.svg'
import menuBox from '../assets/proto/v2/menu-box2.svg'
import menuTowns from '../assets/proto/menu-towns.svg'
import menuCollection from '../assets/proto/menu-collection.svg'
import personIcon from '../assets/proto/person.svg'
import uncle from '../assets/proto/uncle.png'
import bubble from '../assets/proto/bubble.svg'
import bubbleRaw from '../assets/proto/bubble.svg?raw'
import { heldFx, heldLines, moodOf, type HeldFx } from '../lib/moods'
import sweatLeft from '../assets/proto/sweat-left.svg'
import sweatRight from '../assets/proto/sweat-right.svg'
import fxNote1 from '../assets/proto/fx/note-1.svg'
import fxNote2 from '../assets/proto/fx/note-2.svg'
import fxSparkle from '../assets/proto/fx/sparkle.svg'
import fxAnger from '../assets/proto/fx/anger.svg'
import fxBlush from '../assets/proto/fx/blush.svg'
import fxZ from '../assets/proto/fx/z.svg'
import fxStar from '../assets/proto/fx/star.svg'
import fxHeart from '../assets/proto/fx/heart.svg'
import fxShock from '../assets/proto/fx/shock.svg'
import fxCloud from '../assets/proto/fx/cloud.svg'
import { TONES, type Card, type State, type Town } from '../lib/store'
import { Bottom } from '../components/ui'
import cardPanel from '../assets/proto/v2/card-panel.svg'
import chipPanel from '../assets/proto/v2/chip-panel.svg'
import pillFollow from '../assets/proto/v2/pill-follow.svg'
import pillMigration from '../assets/proto/v2/pill-migration.svg'
import { framePoint, toLocal } from '../lib/frame'
import groundSvg from '../assets/proto/ground/ground.svg?raw'
import groundIpadSvg from '../assets/proto/ground/ground-ipad.svg?raw'
import tuftCrown from '../assets/proto/ground/tuft-crown.svg'
import tuftSprout from '../assets/proto/ground/tuft-sprout.svg'
import tuftLeaf from '../assets/proto/ground/tuft-leaf.svg'
import { SQUARE_ID } from '../lib/square'
import { townName, tr } from '../lib/i18n'
import { useWide } from '../lib/wide'

// Figma prototyping: main · main-onboarding · main-transit · main-carddeatail
const SKY = 409 / 874 // horizon height ratio
const WORLD = 2.5 // world width = screen width × WORLD
// iPad sideways: the town is the Figma "grass" drawing (UX › 앱 확정, grass 1065:4015) at its own size and shape,
// 1340 × 573, its top edge at y 300 — only a little wider than the screen, so almost the whole town shows at
// once (camera starts centred, x −73). Not stretched like the phone ground: it runs past the screen bottom.
const SKY_WIDE = 300 / 834
const GRASS_W = 1340.4
const WORLD_WIDE = GRASS_W / 1194
const GRASS_D = groundIpadSvg.match(/ d="([^"]+)"/)![1]
// grass tufts in the iPad drawing (bigger than the phone's), [kind, x, y] = top-left inside the grass group
const TUFT_WIDE = { crown: { w: 69.2, h: 52.2 }, sprout: { w: 52.5, h: 32.3 }, leaf: { w: 74.4, h: 25.1 } }
const TUFTS_WIDE: [keyof typeof TUFT_WIDE, number, number][] = [
  ['crown', 306.4, 298.2], ['crown', 1020.2, 356.2], ['crown', 857.1, 132.8], ['crown', 487.5, 150.9], ['crown', 421.5, 33.7], ['crown', 781.4, 440.8],
  ['sprout', 457.9, 408.1], ['sprout', 830.6, 316.4], ['sprout', 625.8, 60.3], ['sprout', 936.9, 44.6], ['sprout', 175.9, 467.3],
  ['leaf', 546.7, 350.2], ['leaf', 682.0, 236.6], ['leaf', 818.0, 68.7], ['leaf', 366.3, 202.8], ['leaf', 1011.3, 471.0], ['leaf', 1075.3, 228.2],
]
const MAX_S = 3
const DETAIL_S = 2.1
const COMMIT_EDGE = 56 // finger must reach this close to the opposite screen edge to switch town
const BUZZ = [70, 50, 70] // "웅웅" while undecided
const TAP = 8
// ground + grass drawn in Figma (UX › 스케치 확정 › Section 2, 905:994), used as-is; grey version from UX › 02 메인 마을 (990:4781).
// Figma ground box = 1109.76 × 474.39; it stretches over the world's ground area (0..W, groundTop..H).
const GROUND_D = groundSvg.match(/ d="([^"]+)"/)![1]
const GW = 1111.76 // ground.svg viewBox (path box + 1px stroke each side)
const GH = 476.389
const GROUND_TOP_INSET = 0.24 // the drawn top edge starts ~24% in from each side
const TUFT_KIND = {
  crown: { src: tuftCrown, w: 59.33, h: 45.21 },
  sprout: { src: tuftSprout, w: 45.44, h: 28.78 },
  leaf: { src: tuftLeaf, w: 63.95, h: 22.79 },
}
// [kind, x, y] = each tuft's top-left in the Figma section, minus the ground's top-left (477.34, 1163.08)
const TUFTS: [keyof typeof TUFT_KIND, number, number][] = (
  [
    ['crown', 731, 1410], ['crown', 1322, 1458], ['crown', 1187, 1273], ['crown', 881, 1288], ['crown', 826.33, 1191], ['crown', 1124.33, 1528],
    ['sprout', 856.44, 1501], ['sprout', 1165, 1425], ['sprout', 995.44, 1213], ['sprout', 1253, 1200], ['sprout', 623, 1550],
    ['leaf', 930, 1453], ['leaf', 1042, 1359], ['leaf', 1154.63, 1220], ['leaf', 780.63, 1331], ['leaf', 1314.63, 1553], ['leaf', 1367.63, 1352],
  ] as const
).map(([k, x, y]) => [k, x - 477.34, y - 1163.08])

// Sharing Plaza is a city, not a field (UX › 앱 확정, grid beside 02 메인 마을, Vector 547 · 566–577): the same
// ground shape paved with a perspective grid, no grass. Lines in the ground box (1109.76 × 474.39):
// [x top, y top, x bottom, y bottom]; streets run toward the horizon, crossings get closer together far away.
const CITY_LINES: [number, number, number, number][] = [
  [562, 5, 562, 474], [491.8, 8.5, 445.8, 471.5], [686, 8.5, 731, 472.5], [421.4, 7.5, 302.4, 467.5],
  [832.5, 7.5, 953.5, 472.5], [345.6, 2.3, 160.6, 464.3], [975.2, 2.3, 1163.2, 471.3],
  [239, 61, 898, 61], [192.5, 131, 937.5, 131], [134.5, 226, 1003.5, 226], [54, 351.5, 1195, 351.5],
]
const CITY_BOX = { w: 1109.76, h: 474.39 }

// ---- pick up & throw (long-press a resident) ----
const HOLD_MS = 350 // press this long on a character to pick it up
const GRAV = 2400 // world px/s², pulls the dangling body back under the grip
const HEAVY = 1.8 // >1 = slower, heavier swing (acts like a longer body)
const HAND_PULL = 0.7 // how much a hand jerk swings the body (lower = heavier)
const SWING_DAMP = 2.6 // how fast the dangling swing settles
const MAX_SWING = 1.05 // rad (~60°) past hanging straight down; beyond this it's pushed back, never spins over
const KICK = 36 // 바둥바둥 kick strength
const LIFT = 46 // a held character floats this high above its shadow
const THROW_GRAV = 3400 // world px/s², heavier fall than the swing
const THROW_SPEED = 0.6 // share of the hand speed the throw keeps
const MAX_THROW = 1900 // world px/s

// held: hand-drawn bits around the head, one set per mood (moods.ts heldFx). x, y = part centre, box px from the
// top of the head; cls = its animation (index.css), d = animation delay (s)
type FxPart = { src: string; cls: string; x: number; y: number; w: number; d?: number }
const FX: Record<HeldFx, FxPart[]> = {
  sweat: [
    { src: sweatLeft, cls: 'fx-sweat-l', x: -31, y: 30, w: 30 },
    { src: sweatRight, cls: 'fx-sweat-r', x: 30, y: 34, w: 32, d: -0.35 },
  ],
  notes: [
    { src: fxNote1, cls: 'fx-float', x: 28, y: 4, w: 20 },
    { src: fxNote2, cls: 'fx-float', x: -32, y: 10, w: 28, d: -0.8 },
  ],
  sparkle: [
    { src: fxSparkle, cls: 'fx-pop', x: -34, y: 8, w: 24 },
    { src: fxSparkle, cls: 'fx-pop', x: 32, y: 18, w: 18, d: -0.45 },
    { src: fxSparkle, cls: 'fx-pop', x: 8, y: -18, w: 14, d: -0.2 },
  ],
  anger: [{ src: fxAnger, cls: 'fx-pulse', x: 26, y: 18, w: 26 }],
  blush: [
    { src: fxBlush, cls: 'fx-blink', x: -24, y: 58, w: 24 },
    { src: fxBlush, cls: 'fx-blink', x: 24, y: 58, w: 24, d: -0.3 },
  ],
  zzz: [
    { src: fxZ, cls: 'fx-zzz', x: 26, y: 0, w: 12 },
    { src: fxZ, cls: 'fx-zzz', x: 26, y: 0, w: 16, d: -0.6 },
    { src: fxZ, cls: 'fx-zzz', x: 26, y: 0, w: 20, d: -1.2 },
  ],
  dizzy: [
    { src: fxStar, cls: 'fx-orbit', x: 0, y: -6, w: 15 },
    { src: fxStar, cls: 'fx-orbit', x: 0, y: -6, w: 12, d: -0.47 },
    { src: fxStar, cls: 'fx-orbit', x: 0, y: -6, w: 14, d: -0.93 },
  ],
  hearts: [
    { src: fxHeart, cls: 'fx-float', x: 26, y: 6, w: 18 },
    { src: fxHeart, cls: 'fx-float', x: -28, y: 14, w: 14, d: -0.8 },
  ],
  shock: [
    { src: fxShock, cls: 'fx-shake', x: -32, y: 22, w: 14 },
    { src: fxShock, cls: 'fx-shake', x: 32, y: 22, w: 14, d: -0.17 },
  ],
  cloud: [{ src: fxCloud, cls: 'fx-cloud', x: 0, y: -24, w: 52 }],
}

// speech bubble clears the bits above the head (box px above the head top)
const fxLift = (kind: HeldFx) => Math.max(12, 10 - Math.min(...FX[kind].map((p) => p.y - p.w / 2 - (p.cls === 'fx-orbit' ? 8 : 0))))

// residents' speech bubble = the hand-drawn tutorial bubble (bubble.svg), inlined so it stretches to the words while
// its line stays 1.4px. Tail tip ≈ 23% from the left at the bottom; the oval body is the top ~71%.
const BUBBLE_SVG = bubbleRaw
  .replace(/ width="[^"]*" height="[^"]*"/, '')
  .replace(/ style="[^"]*"/, '')
  .replace('<svg ', '<svg class="absolute inset-0 size-full" aria-hidden="true" ')
  .replace(/<path /g, '<path vector-effect="non-scaling-stroke" ')
  .replace(/stroke-width="[^"]*"/g, 'stroke-width="1.4"') // 70% of the tutorial bubble's 2px line
function SpeechBubble({ text, className = '', style }: { text?: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`pointer-events-none absolute -translate-x-[23%] px-[13px] pt-[5px] pb-[15px] font-hand text-[16px] leading-[1.2] whitespace-nowrap ${className}`} style={style}>
      <span dangerouslySetInnerHTML={{ __html: BUBBLE_SVG }} />
      <span className="say-text relative">{text}</span>
    </span>
  )
}

type View = { s: number; x: number; y: number }
// gu/gv: the gripped point in the character's own box (px, feet = 0,0, head = 0,-charH). While held or flying the
// character turns by `a` around that point, which sits at (px, py); sx/sy = the spot on the ground under it.
type Grab = {
  phase: 'held' | 'air' | 'land'
  gu: number
  gv: number
  px: number
  py: number
  fx: number // finger, world px (held)
  fy: number
  vx: number // smoothed grip velocity (held) / flight velocity (air), world px/s
  vy: number
  a: number
  w: number
  sx: number
  sy: number
  z: number
  vz: number
  kick: number // time to the next struggle kick
  say: number // seconds the current speech line still shows (0 = no bubble)
  line: number // seconds until a new line may replace it
}
type Walker = { id: string; x: number; y: number; tx: number; ty: number; wait: number; dir: 1 | -1; g?: Grab }

export default function MainScreen({
  state,
  town,
  enter,
  focusId,
  onTowns,
  onCollection,
  onOpenCard,
  onMyPage,
  onDraw,
  onSwitch,
  onMigrate,
  canMigrate = () => true,
  canOpen = () => true,
}: {
  state: State
  town: Town
  enter: 'left' | 'right' | 'center'
  focusId: string | null
  onTowns: () => void
  onCollection: () => void
  onOpenCard: (cardId: string) => void
  onMyPage: () => void
  onDraw: () => void
  onSwitch: (townId: string) => void // swiped to the next / previous town: it opens at its center
  onMigrate: (cardId: string) => void
  // shared town (lib/square.ts): other people's cards there can't be moved or opened in your Collection
  canMigrate?: (cardId: string) => boolean
  canOpen?: (cardId: string) => boolean
}) {
  const wide = useWide()
  const box = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLDivElement>())
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [openId, setOpenId] = useState<string | null>(null) // card detail
  const [follow, setFollow] = useState<string | null>(focusId)
  const [menu, setMenu] = useState(false)
  // which neighbour town is in reach: 1 = prev (left end / pulled from the left), -1 = next, 0 = none
  const [side, setSide] = useState<1 | -1 | 0>(0)
  const sideRef = useRef<1 | -1 | 0>(0)
  const groundEl = useRef<SVGGElement>(null)
  const city = town.id === SQUARE_ID
  const hintEl = useRef<HTMLDivElement>(null)
  const target = openId ?? follow
  const targetRef = useRef(target)
  targetRef.current = target
  const modeRef = useRef<'detail' | 'follow' | null>(null)
  modeRef.current = openId ? 'detail' : follow ? 'follow' : null

  const idx = state.towns.findIndex((t) => t.id === town.id)
  const prev = state.towns[idx - 1]
  const next = state.towns[idx + 1]
  const tone = TONES[town.tone] ?? TONES[0]
  const cards = useMemo(() => town.residents.map((id) => state.cards[id]).filter(Boolean) as Card[], [town.residents, state.cards])
  const open = openId ? state.cards[openId] : null

  const view = useRef<View>({ s: 1, x: 0, y: 0 })
  const walkers = useRef<Walker[]>([])

  // ---- size ----
  useEffect(() => {
    const el = box.current!
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    const o = new ResizeObserver(read)
    o.observe(el)
    return () => o.disconnect()
  }, [])

  const W = size.w * (wide ? WORLD_WIDE : WORLD)
  const H = size.h
  const groundTop = H * (wide ? SKY_WIDE : SKY)
  // world x where the ground starts at height y (straight-line fit of the drawn, slightly wobbly side edge)
  const edge = (y: number) => GROUND_TOP_INSET * W * (1 - (y - groundTop) / Math.max(1, H - groundTop))

  // grass tufts exactly where drawn in Figma, mapped onto the world's ground area; only their size follows distance
  const tufts = useMemo(() => {
    if (!size.w) return []
    if (wide) {
      // the iPad grass keeps its proportions: one scale for both axes
      const k = W / GRASS_W
      return TUFTS_WIDE.map(([kind, fx, fy]) => {
        const t = TUFT_WIDE[kind]
        return { kind, x: (fx + t.w / 2) * k, y: groundTop + (fy + t.h) * k, w: t.w * k, h: t.h * k }
      })
    }
    const sx = W / (GW - 2)
    const sy = (H - groundTop) / (GH - 2)
    return TUFTS.map(([kind, fx, fy]) => {
      const k = TUFT_KIND[kind]
      return { kind, x: (fx + k.w / 2) * sx, y: groundTop + (fy + k.h) * sy, w: k.w * sx, h: k.h * sx }
    })
  }, [size.w, size.h, wide])

  // ---- camera ----
  function clamp(v: View): View {
    const s = Math.min(MAX_S, Math.max(1, v.s))
    return {
      s,
      x: Math.min(0, Math.max(size.w - W * s, v.x)),
      y: Math.min(0, Math.max(size.h - H * s, v.y)),
    }
  }
  function apply(extra = 0) {
    const { s, x, y } = view.current
    if (world.current) world.current.style.transform = `translate(${x + extra}px, ${y}px) scale(${s})`
    drawGround(extra)
    placeHint()
    const atL = x >= -0.5
    const atR = x <= size.w - W * s + 0.5
    const d: 1 | -1 | 0 = extra > 0 ? 1 : extra < 0 ? -1 : atL ? 1 : atR ? -1 : 0
    if (d !== sideRef.current) {
      sideRef.current = d
      setSide(d)
    }
  }
  // town guide sits just above the ground line on screen, even when zoomed (stays below the header)
  function placeHint() {
    const { s, y } = view.current
    if (hintEl.current) hintEl.current.style.top = `${Math.max(wide ? 90 : 130, y + groundTop * s - 64)}px`
  }
  // ground = the Figma drawing stretched over the world's ground area, positioned in screen px each frame
  // (stroke stays 2px and crisp at any zoom); pulling past an end shows its slanted edge (main-transit).
  function drawGround(pull: number) {
    const el = groundEl.current
    if (!el || !size.w) return
    const { s, x, y } = view.current
    if (wide) el.setAttribute('transform', `translate(${x + pull} ${y + groundTop * s}) scale(${(s * W) / GRASS_W})`)
    else el.setAttribute('transform', `translate(${x + pull} ${y + groundTop * s}) scale(${(s * W) / GW} ${(s * (H - groundTop)) / GH})`)
  }

  // initial camera + walkers when size / residents known
  useEffect(() => {
    if (!size.w) return
    const startX = enter === 'left' ? 0 : enter === 'right' ? size.w - W : (size.w - W) / 2
    view.current = clamp({ s: 1, x: startX, y: 0 })
    apply()
  }, [size.w, size.h])

  useEffect(() => {
    if (!size.w) return
    const old = new Map(walkers.current.map((w) => [w.id, w]))
    walkers.current = cards.map((c, i) => old.get(c.id) ?? spawn(i))
  }, [cards, size.w, size.h])

  function spawn(i: number): Walker {
    const p = randomSpot()
    // spread first positions across the world so nobody stacks up
    const lo = edge(p.y) + 60
    const x = lo + ((i + 0.5) / Math.max(1, cards.length)) * (W - 2 * lo)
    return { id: cards[i].id, x, y: p.y, tx: p.x, ty: p.y, wait: Math.random() * 2, dir: 1 }
  }
  function randomSpot() {
    const y = groundTop + 40 + Math.random() * (H - groundTop - 90)
    const lo = edge(y) + 60
    return { x: lo + Math.random() * (W - 2 * lo), y }
  }

  // ---- simulation loop: walk, follow camera ----
  useEffect(() => {
    if (!size.w) return
    let raf = 0
    let t = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      for (const w of walkers.current) {
        if (w.g) {
          stepGrab(w, w.g, dt, t)
          continue
        }
        const card = state.cards[w.id]
        const speed = 600 / moodOf(card?.mood ?? '').pace
        if (w.wait > 0) w.wait -= dt
        else {
          const dx = w.tx - w.x
          const dy = w.ty - w.y
          const d = Math.hypot(dx, dy)
          if (d < 2) {
            w.wait = 1 + Math.random() * 3
            const p = randomSpot()
            w.tx = p.x
            w.ty = p.y
          } else {
            const step = Math.min(d, speed * dt)
            w.x += (dx / d) * step
            w.y += (dy / d) * step
            if (Math.abs(dx) > 1) w.dir = dx > 0 ? 1 : -1
          }
        }
        const el = els.current.get(w.id)
        if (el) {
          const k = depth(w.y)
          el.style.transform = `translate(${w.x}px, ${w.y}px) scale(${k})`
          el.style.zIndex = String(Math.round(w.y))
          ;(el.firstElementChild as HTMLElement).style.scale = `${w.dir} 1`
          el.classList.toggle('walking', w.wait <= 0)
        }
      }
      // camera eases toward the followed / opened walker
      const id = targetRef.current
      const w = id && walkers.current.find((x) => x.id === id)
      if (w) {
        const v = view.current
        const s = modeRef.current === 'detail' ? DETAIL_S : Math.max(v.s, 1.4)
        const cy = modeRef.current === 'detail' ? size.h * 0.5 : size.h * 0.55
        const goal = clamp({ s, x: size.w / 2 - w.x * s, y: cy - (w.y - 70 * depth(w.y)) * s })
        const k = 0.1
        view.current = clamp({ s: v.s + (goal.s - v.s) * k, x: v.x + (goal.x - v.x) * k, y: v.y + (goal.y - v.y) * k })
        apply()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [size.w, size.h, state.cards])

  // ---- picked-up / thrown character: a pendulum hanging from the gripped point ----
  // lowest point of the hanging body below the grip (head grip → feet hang down, feet grip → head hangs down)
  const hang = (g: Grab, k: number) => Math.max(-g.gv, charH + g.gv) * k
  const groundClamp = (y: number) => Math.min(H - 12, Math.max(groundTop + 12, y))

  function stepGrab(w: Walker, g: Grab, dt: number, t: number) {
    const k = depth(g.sy)
    if (g.phase === 'held') {
      // grip eases onto the finger (no jump when grabbed lower than the head); its velocity, smoothed,
      // and that velocity's change = how hard the hand jerks the grip
      const ease = 1 - Math.exp(-30 * dt)
      const nx = g.px + (g.fx - g.px) * ease
      const ny = g.py + (g.fy - g.py) * ease
      const nvx = (nx - g.px) / dt
      const nvy = (ny - g.py) / dt
      const ovx = g.vx
      const ovy = g.vy
      g.vx += (nvx - g.vx) * 0.35
      g.vy += (nvy - g.vy) * 0.35
      const ax = HAND_PULL * Math.max(-8000, Math.min(8000, (g.vx - ovx) / dt))
      const ay = HAND_PULL * Math.max(-8000, Math.min(8000, (g.vy - ovy) / dt))
      g.px = nx
      g.py = ny
      // pendulum with a moving pivot: the body's middle lags behind the hand and swings back
      const rx = -g.gu * k
      const ry = (-charH * 0.5 - g.gv) * k
      const L = Math.max(40, Math.hypot(rx, ry)) * HEAVY
      const th = Math.atan2(ry, rx) + g.a
      let alpha = (ax * Math.sin(th) + (GRAV - ay) * Math.cos(th)) / L - SWING_DAMP * g.w
      // never swings over the top: past MAX_SWING from hanging straight down, a stiff push back
      const rest = Math.PI / 2 - Math.atan2(ry, rx)
      const off = Math.atan2(Math.sin(g.a - rest), Math.cos(g.a - rest))
      if (Math.abs(off) > MAX_SWING) alpha -= Math.sign(off) * (Math.abs(off) - MAX_SWING) * 120 + g.w * 6
      // 바둥바둥: little random kicks
      g.kick -= dt
      if (g.kick <= 0) {
        g.kick = 0.15 + Math.random() * 0.3
        alpha += (Math.random() - 0.5) * 2 * KICK
      }
      g.w += alpha * dt
      g.a += g.w * dt
      g.sy = groundClamp(g.py + hang(g, k) + LIFT)
      g.sx = g.px
      g.z = g.sy - g.py - hang(g, k)
    } else if (g.phase === 'air') {
      g.sx += g.vx * dt
      g.vz -= THROW_GRAV * dt
      g.z += g.vz * dt
      g.a += g.w * dt
      g.w *= Math.exp(-3 * dt) // keeps the swing it had, no tumbling
      const lo = edge(g.sy) + 30
      const hi = W - edge(g.sy) - 30
      if (g.sx < lo || g.sx > hi) {
        g.sx = Math.min(hi, Math.max(lo, g.sx))
        g.vx *= -0.5
      }
      if (g.z <= 0 && g.vz < 0) {
        g.z = 0
        if (g.vz < -520) {
          // bounce
          g.vz *= -0.35
          g.vx *= 0.6
          g.w = g.w * 0.4 + (Math.random() - 0.5) * 1.2
          vibrate(15)
        } else {
          // land: keep the pose, but turn around the feet from now on, then stand back up
          const c = Math.cos(g.a)
          const s = Math.sin(g.a)
          const ux = -g.gu * k
          const uy = -g.gv * k
          g.px += ux * c - uy * s
          g.py += ux * s + uy * c
          g.gu = 0
          g.gv = 0
          // stand up where the feet came down (a tilted body's feet aren't under the grip): no sideways slide
          g.sx = Math.min(hi, Math.max(lo, g.px))
          g.a = Math.atan2(Math.sin(g.a), Math.cos(g.a))
          g.w = 0
          g.phase = 'land'
          vibrate(20)
        }
      }
      // the body flies with its shadow: grip stays right above the spot on the ground
      if (g.phase === 'air') {
        g.px = g.sx
        g.py = g.sy - hang(g, k) - g.z
      }
    } else {
      // land: feet slide onto the shadow, body springs upright
      const ease = 1 - Math.exp(-14 * dt) // same speed at any frame rate
      g.px += (g.sx - g.px) * ease
      g.py += (g.sy - g.py) * ease
      g.w += (-g.a * 140 - g.w * 13) * dt
      g.a += g.w * dt
      if (Math.abs(g.a) < 0.02 && Math.abs(g.w) < 0.3 && Math.hypot(g.sx - g.px, g.sy - g.py) < 1) {
        w.x = g.sx
        w.y = g.sy
        w.g = undefined
        w.wait = 0.8 + Math.random() * 1.5
        const el = els.current.get(w.id)
        if (el) {
          el.classList.remove('held')
          ;(el.firstElementChild as HTMLElement).style.rotate = ''
        }
        shadows.current.get(w.id)?.style.setProperty('opacity', '0')
        says.current.get(w.id)?.style.setProperty('display', 'none')
        return
      }
    }
    w.x = g.sx
    w.y = g.sy
    const el = els.current.get(w.id)
    if (el) {
      el.style.transform = `translate(${g.px}px, ${g.py}px) rotate(${g.a}rad) scale(${k}) translate(${-g.gu}px, ${-g.gv}px)`
      el.style.zIndex = g.phase === 'held' ? '100000' : String(Math.round(g.sy) + 1)
      // legs / body wiggle while held (the bob runs fast via .held in CSS)
      ;(el.firstElementChild as HTMLElement).style.rotate = g.phase === 'held' ? `${Math.sin(t * 23) * 5}deg` : ''
    }
    const sh = shadows.current.get(w.id)
    if (sh) {
      // under the body's middle, not the grip (they differ when the body hangs tilted)
      const mu = -g.gu * k
      const mv = (-charH * 0.5 - g.gv) * k
      const mx = g.px + mu * Math.cos(g.a) - mv * Math.sin(g.a)
      sh.style.transform = `translate(${mx}px, ${g.sy}px) scale(${k * Math.max(0.45, 1 - g.z / 400)})`
      sh.style.opacity = String(Math.max(0.15, 0.5 - g.z / 600))
      sh.style.zIndex = String(Math.round(g.sy))
    }
    // speech: a mood line pops up while the hand moves it around, changes now and then, fades after it stops
    const say = says.current.get(w.id)
    if (say) {
      g.line -= dt
      const moving = g.phase === 'held' && Math.hypot(g.vx, g.vy) > 260
      if (moving && g.line <= 0) {
        const lines = heldLines(state.cards[w.id]?.mood ?? '')
        const bub = say.firstElementChild as HTMLElement
        const words = bub.querySelector('.say-text')!
        const was = words.textContent
        const pick = lines.filter((l) => tr(l) !== was)
        words.textContent = tr(pick[Math.floor(Math.random() * pick.length)] ?? lines[0])
        bub.classList.remove('animate-pop-in')
        void bub.offsetWidth // restart the pop
        bub.classList.add('animate-pop-in')
        g.line = 1.8 + Math.random() * 1.2
        g.say = 1.6
      } else if (moving) g.say = Math.max(g.say, 0.5)
      else g.say -= dt
      say.style.display = g.say > 0 ? '' : 'none'
      if (g.say > 0) say.style.transform = `translate(${g.px}px, ${g.py - fxLift(heldFx(state.cards[w.id]?.mood ?? '')) * k}px) scale(${k})`
    }
  }

  // long-press grabbed a character at world point (wx, wy)
  // top of the head in the character's box (feet = 0,0): the drawing is trimmed to its lines and sits
  // object-contain at the bottom, so the head is its top edge; x = middle of the topmost drawn pixels
  const heads = useRef(new Map<string, { u: number; v: number }>())
  function headOf(id: string, dir: 1 | -1) {
    let h = heads.current.get(id)
    const img = els.current.get(id)?.querySelector('img')
    if (!h && img?.naturalWidth) {
      const bw = charH * 0.8
      const sc = Math.min(bw / img.naturalWidth, charH / img.naturalHeight)
      const dw = img.naturalWidth * sc
      const dh = img.naturalHeight * sc
      h = { u: 0, v: -dh }
      try {
        const cw = 48
        const ch = Math.max(1, Math.round((cw * img.naturalHeight) / img.naturalWidth))
        const c = document.createElement('canvas')
        c.width = cw
        c.height = ch
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, cw, ch)
        const { data } = ctx.getImageData(0, 0, cw, ch)
        for (let y = 0; y < ch; y++) {
          let sum = 0
          let n = 0
          for (let x = 0; x < cw; x++) if (data[(y * cw + x) * 4 + 3] > 40) (sum += x), n++
          if (n) {
            h = { u: -dw / 2 + ((sum / n + 0.5) / cw) * dw, v: -dh + (y / ch) * dh }
            break
          }
        }
      } catch {
        /* unreadable image: middle of the top edge */
      }
      heads.current.set(id, h)
    }
    h ??= { u: 0, v: -charH }
    return { u: h.u * dir, v: h.v } // the drawing is mirrored when walking left
  }

  function pickUp(id: string, wx: number, wy: number) {
    const w = walkers.current.find((x) => x.id === id)
    if (!w || w.g) return false
    const k = depth(w.y)
    // always held by the top of the head, wherever it was pressed; the head then rises to the finger
    const { u: gu, v: gv } = headOf(id, w.dir)
    const hx = w.x + gu * k
    const hy = w.y + gv * k
    w.g = { phase: 'held', gu, gv, px: hx, py: hy, fx: wx, fy: wy, vx: 0, vy: 0, a: 0, w: 0, sx: w.x, sy: w.y, z: 0, vz: 0, kick: 0.05, say: 0, line: 0 }
    const el = els.current.get(id)
    if (el) {
      // mood bits sit around the top of the head (box px: left edge = -0.4·charH, top = -charH)
      const fx = el.querySelector<HTMLElement>('.fx')
      if (fx) {
        fx.style.left = `${gu + charH * 0.4}px`
        fx.style.top = `${gv + charH}px`
      }
      el.classList.add('held')
    }
    vibrate(30)
    return true
  }
  function throwHeld(id: string) {
    const g = walkers.current.find((x) => x.id === id)?.g
    if (!g || g.phase !== 'held') return
    const cap = (v: number) => Math.max(-MAX_THROW, Math.min(MAX_THROW, v))
    // sideways hand speed carries it along the ground, up/down hand speed tosses it up / slams it down
    g.vx = cap(g.vx * THROW_SPEED)
    g.vz = cap(-g.vy * THROW_SPEED)
    g.vy = 0
    g.phase = 'air'
    els.current.get(id)?.classList.remove('held')
  }

  // farther (near horizon) = smaller
  function depth(y: number) {
    return 0.7 + 0.5 * Math.max(0, Math.min(1, (y - groundTop) / Math.max(1, H - groundTop)))
  }

  // ---- gestures: drag = pan (pull past the edge = next town), pinch = zoom, tap = open ----
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ start: { x: number; y: number }; view: View; moved: boolean; walker?: string; grab?: string; pinch?: { d: number; mid: { x: number; y: number }; view: View } } | null>(null)
  const pullRef = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const shadows = useRef(new Map<string, HTMLDivElement>())
  const says = useRef(new Map<string, HTMLDivElement>())
  function cancelHold() {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }
  useEffect(() => cancelHold, [])
  function toWorld(p: { x: number; y: number }) {
    const v = view.current
    return { x: (p.x - v.x) / v.s, y: (p.y - v.y) / v.s }
  }

  function local(e: React.PointerEvent) {
    return toLocal(e.clientX, e.clientY, box.current!)
  }
  function pinchOf() {
    const [a, b] = [...pointers.current.values()]
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }
  function setPullBoth(v: number) {
    pullRef.current = v
  }

  // ---- haptics: buzz while undecided (pulled past the end, finger not yet at the far edge) ----
  const zoneRef = useRef<'hesitate' | 'commit' | null>(null)
  const buzz = useRef<number | null>(null)
  function vibrate(p: number | number[]) {
    try {
      navigator.vibrate?.(p)
    } catch {
      /* unsupported (iOS Safari) */
    }
  }
  function setZone(z: 'hesitate' | 'commit' | null) {
    if (z === zoneRef.current) return
    const was = zoneRef.current
    zoneRef.current = z
    if (z === 'hesitate') {
      vibrate(BUZZ)
      buzz.current ??= window.setInterval(() => vibrate(BUZZ), 380)
      return
    }
    if (buzz.current !== null) {
      clearInterval(buzz.current)
      buzz.current = null
    }
    vibrate(z === 'commit' && was === 'hesitate' ? 25 : 0) // one short tick: "release now switches"
  }
  useEffect(() => () => setZone(null), [])

  function onDown(e: React.PointerEvent) {
    if (gesture.current?.grab) return // holding someone: other fingers are ignored
    pointers.current.set(e.pointerId, local(e))
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone */
    }
    if (pointers.current.size === 1) {
      // remember who was touched now: with pointer capture, pointerup's target is the box, not the character
      const walker = (e.target as HTMLElement).closest<HTMLElement>('[data-walker]')?.dataset.walker
      gesture.current = { start: local(e), view: { ...view.current }, moved: false, walker }
      // press and hold on a character = pick it up
      cancelHold()
      if (walker) {
        const pid = e.pointerId
        holdTimer.current = window.setTimeout(() => {
          holdTimer.current = null
          const g = gesture.current
          const p = pointers.current.get(pid)
          if (!g || g.moved || pointers.current.size !== 1 || !p) return
          const at = toWorld(p)
          if (!pickUp(walker, at.x, at.y)) return
          g.grab = walker
          setOpenId(null)
          setFollow(null)
        }, HOLD_MS)
      }
    } else if (pointers.current.size === 2 && gesture.current) {
      cancelHold()
      gesture.current.moved = true
      gesture.current.pinch = { ...pinchOf(), view: { ...view.current } }
      setPullBoth(0)
      setZone(null)
      apply()
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (g.grab) {
      // carrying: the grip follows the finger (the loop turns hand speed into swing)
      const hw = walkers.current.find((x) => x.id === g.grab)?.g
      if (hw) {
        const at = toWorld(p)
        hw.fx = at.x
        hw.fy = at.y
      }
      return
    }
    if (g.pinch && pointers.current.size === 2) {
      const { d, mid } = pinchOf()
      const b = g.pinch.view
      const s = Math.min(MAX_S, Math.max(1, (b.s * d) / g.pinch.d))
      const cx = (g.pinch.mid.x - b.x) / b.s
      const cy = (g.pinch.mid.y - b.y) / b.s
      view.current = clamp({ s, x: mid.x - cx * s, y: mid.y - cy * s })
      apply()
      return
    }
    if (pointers.current.size !== 1) return
    const dx = p.x - g.start.x
    const dy = p.y - g.start.y
    if (!g.moved && Math.hypot(dx, dy) > TAP) {
      g.moved = true
      cancelHold()
      // dragging the map lets go of the followed character / closes the card
      setFollow(null)
      setOpenId(null)
    }
    if (!g.moved) return
    const raw = { s: g.view.s, x: g.view.x + dx, y: g.view.y + dy }
    const c = clamp(raw)
    view.current = c
    const over = raw.x - c.x // >0 past left edge, <0 past right edge
    const rubber = over * 0.45
    apply(rubber)
    setPullBoth(rubber)
    // switching needs the finger dragged all the way to the opposite edge
    const to = rubber > 4 ? prev : rubber < -4 ? next : undefined
    const commit = rubber > 0 ? p.x >= size.w - COMMIT_EDGE : p.x <= COMMIT_EDGE
    setZone(to ? (commit ? 'commit' : 'hesitate') : null)
  }

  function onUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    cancelHold()
    const g = gesture.current
    if (g?.grab) {
      throwHeld(g.grab)
      gesture.current = null
      return
    }
    if (pointers.current.size > 0) {
      if (g) g.pinch = undefined
      if (g && pointers.current.size === 1) {
        const [rest] = [...pointers.current.values()]
        g.start = rest
        g.view = { ...view.current }
      }
      return
    }
    gesture.current = null
    const p = pullRef.current
    const commit = zoneRef.current === 'commit'
    setZone(null)
    if (commit && p > 0 && prev) return onSwitch(prev.id)
    if (commit && p < 0 && next) return onSwitch(next.id)
    if (p !== 0) {
      setPullBoth(0)
      apply()
    }
    if (g && !g.moved) {
      const hit = g.walker
      if (hit) {
        setOpenId(hit)
        setFollow(null)
      } else {
        setOpenId(null)
        setFollow(null)
      }
    }
  }

  // desktop: wheel pans, ctrl/pinch-trackpad zooms
  useEffect(() => {
    const el = box.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const at = toLocal(e.clientX, e.clientY, el)
      const v = view.current
      if (e.ctrlKey) {
        const s = Math.min(MAX_S, Math.max(1, v.s * Math.exp(-e.deltaY * 0.01)))
        view.current = clamp({ s, x: at.x - ((at.x - v.x) / v.s) * s, y: at.y - ((at.y - v.y) / v.s) * s })
      } else {
        view.current = clamp({ ...v, x: v.x - (e.deltaX || e.deltaY), y: v.y })
      }
      apply()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [size.w, size.h])

  // shown as soon as the camera reaches that end of the town, before any pull
  const hint = open || follow ? undefined : side > 0 ? prev : side < 0 ? next : undefined
  const empty = cards.length === 0
  const charH = 170

  return (
    <div className="relative h-full overflow-hidden" style={{ background: tone.sky }}>
      {/* map */}
      <div
        ref={box}
        className="absolute inset-0 touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <g ref={groundEl}>
            <path d={wide ? GRASS_D : GROUND_D} fill="#C9C9C9" stroke="#000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {city && (
              <>
                <clipPath id="city-ground">
                  <path d={wide ? GRASS_D : GROUND_D} />
                </clipPath>
                {/* iPad ground is a bigger drawing: the same grid stretched over its box */}
                <g clipPath="url(#city-ground)">
                  <g transform={wide ? `scale(${GRASS_W / CITY_BOX.w} ${573 / CITY_BOX.h})` : undefined}>
                    {CITY_LINES.map(([x1, y1, x2, y2], i) => (
                      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    ))}
                  </g>
                </g>
              </>
            )}
          </g>
        </svg>
        <div ref={world} className="absolute isolate top-0 left-0 origin-top-left" style={{ width: W, height: H }}>
          {!city && tufts.map((t, i) => (
            <img
              key={i}
              src={TUFT_KIND[t.kind].src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-0 left-0 max-w-none origin-bottom"
              style={{ width: t.w, height: t.h, marginLeft: -t.w / 2, marginTop: -t.h, transform: `translate(${t.x}px, ${t.y}px) scale(${depth(t.y)})`, zIndex: Math.round(t.y) }}
            />
          ))}
          {/* shadows, only shown while someone is lifted off the ground */}
          {cards.map((c) => (
            <div
              key={`sh-${c.id}`}
              ref={(el) => {
                if (el) shadows.current.set(c.id, el)
                else shadows.current.delete(c.id)
              }}
              className="pointer-events-none absolute top-0 left-0 h-[18px] w-[90px] -mt-[9px] -ml-[45px] rounded-[50%] bg-black"
              style={{ opacity: 0 }}
            />
          ))}
          {/* what a carried character says, above its head and kept upright (lines per mood: moods.ts) */}
          {cards.map((c) => (
            <div
              key={`say-${c.id}`}
              ref={(el) => {
                if (el) says.current.set(c.id, el)
                else says.current.delete(c.id)
              }}
              className="pointer-events-none absolute top-0 left-0 z-[100001] origin-bottom"
              style={{ display: 'none' }}
            >
              <SpeechBubble className="bottom-0 left-0" />
            </div>
          ))}
          {cards.map((c) => {
            const m = moodOf(c.mood)
            return (
              <div
                key={c.id}
                ref={(el) => {
                  if (el) els.current.set(c.id, el)
                  else els.current.delete(c.id)
                }}
                data-walker={c.id}
                className="walker absolute top-0 left-0 origin-bottom"
                style={{ width: charH * 0.8, height: charH, marginLeft: -charH * 0.4, marginTop: -charH } as CSSProperties}
              >
                <div className="size-full">
                  <img src={c.image} alt={c.nickname || 'resident'} draggable={false} className="bob size-full object-contain object-bottom" style={{ animationDuration: `${m.step}s` }} />
                </div>
                {/* held: mood bits around the head (sweat = Figma UX 858:804, the rest hand-drawn to match); placed in pickUp */}
                <div className="fx pointer-events-none absolute size-0">
                  {FX[heldFx(c.mood)].map((p, i) => (
                    <img key={i} src={p.src} alt="" draggable={false} className={`fx-part ${p.cls}`} style={{ left: p.x, top: p.y, width: p.w, animationDelay: `${p.d ?? 0}s` }} />
                  ))}
                </div>
                {m.word && openId !== c.id && (
                  <SpeechBubble
                    text={tr(m.word)}
                    className="walk-word bottom-[calc(100%-14px)] left-[56%]"
                    style={{ animation: `bubble-blink 9s ease-in-out ${-(c.serial.charCodeAt(c.serial.length - 1) % 9)}s infinite`, opacity: 0 }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {hint && (
          <div
            ref={(el) => {
              hintEl.current = el
              placeHint()
            }}
            className={`animate-pop-in pointer-events-none absolute font-hand ${side > 0 ? 'left-[18px] text-left' : 'right-[18px] text-right'}`}
          >
            <p className="text-[18px] leading-[1.2]">{townName(hint.name)}</p>
            <p className="text-[24px] leading-none tracking-[-2px]">
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ animation: `chevron-wave 1s ease-in-out ${(side > 0 ? i : 2 - i) * 0.15}s infinite` }}>
                  {side > 0 ? '<' : '>'}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>

      {/* header */}
      {!follow && (
        <>
          {/* Figma main 803:951 (closed: ▽) / 803:922 (open: △ with the icon box under it).
              The triangle stays in one spot (center 50, 91) so it flips in place. */}
          <button aria-label={tr(menu ? 'Close menu' : 'Menu')} aria-expanded={menu} onClick={() => setMenu(!menu)} className={`absolute z-30 flex h-[44px] w-[50px] items-center justify-center ${wide ? 'top-[33px] left-[40px]' : 'top-[69px] left-[25px]'}`}>
            <img src={menu ? triUp : triDown} alt="" className="h-[20.5px] w-[28.7px] max-w-none" />
          </button>
          {menu && (
            <>
              <div className="absolute inset-0 z-20" onClick={() => setMenu(false)} />
              <div className={`animate-pop-in absolute z-20 h-[130.8px] w-[66px] origin-top ${wide ? 'top-[76.2px] left-[34.8px]' : 'top-[112.2px] left-[19.8px]'}`}>
                <img src={menuBox} alt="" className="absolute inset-0 size-full" />
                <button aria-label={tr('Collection')} onClick={() => { setMenu(false); onCollection() }} className="absolute top-[11.8px] left-[13.2px] size-[45px]">
                  <img src={menuCollection} alt="" className="size-full" />
                </button>
                <button aria-label={tr('Town List')} onClick={() => { setMenu(false); onTowns() }} className="absolute top-[66.8px] left-[13.2px] size-[45px]">
                  <img src={menuTowns} alt="" className="size-full" />
                </button>
              </div>
            </>
          )}
          {/* town name → Town List (only the name itself is tappable; the rest of the bar still pans the town) */}
          <div className={`pointer-events-none absolute flex justify-center ${wide ? 'inset-x-[200px] top-[30px]' : 'inset-x-[90px] top-[69px]'}`}>
            <button onClick={() => { setMenu(false); onTowns() }} className="pointer-events-auto max-w-full truncate px-[6px] py-[8px] font-hand text-[24px] leading-[28px]">
              {townName(town.name)}
            </button>
          </div>
          {/* same gap from the right edge as the triangle from the left (36.6px), same center line */}
          <button aria-label={tr('My page')} onClick={onMyPage} className={`absolute p-[8px] ${wide ? 'top-[27px] left-[1108px]' : 'top-[62.9px] left-[332.9px]'}`}>
            <img src={personIcon} alt="" className="h-[40.1px] w-[25.4px]" />
          </button>
        </>
      )}

      {/* empty town: tutorial (main-onboarding) */}
      {empty && (
        <div className="pointer-events-none absolute inset-0">
          <img src={uncle} alt="" className="absolute bottom-0 left-[-56px] h-[325px] w-[252px] -scale-x-100 object-cover" />
          <img src={bubble} alt="" className="absolute bottom-[281px] left-[97px] h-[140px] w-[248px]" />
          {/* centered over the bubble's oval body (the tail sits below it) */}
          <div className="absolute bottom-[316px] left-[97px] flex h-[105px] w-[248px] items-center justify-center">
            <p className="text-center font-hand text-[27px] leading-[1.1] tracking-[-0.54px] whitespace-pre-line">{tr('Invite your\neye catcher!')}</p>
          </div>
        </div>
      )}

      {/* draw a new card */}
      {!open && !follow && (
        <button aria-label={tr('Draw someone')} onClick={onDraw} className={`absolute right-[-5px] bottom-[-11px] h-[156px] w-[124px] ${empty ? 'animate-hint' : ''}`}>
          {/* the Figma + card, with rounded corners */}
          <span className="absolute top-1/2 left-1/2 flex h-[136px] w-[89px] -translate-x-1/2 -translate-y-1/2 rotate-[163.63deg] items-center justify-center rounded-[9px] border-[2.6px] border-[#222] bg-white">
            <svg viewBox="0 0 28 28" className="size-[28px]" aria-hidden>
              <path d="M14 2v24M2 14h24" stroke="#222" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      )}

      {open && <Detail wide={wide} card={open} onClose={() => setOpenId(null)} onFollow={() => { setFollow(open.id); setOpenId(null) }} onMigrate={canMigrate(open.id) ? () => onMigrate(open.id) : undefined} onOpen={canOpen(open.id) ? () => onOpenCard(open.id) : undefined} />}
    </div>
  )
}

// card info under the zoomed character (Figma main-carddeatail 787:759: hand-drawn panel + Follow / Migration pills)
// iPad sideways: the same panel, centred at the bottom
function Detail({ wide, card, onClose, onFollow, onMigrate, onOpen }: { wide: boolean; card: Card; onClose: () => void; onFollow: () => void; onMigrate?: () => void; onOpen?: () => void }) {
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  return (
    <Bottom>
      <div
        className={`animate-sheet-up absolute top-[565px] z-10 h-[285px] w-[380px] cursor-pointer font-hand ${wide ? 'left-[407px]' : 'left-[11px]'}`}
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: start.current === null ? 'transform 0.25s' : 'none' }}
        // tapping the card area (not a button, not the pull strip) opens this card in Collection
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button, [data-pull]')) onOpen?.()
        }}
      >
        <img src={cardPanel} alt="" className="pointer-events-none absolute top-[-1px] left-[-1px] h-[256px] w-[382px] max-w-none" />
        {/* top edge: pull down to close */}
        <div
          data-pull
          className="absolute inset-x-0 top-0 h-[24px] touch-none"
          onPointerDown={(e) => {
            start.current = framePoint(e.clientX, e.clientY).y
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => start.current !== null && setDrag(Math.max(0, framePoint(e.clientX, e.clientY).y - start.current))}
          onPointerUp={() => {
            start.current = null
            if (drag > 70) onClose()
            else setDrag(0)
          }}
        />
        {card.mood && (
          <span className="absolute top-[25px] left-[20px] flex h-[35px] w-[70.4px] items-center justify-center">
            <img src={chipPanel} alt="" className="absolute inset-[-2.85%_-1.42%] size-[calc(100%+2.84%)] max-w-none" />
            <span className="relative text-[19px] leading-[1.1]">{tr(card.mood)}</span>
          </span>
        )}
        {card.place && <p className="absolute top-[33px] right-[20px] text-[17px] leading-[1.1]">{card.place}</p>}
        {card.nickname && <p className="absolute top-[78px] left-[20px] text-[21px] leading-[1.1]">{card.nickname}</p>}
        {card.memo && <p className="absolute top-[116px] left-[20px] line-clamp-4 w-[340px] text-[17px] leading-[1.2] break-words">{card.memo}</p>}
        <p className="absolute top-[207px] right-[20px] text-[14px] leading-[1.1] text-[#8e8e8e]">{card.serial}</p>
        <button onClick={onFollow} className="absolute top-[225px] left-[44px] flex h-[55px] w-[113px] items-center justify-center">
          <img src={pillFollow} alt="" className="absolute inset-0 size-full" />
          <span className="relative text-[24.3px] leading-[1.1]">{tr('Follow')}</span>
        </button>
        {onMigrate && (
          <button onClick={onMigrate} className="absolute top-[225px] left-[207px] flex h-[56px] w-[142px] items-center justify-center">
            <img src={pillMigration} alt="" className="absolute inset-0 size-full rotate-[-177.79deg]" />
            <span className="relative text-[24.3px] leading-[1.1]">{tr('Migration')}</span>
          </button>
        )}
      </div>
    </Bottom>
  )
}
