import { useEffect, useRef, useState } from 'react'
import crownIcon from '../assets/proto/crown.svg'
import { Bottom, CardView, CloseIcon, Header, Popup, TextButton, Thumb, shrink, type PopupAction } from '../components/ui'
import { framePoint, toLocal } from '../lib/frame'
import { MAX_RESIDENTS, deleteCard, placeCard, townOf, type Card, type State } from '../lib/store'

// Figma wireframe: 콜렉션 (town strip → selected town's deck → other towns' cards) + card detail overlay.
// Long-press a card to move it: into the deck (moves in) or to another deck slot (reorder). Slot 1 = chief.
const PER_PAGE = 6
const HOLD_MS = 350

type Drag = { id: string; from: 'deck' | 'rest'; x: number; y: number }

export default function CollectionScreen({
  state,
  commit,
  townId,
  onTown,
  onBack,
  onMigrate,
}: {
  state: State
  commit: (fn: (s: State) => State) => void
  townId: string
  onTown: (id: string) => void
  onBack: () => void
  onMigrate: (cardId: string) => void
}) {
  const [newest, setNewest] = useState(true)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const town = state.towns.find((t) => t.id === townId) ?? state.towns[0]
  const deck = town.residents.map((id) => state.cards[id]).filter(Boolean) as Card[]
  const rest = state.towns
    .filter((t) => t.id !== town.id)
    .flatMap((t) => t.residents.map((id) => state.cards[id]).filter(Boolean) as Card[])
    .sort((a, b) => (newest ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))
  const open = openId ? state.cards[openId] : null
  const pages = Math.ceil(MAX_RESIDENTS / PER_PAGE)

  // while dragging a card, stop the browser from scrolling underneath
  useEffect(() => {
    const el = root.current!
    const block = (e: TouchEvent) => dragging.current && e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  // ---- long-press drag ----
  const press = useRef<{ id: string; from: Drag['from']; x: number; y: number; timer: number; fired: boolean } | null>(null)

  function local(e: React.PointerEvent) {
    return toLocal(e.clientX, e.clientY, root.current!)
  }
  function onDown(e: React.PointerEvent, id: string, from: Drag['from']) {
    const p = local(e)
    const target = e.currentTarget
    const pointerId = e.pointerId
    const timer = window.setTimeout(() => {
      if (!press.current) return
      press.current.fired = true
      dragging.current = true
      try {
        target.setPointerCapture(pointerId)
      } catch {
        /* pointer gone */
      }
      navigator.vibrate?.(15)
      setDrag({ id, from, x: p.x, y: p.y })
    }, HOLD_MS)
    press.current = { id, from, ...p, timer, fired: false }
  }
  function onMove(e: React.PointerEvent) {
    const pr = press.current
    if (!pr) return
    const p = local(e)
    if (!pr.fired) {
      if (Math.hypot(p.x - pr.x, p.y - pr.y) > 8) cancelPress()
      return
    }
    setDrag((d) => d && { ...d, x: p.x, y: p.y })
  }
  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
    dragging.current = false
    setDrag(null)
  }
  function onUp(e: React.PointerEvent) {
    const pr = press.current
    if (!pr) return
    clearTimeout(pr.timer)
    if (!pr.fired) {
      press.current = null
      return setOpenId(pr.id) // short tap = detail
    }
    drop(e.clientX, e.clientY, pr.id, pr.from)
    cancelPress()
  }

  function drop(cx: number, cy: number, id: string, from: Drag['from']) {
    const hit = document.elementFromPoint(cx, cy) as HTMLElement | null
    const slot = hit?.closest<HTMLElement>('[data-slot]')
    const inDeck = slot || hit?.closest('[data-deck]')
    if (!inDeck) return // cards can't be taken out of a town by dragging
    const at = slot ? Number(slot.dataset.slot) : deck.length
    if (from === 'rest' && deck.length >= MAX_RESIDENTS) {
      return setPopup({ message: 'This town is full.', actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
    }
    commit((s) => placeCard(s, id, town.id, at))
  }

  function askDelete(card: Card) {
    setPopup({
      message: 'Do you really want to delete?',
      actions: [
        { label: 'Delete', onClick: () => { commit((s) => deleteCard(s, card.id)); setPopup(null); setOpenId(null) } },
        { label: 'Cancel', onClick: () => setPopup(null) },
      ],
    })
  }

  const cardProps = (c: Card, from: Drag['from']) => ({
    onPointerDown: (e: React.PointerEvent) => onDown(e, c.id, from),
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: cancelPress,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  // Figma wireframe 콜렉션 geometry (frame px)
  const SLOT_X = [26, 151, 275]
  const SLOT_Y = [20.5, 137]
  const PITCH = 82

  return (
    <div ref={root} className="relative h-full overflow-hidden bg-white font-hand">
      <Header
        title="Collection"
        onBack={onBack}
        right={
          <TextButton onClick={() => setNewest(!newest)} className="absolute top-[82px] right-[24px] z-20 text-[18px]">
            {newest ? 'Newest' : 'Oldest'}
          </TextButton>
        }
      />

      {/* towns on one grey line, like Town List laid sideways */}
      <div className="absolute inset-x-0 top-[117px] h-[106px] overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        <div className="relative h-full" style={{ width: Math.max(402, 28 + state.towns.length * PITCH + 20) }}>
          <div className="absolute top-0 h-[79px] bg-[#ccc]" style={{ left: 63, width: Math.max(0, (state.towns.length - 1) * PITCH) }} />
          {state.towns.map((t, i) => {
            const on = t.id === town.id
            return (
              <button key={t.id} onClick={() => { onTown(t.id); setPage(0) }} className="absolute top-[4px] w-[70px]" style={{ left: 28 + i * PITCH }}>
                <Thumb image={state.cards[t.residents[0] ?? '']?.image} size={70} strong={on} />
                <span className={`absolute top-[81px] left-1/2 w-[80px] -translate-x-1/2 truncate text-center text-[12px] leading-[normal] ${on ? '' : 'text-[#777]'}`}>{t.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* selected town's deck */}
      <div data-deck className="absolute inset-x-0 top-[228px] h-[260px] bg-[#d9d9d9]">
        <div
          className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
          onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {Array.from({ length: pages }, (_, p) => (
            <div key={p} className="relative h-full w-[402px] shrink-0 snap-start">
              {Array.from({ length: PER_PAGE }, (_, k) => {
                const at = p * PER_PAGE + k
                if (at >= MAX_RESIDENTS) return null
                const c = deck[at]
                return (
                  <div key={k} data-slot={Math.min(at, deck.length)} className="absolute size-[100px]" style={{ left: SLOT_X[k % 3], top: SLOT_Y[Math.floor(k / 3)] }}>
                    {at === 0 && c && <img src={crownIcon} alt="Chief" className="absolute -top-[20.5px] left-[36px] h-[22px] w-[26.4px]" />}
                    {c ? (
                      <button
                        aria-label={`${c.nickname || 'Card'}${at === 0 ? ', chief' : ''}`}
                        {...cardProps(c, 'deck')}
                        className={`size-full touch-pan-x border-[5px] border-black bg-white p-[4px] ${drag?.id === c.id ? 'opacity-30' : ''}`}
                      >
                        <img src={c.image} alt="" draggable={false} className="pointer-events-none size-full object-contain" />
                      </button>
                    ) : (
                      <span className="block size-full border-[3px] border-dashed border-[#a5a5a5]" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {Array.from({ length: pages }, (_, p) => (
          <span key={p} className={`absolute top-[243px] size-[10px] rounded-full ${p === page ? 'bg-[#5f5f5f]' : 'bg-[#b3b3b3]'}`} style={{ left: 188 + p * 15.7 }} />
        ))}
      </div>

      {/* everyone else (only this part scrolls) */}
      <div className="absolute inset-x-0 top-[488px] bottom-0 overflow-y-auto [scrollbar-width:none]">
        {rest.length === 0 ? (
          <p className="pt-[40px] text-center text-[17px] text-[#8e8e8e]">Cards in other towns show up here.</p>
        ) : (
          <div className="grid grid-cols-[repeat(3,100px)] gap-x-[25px] gap-y-[16.6px] pt-[22px] pb-[60px] pl-[23.3px]">
            {rest.map((c) => (
              <button
                key={c.id}
                aria-label={c.nickname || 'Card'}
                {...cardProps(c, 'rest')}
                className={`size-[100px] border-[5px] border-[#b3b3b3] bg-white p-[4px] ${drag?.id === c.id ? 'opacity-30' : ''}`}
              >
                <img src={c.image} alt="" draggable={false} className="pointer-events-none size-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* card following the finger */}
      {drag && (
        <div
          className="pointer-events-none absolute z-40 size-[100px] -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] border-[5px] border-black bg-white p-[4px] shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
          style={{ left: drag.x, top: drag.y }}
        >
          <img src={state.cards[drag.id]?.image} alt="" className="size-full object-contain" />
        </div>
      )}

      {open && (
        <Detail
          card={open}
          townName={townOf(state, open.id)?.name ?? ''}
          onClose={() => setOpenId(null)}
          onMigrate={() => onMigrate(open.id)}
          onDelete={() => askDelete(open)}
        />
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// card overlay: tap the drawing to hide the card text, drag to tilt it around
function Detail({ card, townName, onClose, onMigrate, onDelete }: { card: Card; townName: string; onClose: () => void; onMigrate: () => void; onDelete: () => void }) {
  const [plain, setPlain] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [held, setHeld] = useState(false)

  return (
    <div className="animate-fade-in absolute inset-0 z-30 bg-black/55 text-white">
      <p className="absolute top-[180px] left-[40px] text-[18px] leading-[normal]">{townName}</p>
      <button aria-label="Close" onClick={onClose} className="absolute top-[172px] left-[338px] p-[8px]">
        <CloseIcon size={16} />
      </button>
      <div className="absolute top-[208px] left-[32px] w-[338px] [perspective:700px]" style={shrink(483)}>
        <div
          className="animate-pop-in touch-none"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: held ? 'none' : 'transform 0.5s var(--ease-spring)',
          }}
          onPointerDown={(e) => {
            start.current = { ...framePoint(e.clientX, e.clientY), moved: false }
            setHeld(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const s = start.current
            if (!s) return
            const p = framePoint(e.clientX, e.clientY)
            const dx = p.x - s.x
            const dy = p.y - s.y
            if (Math.hypot(dx, dy) > 6) s.moved = true
            const lim = (v: number) => Math.max(-18, Math.min(18, v))
            setTilt({ x: lim(-dy / 6), y: lim(dx / 6) })
          }}
          onPointerUp={() => {
            const moved = start.current?.moved
            start.current = null
            setHeld(false)
            setTilt({ x: 0, y: 0 })
            if (!moved) setPlain((p) => !p)
          }}
          onPointerCancel={() => {
            start.current = null
            setHeld(false)
            setTilt({ x: 0, y: 0 })
          }}
        >
          <CardView card={card} plain={plain} />
        </div>
      </div>
      <Bottom>
        <TextButton onClick={onMigrate} className="absolute top-[713px] left-[40px] text-[19.5px]" light>Migration</TextButton>
        <TextButton onClick={onDelete} className="absolute top-[713px] right-[40px] text-[19.5px]" light>Delete</TextButton>
      </Bottom>
    </div>
  )
}
