import { useEffect, useRef, useState } from 'react'
import { CardView, GoTag, fromBottom, HandleIcon, Header, PlusButton, Popup, TextButton, Thumb, XIcon, type PopupAction } from '../components/ui'
import { framePoint } from '../lib/frame'
import { MAX_RESIDENTS, MAX_TOWNS, addTown, canDeleteTown, deleteTown, dotDate, moveTown, newTown, updateTown, type Card, type State, type Town } from '../lib/store'

// Figma prototyping: townList · townList-detail · townList for migration · 마을 추가
// browse  = Go / Edit
// migrate = move an existing card ("Migration")
// send    = place a newly drawn card ("Send")
export type ListMode = 'browse' | 'migrate' | 'send'

const ROW = 124
const OPEN_EXTRA = 100 // open row is 224 tall

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
      message: "There's unsaved changes. Do you wanna save?",
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

  const detail = (t: Town | null) => {
    const isNew = !t
    const editable = isNew || editing
    return (
      <>
        <div className="absolute top-[5px] left-[80px] h-[178px] w-[307px] rounded-[12px] bg-[#ededed]" />
        {editable ? (
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={20}
            placeholder={isNew ? `New Town ${state.towns.length + 1}` : ''}
            aria-label="Town name"
            className="absolute top-[14px] left-[127px] w-[210px] bg-transparent text-[24px] leading-[normal] outline-none placeholder:text-[#5f5f5f]"
          />
        ) : (
          <p className="absolute top-[18px] left-[127px] w-[215px] truncate text-[24px] leading-[normal]">{t!.name}</p>
        )}
        <button aria-label="Close" onClick={isNew ? () => setAdding(null) : close} className="absolute top-[20px] left-[347px] p-[8px]">
          <XIcon />
        </button>
        <p className="absolute top-[50px] left-[133px] text-[11px] leading-[normal] text-[#8a8a8a]">
          Residents {t ? t.residents.length : 0}/{MAX_RESIDENTS}
        </p>
        {editable ? (
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            maxLength={100}
            rows={3}
            placeholder="Write your town biography."
            aria-label="Town biography"
            className="absolute top-[74px] left-[133px] w-[230px] resize-none bg-transparent text-[12px] leading-[normal] outline-none placeholder:text-black"
          />
        ) : (
          <p className="absolute top-[76px] left-[133px] line-clamp-3 w-[230px] text-[12px] leading-[normal] break-words">{t!.bio}</p>
        )}
        <p className="absolute top-[120px] left-[133px] text-[9px] leading-[normal]">since {dotDate(t ? t.createdAt : adding!.createdAt)}</p>
        {isNew ? (
          <>
            <TextButton dim onClick={() => setAdding(null)} className="absolute top-[142px] left-[136px] text-[19.5px]">Discard</TextButton>
            <TextButton onClick={create} className="absolute top-[142px] right-[38px] text-[19.5px]">Create</TextButton>
          </>
        ) : editing ? (
          <>
            <TextButton dim onClick={() => askDelete(t!)} className="absolute top-[142px] left-[136px] text-[19.5px]">Delete</TextButton>
            <TextButton onClick={save} className="absolute top-[142px] right-[38px] text-[19.5px]">Done</TextButton>
          </>
        ) : action ? (
          <TextButton onClick={() => place(t!)} className="absolute top-[142px] right-[38px] text-[19.5px]">{action}</TextButton>
        ) : (
          <TextButton
            onClick={() => {
              setDraft({ name: t!.name, bio: t!.bio })
              setEditing(true)
            }}
            className="absolute top-[142px] right-[38px] text-[19.5px]"
          >
            Edit
          </TextButton>
        )}
        {t && !editing && mode === 'browse' && (
          <button aria-label={`Go to ${t.name}`} onClick={() => onGo(t.id)} className="absolute top-[74px] left-[43px]">
            <GoTag />
          </button>
        )}
        <span data-thumb className="pointer-events-none absolute top-[1px] left-[24px]">
          <Thumb image={t ? chiefImage(t) : undefined} size={84} strong />
        </span>
      </>
    )
  }

  return (
    <div className="relative h-full overflow-hidden bg-white font-hand">
      <Header title="Town List" onBack={() => (dirty ? askSave(onBack) : onBack())} right={<PlusButton label="Add town" onClick={startAdd} />} />
      <div className="absolute inset-x-0 top-0 z-10 h-[149px] bg-white" />

      <div ref={listEl} className="absolute inset-x-0 top-[149px] bottom-0 overflow-y-auto [scrollbar-width:none]">
        <div className="relative min-h-full" style={{ height: listHeight }}>
          {/* the grey line every town hangs on */}
          <div className="absolute top-[79px] bottom-0 left-[27px] w-[79px] bg-[#ccc]" />

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
                    <button onClick={() => toggle(t)} className="absolute top-[26px] left-[124px] max-w-[220px] truncate text-left text-[20px] leading-[normal]">
                      {t.name}
                    </button>
                    <span
                      aria-label="Reorder"
                      className="absolute top-[31px] left-[352px] touch-none p-[10px]"
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
