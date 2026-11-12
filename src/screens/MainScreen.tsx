import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import triDown from '../assets/proto/v2/tri-down.svg'
import triUp from '../assets/proto/v2/tri-up.svg'
import menuBox from '../assets/proto/v2/menu-box2.svg'
import menuTowns from '../assets/proto/menu-towns.svg'
import menuCollection from '../assets/proto/menu-collection.svg'
import personIcon from '../assets/proto/person.svg'
import uncle from '../assets/proto/uncle.png'
import bubble from '../assets/proto/bubble.svg'
import { moodOf } from '../lib/moods'
import { TONES, type Card, type State, type Town } from '../lib/store'
import { Bottom } from '../components/ui'
import cardPanel from '../assets/proto/v2/card-panel.svg'
import chipPanel from '../assets/proto/v2/chip-panel.svg'
import pillFollow from '../assets/proto/v2/pill-follow.svg'
import pillMigration from '../assets/proto/v2/pill-migration.svg'
import { framePoint, toLocal } from '../lib/frame'

// Figma prototyping: main · main-onboarding · main-transit · main-carddeatail
const SKY = 409 / 874 // horizon height ratio
const WORLD = 2.5 // world width = screen width × WORLD
const MAX_S = 3
const DETAIL_S = 2.1
const COMMIT_EDGE = 56 // finger must reach this close to the opposite screen edge to switch town
const BUZZ = [70, 50, 70] // "웅웅" while undecided
const TAP = 8

type View = { s: number; x: number; y: number }
type Walker = { id: string; x: number; y: number; tx: number; ty: number; wait: number; dir: 1 | -1 }

export default function MainScreen({
  state,
  town,
  enter,
  focusId,
  onTowns,
  onCollection,
  onMyPage,
  onDraw,
  onSwitch,
  onMigrate,
}: {
  state: State
  town: Town
  enter: 'left' | 'right' | 'center'
  focusId: string | null
  onTowns: () => void
  onCollection: () => void
  onMyPage: () => void
  onDraw: () => void
  onSwitch: (townId: string, enter: 'left' | 'right') => void
  onMigrate: (cardId: string) => void
}) {
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
  const groundEl = useRef<SVGPolygonElement>(null)
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

  const W = size.w * WORLD
  const H = size.h
  const groundTop = H * SKY

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
    drawGround(y + groundTop * s, extra)
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
    if (hintEl.current) hintEl.current.style.top = `${Math.max(130, y + groundTop * s - 64)}px`
  }
  // ground = one screen-space polygon: a rectangle, or a single trapezoid whose pulled edge tilts away (main-transit).
  // Drawn in screen px (not scaled with the world) so the edge never splits from the ground or blurs when zoomed.
  function drawGround(top: number, pull: number) {
    const el = groundEl.current
    if (!el || !size.w) return
    const w = size.w
    const h = size.h
    const g = Math.abs(pull)
    const tilt = Math.min(h, top + g * 1.7)
    const pts =
      g < 0.5
        ? [[0, h], [0, top], [w, top], [w, h]]
        : pull > 0
          ? [[0, h], [0, tilt], [g, top], [w, top], [w, h]]
          : [[0, h], [0, top], [w - g, top], [w, tilt], [w, h]]
    el.setAttribute('points', pts.map((p) => p.join(',')).join(' '))
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
    const x = ((i + 0.5) / Math.max(1, cards.length)) * (W - 120) + 60
    return { id: cards[i].id, x, y: p.y, tx: p.x, ty: p.y, wait: Math.random() * 2, dir: 1 }
  }
  function randomSpot() {
    return { x: 60 + Math.random() * (W - 120), y: groundTop + 40 + Math.random() * (H - groundTop - 90) }
  }

  // ---- simulation loop: walk, follow camera ----
  useEffect(() => {
    if (!size.w) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      for (const w of walkers.current) {
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

  // farther (near horizon) = smaller
  function depth(y: number) {
    return 0.7 + 0.5 * Math.max(0, Math.min(1, (y - groundTop) / Math.max(1, H - groundTop)))
  }

  // ---- gestures: drag = pan (pull past the edge = next town), pinch = zoom, tap = open ----
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ start: { x: number; y: number }; view: View; moved: boolean; walker?: string; pinch?: { d: number; mid: { x: number; y: number }; view: View } } | null>(null)
  const pullRef = useRef(0)

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
    } else if (pointers.current.size === 2 && gesture.current) {
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
    pointers.current.delete(e.pointerId)
    const g = gesture.current
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
    if (commit && p > 0 && prev) return onSwitch(prev.id, 'right')
    if (commit && p < 0 && next) return onSwitch(next.id, 'left')
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
          <polygon ref={groundEl} fill={tone.ground} />
        </svg>
        <div ref={world} className="absolute top-0 left-0 origin-top-left" style={{ width: W, height: H }}>
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
                {m.word && openId !== c.id && (
                  <span
                    className="pointer-events-none absolute -top-[6px] left-[60%] rounded-full bg-white px-[8px] py-[1px] font-hand text-[15px] whitespace-nowrap"
                    style={{ animation: `bubble-blink 9s ease-in-out ${-(c.serial.charCodeAt(c.serial.length - 1) % 9)}s infinite`, opacity: 0 }}
                  >
                    {m.word}
                  </span>
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
            <p className="text-[18px] leading-[1.2]">{hint.name}</p>
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
          <button aria-label={menu ? 'Close menu' : 'Menu'} aria-expanded={menu} onClick={() => setMenu(!menu)} className="absolute top-[69px] left-[25px] z-30 flex h-[44px] w-[50px] items-center justify-center">
            <img src={menu ? triUp : triDown} alt="" className="h-[20.5px] w-[28.7px] max-w-none" />
          </button>
          {menu && (
            <>
              <div className="absolute inset-0 z-20" onClick={() => setMenu(false)} />
              <div className="animate-pop-in absolute top-[112.2px] left-[19.8px] z-20 h-[130.8px] w-[66px] origin-top">
                <img src={menuBox} alt="" className="absolute inset-0 size-full" />
                <button aria-label="Collection" onClick={() => { setMenu(false); onCollection() }} className="absolute top-[11.8px] left-[13.2px] size-[45px]">
                  <img src={menuCollection} alt="" className="size-full" />
                </button>
                <button aria-label="Town list" onClick={() => { setMenu(false); onTowns() }} className="absolute top-[66.8px] left-[13.2px] size-[45px]">
                  <img src={menuTowns} alt="" className="size-full" />
                </button>
              </div>
            </>
          )}
          <p className="pointer-events-none absolute inset-x-[90px] top-[89px] truncate text-center font-hand text-[24px] leading-[normal]">{town.name}</p>
          {/* same gap from the right edge as the triangle from the left (36.6px), same center line */}
          <button aria-label="My page" onClick={onMyPage} className="absolute top-[62.9px] left-[332.9px] p-[8px]">
            <img src={personIcon} alt="" className="h-[40.1px] w-[25.4px]" />
          </button>
        </>
      )}

      {/* empty town: tutorial (main-onboarding) */}
      {empty && (
        <div className="pointer-events-none absolute inset-0">
          <img src={uncle} alt="" className="absolute bottom-0 left-[-56px] h-[325px] w-[252px] -scale-x-100 object-cover" />
          <img src={bubble} alt="" className="absolute bottom-[281px] left-[97px] h-[140px] w-[248px]" />
          <p className="absolute bottom-[341px] left-[133px] font-hand text-[27px] leading-[1.1] tracking-[-0.54px]">
            Invite your
            <br />
            eye catcher!
          </p>
        </div>
      )}

      {/* draw a new card */}
      {!open && !follow && (
        <button aria-label="Draw a card" onClick={onDraw} className={`absolute right-[-5px] bottom-[-11px] h-[156px] w-[124px] ${empty ? 'animate-hint' : ''}`}>
          {/* the Figma + card, with rounded corners */}
          <span className="absolute top-1/2 left-1/2 flex h-[136px] w-[89px] -translate-x-1/2 -translate-y-1/2 rotate-[163.63deg] items-center justify-center rounded-[9px] border-[2.6px] border-[#222] bg-white">
            <svg viewBox="0 0 28 28" className="size-[28px]" aria-hidden>
              <path d="M14 2v24M2 14h24" stroke="#222" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      )}

      {open && <Detail card={open} onClose={() => setOpenId(null)} onFollow={() => { setFollow(open.id); setOpenId(null) }} onMigrate={() => onMigrate(open.id)} />}
    </div>
  )
}

// card info under the zoomed character (Figma main-carddeatail 787:759: hand-drawn panel + Follow / Migration pills)
function Detail({ card, onClose, onFollow, onMigrate }: { card: Card; onClose: () => void; onFollow: () => void; onMigrate: () => void }) {
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  return (
    <Bottom>
      <div
        className="animate-sheet-up absolute top-[565px] left-[11px] z-10 h-[285px] w-[380px] font-hand"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: start.current === null ? 'transform 0.25s' : 'none' }}
      >
        <img src={cardPanel} alt="" className="pointer-events-none absolute top-[-1px] left-[-1px] h-[256px] w-[382px] max-w-none" />
        {/* top edge: pull down to close */}
        <div
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
            <span className="relative text-[19px] leading-[1.1]">{card.mood}</span>
          </span>
        )}
        {card.place && <p className="absolute top-[33px] right-[20px] text-[17px] leading-[1.1]">{card.place}</p>}
        {card.nickname && <p className="absolute top-[78px] left-[20px] text-[21px] leading-[1.1]">{card.nickname}</p>}
        {card.memo && <p className="absolute top-[116px] left-[20px] line-clamp-4 w-[340px] text-[17px] leading-[1.2] break-words">{card.memo}</p>}
        <p className="absolute top-[207px] right-[20px] text-[14px] leading-[1.1] text-[#8e8e8e]">{card.serial}</p>
        <button onClick={onFollow} className="absolute top-[225px] left-[44px] flex h-[55px] w-[113px] items-center justify-center">
          <img src={pillFollow} alt="" className="absolute inset-0 size-full" />
          <span className="relative text-[24.3px] leading-[1.1]">Follow</span>
        </button>
        <button onClick={onMigrate} className="absolute top-[225px] left-[207px] flex h-[56px] w-[142px] items-center justify-center">
          <img src={pillMigration} alt="" className="absolute inset-0 size-full rotate-[-177.79deg]" />
          <span className="relative text-[24.3px] leading-[1.1]">Migration</span>
        </button>
      </div>
    </Bottom>
  )
}
