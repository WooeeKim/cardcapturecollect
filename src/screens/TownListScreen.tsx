import { useEffect, useRef, useState } from 'react'
import { CardView, GoTag, fromBottom, HandleIcon, Header, PlusButton, Popup, Thumb, type PopupAction } from '../components/ui'
import { framePoint } from '../lib/frame'
import tlBox from '../assets/proto/v2/tl-box.svg'
import tlBar from '../assets/proto/v2/tl-bar.svg'
import tlClose from '../assets/proto/v2/tl-close.svg'
import tlPill from '../assets/proto/v2/tl-edit.svg'
import { MAX_RESIDENTS, MAX_TOWNS, addTown, canDeleteTown, deleteTown, dotDate, moveTown, newTown, updateTown, type Card, type State, type Town } from '../lib/store'

// Figma prototyping: townList · townList-detail · townList for migration · 마을 추가
// browse  = Go / Edit
// migrate = move an existing card ("Migration")
// send    = place a newly drawn card ("Send")
export type ListMode = 'browse' | 'migrate' | 'send'

const ROW = 130
const OPEN_EXTRA = 114 // open row is 244 tall (Figma townList-detail 787:1012)

export default function TownListScreen({
  state,
  commit,
  mode,
  card,
  homeId,
  onBack,
  onGo,
  onPlace,
}: {
  state: State
  commit: (fn: (s: State) => State) => void
  mode: ListMode
  card?: Card // floating card in migrate / send
  homeId?: string // where the card lives now (migrate)
  onBack: () => void
  onGo: (townId: string) => void
  onPlace: (townId: string) => void // after the card flew into the town
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', bio: '' })
  const [adding, setAdding] = useState<Town | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const [flying, setFlying] = useState<{ x: number; y: number } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const thumbs = useRef(new Map<string, HTMLElement>())
  const cardEl = useRef<HTMLDivElement>(null)
  const listEl = useRef<HTMLDivElement>(null)

  const openIndex = state.towns.findIndex((t) => t.id === openId)
  const chiefImage = (t: Town) => state.cards[t.residents[0] ?? '']?.image
  const gotIt = (message: string) => setPopup({ message, actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
  const open = state.towns.find((t) => t.id === openId)
  const dirty = !!open && editing && (draft.name !== open.name || draft.bio !== open.bio)

  useEffect(() => {
    if (adding) listEl.current?.scrollTo({ top: listEl.current.scrollHeight, behavior: 'smooth' })
  }, [adding])

  function toggle(t: Town) {
    if (adding) return
    if (openId === t.id) return close()
    if (dirty) return askSave(() => openRow(t))
    openRow(t)
  }
  function openRow(t: Town) {
    setOpenId(t.id)
    setEditing(false)
  }
  function close() {
    if (dirty) return askSave(() => setOpenId(null))
    setOpenId(null)
    setEditing(false)
  }
  function save() {
    if (!open) return
    commit((s) => updateTown(s, open.id, { name: draft.name.trim() || open.name, bio: draft.bio.trim() }))
    setEditing(false)
  }
  function askSave(then: () => void) {
    setPopup({
      message: "There's unsaved changes.\nDo you wanna save?",
      actions: [
        { label: 'Discard', onClick: () => { setPopup(null); setEditing(false); then() } },
        { label: 'Save', onClick: () => { setPopup(null); save(); then() } },
      ],
    })
  }
  function askDelete(t: Town) {
    const why = canDeleteTown(state, t.id)
    if (why === 'residents') return gotIt('You cannot delete town with resident.')
    if (why === 'last') return gotIt('You need at least one town.')
    setPopup({
      message: 'Do you really want to delete?',
      actions: [
        { label: 'Delete', onClick: () => { commit((s) => deleteTown(s, t.id)); setPopup(null); setOpenId(null); setEditing(false) } },
        { label: 'Cancel', onClick: () => setPopup(null) },
      ],
    })
  }
  function startAdd() {
    if (state.towns.length >= MAX_TOWNS) return gotIt(`You can have up to ${MAX_TOWNS} towns.`)
    if (dirty) return askSave(startAdd)
    setOpenId(null)
    setEditing(false)
    const t = newTown(state, '', '')
    setAdding(t)
    setDraft({ name: '', bio: '' })
  }
  function create() {
    if (!adding) return
    const t = { ...adding, name: draft.name.trim() || `New Town ${state.towns.length + 1}`, bio: draft.bio.trim() }
    commit((s) => addTown(s, t))
    setAdding(null)
    setOpenId(t.id)
  }

  function place(t: Town) {
    if (mode === 'migrate' && t.id === homeId) return gotIt('This card already lives here.')
    if (t.residents.length >= MAX_RESIDENTS) return gotIt('This town is full.')
    const from = cardEl.current?.getBoundingClientRect()
    const to = thumbs.current.get(t.id)?.querySelector('[data-thumb]')?.getBoundingClientRect()
    if (!from || !to) return onPlace(t.id)
    const a = framePoint(from.left + from.width / 2, from.top + from.height / 2)
    const b = framePoint(to.left + to.width / 2, to.top + to.height / 2)
    setFlying({ x: b.x - a.x, y: b.y - a.y })
    setTimeout(() => onPlace(t.id), 650)
  }

  // ---- reorder with the "=" handle ----
  const dragStart = useRef(0)
  function onHandleDown(e: React.PointerEvent, i: number) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setOpenId(null)
    setEditing(false)
    dragStart.current = framePoint(e.clientX, e.clientY).y
    setDragIdx(i)
    setDragDy(0)
  }
  function onHandleMove(e: React.PointerEvent) {
    if (dragIdx === null) return
    let dy = framePoint(e.clientX, e.clientY).y - dragStart.current
    const steps = Math.trunc(dy / ROW + Math.sign(dy) * 0.5)
    const to = Math.max(0, Math.min(state.towns.length - 1, dragIdx + steps))
    if (to !== dragIdx) {
      commit((s) => moveTown(s, dragIdx, to))
      dragStart.current += (to - dragIdx) * ROW
      dy -= (to - dragIdx) * ROW
      setDragIdx(to)
    }
    setDragDy(dy)
  }
  function onHandleUp() {
    setDragIdx(null)
    setDragDy(0)
  }

  const action = mode === 'migrate' ? 'Migration' : mode === 'send' ? 'Send' : null

  // Figma townList geometry (frame px). The list scrolls under a white header (0–149).
  const rowTop = (i: number) => 44 + i * ROW + (openIndex >= 0 && i > openIndex ? OPEN_EXTRA : 0)
  const listHeight = rowTop(state.towns.length) + (adding ? ROW + OPEN_EXTRA : 0) + 120

  // hand-drawn pill button (Figma Vector 406); grey label for the "leave it" side
  const pill = (label: string, onClick: () => void, left: number, grey = false) => (
    <button onClick={onClick} className="absolute top-[147px] flex h-[41px] items-center justify-center" style={{ left, width: label.length > 4 ? 84 : 69 }}>
      <img src={tlPill} alt="" className="absolute inset-[-2.5%_-1.5%] size-[calc(100%+3%)] max-w-none" />
      <span className={`relative text-[20px] leading-[1.3] ${grey ? 'text-[#686868]' : ''}`}>{label}</span>
    </button>
  )

  // open town (Figma townList-detail 787:1012): hand-drawn box, Go tag, Edit pill
  const detail = (t: Town | null) => {
    const isNew = !t
    const editable = isNew || editing
    return (
      <>
        {/* townList-detail variant 2: the box grows out of the grey line. It starts well inside the line and sits
            behind it (-z), so the line's wavy edge covers the box's left end with no gap. */}
        <img src={tlBox} alt="" className="pointer-events-none absolute top-[-6px] left-[64px] -z-10 h-[183px] w-[329px] max-w-none" />
        {editable ? (
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={20}
            placeholder={isNew ? `New Town ${state.towns.length + 1}` : ''}
            aria-label="Town name"
            className="absolute top-[20px] left-[135px] w-[205px] bg-transparent text-[21px] leading-[1.3] outline-none placeholder:text-[#5f5f5f]"
          />
        ) : (
          <p className="absolute top-[22px] left-[135px] w-[205px] truncate text-[21px] leading-[1.3]">{t!.name}</p>
        )}
        <button aria-label="Close" onClick={isNew ? () => setAdding(null) : close} className="absolute top-[14px] left-[344px] flex size-[28px] items-center justify-center">
          <img src={tlClose} alt="" className="h-[14.8px] w-[12.3px]" />
        </button>
        <p className="absolute top-[54px] left-[135px] text-[14px] leading-[normal] text-[#8e8e8e]">
          Residents {t ? t.residents.length : 0}/{MAX_RESIDENTS}
        </p>
        {editable ? (
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            maxLength={100}
            rows={2}
            placeholder="Write your town biography."
            aria-label="Town biography"
            className="absolute top-[77px] left-[135px] w-[235px] resize-none bg-transparent text-[17px] leading-[1.2] outline-none placeholder:text-black"
          />
        ) : (
          <p className="absolute top-[77px] left-[135px] line-clamp-2 w-[235px] text-[17px] leading-[1.2] break-words">{t!.bio}</p>
        )}
        <p className="absolute top-[127px] left-[135px] text-[14px] leading-[1.3] text-[#8e8e8e]">since {dotDate(t ? t.createdAt : adding!.createdAt)}</p>
        {isNew ? (
          <>
            {pill('Discard', () => setAdding(null), 133, true)}
            {pill('Create', create, 296)}
          </>
        ) : editing ? (
          <>
            {pill('Delete', () => askDelete(t!), 133, true)}
            {pill('Done', save, 311)}
          </>
        ) : action ? (
          pill(action, () => place(t!), action.length > 4 ? 296 : 311)
        ) : (
          pill('Edit', () => {
            setDraft({ name: t!.name, bio: t!.bio })
            setEditing(true)
          }, 311)
        )}
        <span data-thumb className="pointer-events-none absolute top-0 left-[24px]">
          <Thumb image={t ? chiefImage(t) : undefined} size={84} strong />
        </span>
        {/* Go sits on top of the thumbnail, centered under it */}
        {t && !editing && mode === 'browse' && (
          <button aria-label={`Go to ${t.name}`} onClick={() => onGo(t.id)} className="absolute top-[70px] left-[39px] z-10">
            <GoTag />
          </button>
        )}
      </>
    )
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <Header title="Town List" onBack={() => (dirty ? askSave(onBack) : onBack())} right={<PlusButton label="Add town" onClick={startAdd} />} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[186px] bg-gradient-to-b from-[#f0f0f0] from-[71%] to-[#f0f0f0]/0" />

      <div ref={listEl} className="absolute inset-x-0 top-[149px] bottom-0 overflow-y-auto [scrollbar-width:none]">
        <div className="relative isolate min-h-full" style={{ height: listHeight }}>
          {/* the grey line every town hangs on */}
          <img src={tlBar} alt="" className="pointer-events-none absolute top-[37px] left-[20px] w-[96px] max-w-none" style={{ height: `calc(100% - 37px)` }} />

          {state.towns.map((t, i) => {
            const isOpen = openId === t.id
            const dimmed = (!!openId && !isOpen) || !!adding
            const lifted = dragIdx === i
            return (
              <div
                key={t.id}
                className={`absolute inset-x-0 ${lifted ? 'z-10' : 'transition-[top] duration-200'}`}
                style={{ top: rowTop(i) + (lifted ? dragDy : 0), height: isOpen ? ROW + OPEN_EXTRA : ROW }}
                ref={(el) => {
                  if (el) thumbs.current.set(t.id, el)
                  else thumbs.current.delete(t.id)
                }}
              >
                {isOpen ? (
                  detail(t)
                ) : (
                  <>
                    <button aria-label={`${t.name} details`} onClick={() => toggle(t)} data-thumb className="absolute top-0 left-[31px]">
                      <Thumb image={chiefImage(t)} size={70} grey={dimmed} />
                    </button>
                    <button onClick={() => toggle(t)} className="absolute top-[23px] left-[121px] max-w-[220px] truncate text-left text-[21px] leading-[1.1]">
                      {t.name}
                    </button>
                    <span
                      aria-label="Reorder"
                      className="absolute top-[20px] left-[352px] flex size-[30px] touch-none items-center justify-center"
                      onPointerDown={(e) => onHandleDown(e, i)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      onPointerCancel={onHandleUp}
                    >
                      <HandleIcon />
                    </span>
                  </>
                )}
              </div>
            )
          })}

          {adding && (
            <div className="absolute inset-x-0" style={{ top: rowTop(state.towns.length), height: ROW + OPEN_EXTRA }}>
              {detail(null)}
            </div>
          )}
        </div>
      </div>

      {/* card waiting to move in (townList for migration) */}
      {card && (
        <div
          ref={cardEl}
          className="pointer-events-none absolute left-[290px] z-30 w-[115px] drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
          style={{
            top: fromBottom(676),
            transform: flying ? `translate(${flying.x}px, ${flying.y}px) scale(0.15) rotate(0deg)` : 'rotate(6deg)',
            opacity: flying ? 0.2 : 1,
            transition: 'transform 0.6s cubic-bezier(0.5, 0, 0.75, 0), opacity 0.6s ease-in',
          }}
        >
          <CardView card={card} />
        </div>
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}
