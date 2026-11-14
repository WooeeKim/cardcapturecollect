import { useEffect, useRef, useState } from 'react'
import { moodOf } from '../lib/moods'
import { TONES } from '../lib/store'
import { who, type Item } from './data'

// 광장 마을뷰: everyone's drawings walking around one big town, like the app's main screen
// (same two-band sky/ground, mood pace, bobbing walk, farther = smaller). Click someone to open their card.
const SKY = 0.42 // horizon height ratio
const CHAR = 110 // character height at the front row (px)

type Walker = { key: string; x: number; y: number; tx: number; ty: number; wait: number; dir: 1 | -1 }
const keyOf = (i: Item) => `${i.owner.user_id}:${i.card.id}`

export function PlazaTown({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLDivElement>())
  const walkers = useRef(new Map<string, Walker>())
  const [size, setSize] = useState({ w: 0, h: 0 })
  const tone = TONES[0]

  useEffect(() => {
    const el = box.current!
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    const o = new ResizeObserver(read)
    o.observe(el)
    return () => o.disconnect()
  }, [])

  const { w: W, h: H } = size
  const top = H * SKY
  const spot = () => ({ x: 50 + Math.random() * Math.max(1, W - 100), y: top + 30 + Math.random() * Math.max(1, H - top - 50) })
  const depth = (y: number) => 0.6 + 0.5 * Math.max(0, Math.min(1, (y - top) / Math.max(1, H - top)))

  // keep walkers in step with the shown items (filter changes): new ones spawn spread out, old ones keep walking
  useEffect(() => {
    if (!W) return
    const next = new Map<string, Walker>()
    items.forEach((it, i) => {
      const k = keyOf(it)
      const old = walkers.current.get(k)
      if (old) return next.set(k, old)
      const p = spot()
      const x = ((i + 0.5) / Math.max(1, items.length)) * (W - 100) + 50
      next.set(k, { key: k, x, y: p.y, tx: p.x, ty: p.y, wait: Math.random() * 2, dir: 1 })
    })
    walkers.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, W, H])

  useEffect(() => {
    if (!W) return
    const pace = new Map(items.map((i) => [keyOf(i), moodOf(i.card.mood).pace]))
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      for (const w of walkers.current.values()) {
        if (w.wait > 0) w.wait -= dt
        else {
          const dx = w.tx - w.x
          const dy = w.ty - w.y
          const d = Math.hypot(dx, dy)
          if (d < 2) {
            w.wait = 1 + Math.random() * 3
            const p = spot()
            w.tx = p.x
            w.ty = p.y
          } else {
            const step = Math.min(d, (600 / (pace.get(w.key) ?? 22)) * dt)
            w.x += (dx / d) * step
            w.y += (dy / d) * step
            if (Math.abs(dx) > 1) w.dir = dx > 0 ? 1 : -1
          }
        }
        const el = els.current.get(w.key)
        if (el) {
          el.style.transform = `translate(${w.x}px, ${w.y}px) scale(${depth(w.y)})`
          el.style.zIndex = String(Math.round(w.y))
          ;(el.firstElementChild as HTMLElement).style.scale = `${w.dir} 1`
          el.classList.toggle('walking', w.wait <= 0)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, W, H])

  return (
    <div ref={box} className="relative h-[min(640px,70vh)] w-full overflow-hidden rounded-xl select-none" style={{ background: tone.sky }}>
      <div className="absolute inset-x-0 bottom-0" style={{ top: `${SKY * 100}%`, background: tone.ground }} />
      {W > 0 &&
        items.map((it) => {
          const k = keyOf(it)
          const m = moodOf(it.card.mood)
          return (
            <div
              key={k}
              ref={(el) => {
                if (el) els.current.set(k, el)
                else els.current.delete(k)
              }}
              className="walker group absolute top-0 left-0 origin-bottom cursor-pointer"
              style={{ width: CHAR * 0.8, height: CHAR, marginLeft: -CHAR * 0.4, marginTop: -CHAR }}
              onClick={() => onOpen(it)}
              title={`${who(it.owner)} · ${it.card.mood || 'no mood'}${it.card.nickname ? ` · ${it.card.nickname}` : ''}`}
            >
              <div className="size-full">
                <img src={it.card.image} alt={it.card.nickname || 'drawing'} draggable={false} className="bob size-full object-contain object-bottom" style={{ animationDuration: `${m.step}s` }} />
              </div>
              <span className="pointer-events-none absolute top-full left-1/2 mt-0.5 max-w-[120px] -translate-x-1/2 truncate rounded-full bg-white/80 px-2 text-[11px] text-neutral-700 opacity-70 group-hover:opacity-100">
                {who(it.owner)}
              </span>
            </div>
          )
        })}
      {items.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-neutral-500">No drawings yet.</p>}
    </div>
  )
}
