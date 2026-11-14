import { useEffect, useMemo, useState } from 'react'
import { CardView } from '../components/ui'
import { moodOf } from '../lib/moods'
import { when, who, type Item } from './data'
import { PlazaTown } from './PlazaTown'

const VIEW_KEY = 'subwayseal.admin.plazaView'
const savedView = (): 'cards' | 'town' => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'town' ? 'town' : 'cards'
  } catch {
    return 'cards'
  }
}

// 광장: everyone's drawings, as a card wall (newest first) or as one town where they all walk around.
// Filter by mood; click a card or a walker to open it.
export function Plaza({ items, onViewAs }: { items: Item[]; onViewAs: (userId: string) => void }) {
  const [mood, setMood] = useState('')
  const [plain, setPlain] = useState(true)
  const [view, setView] = useState(savedView)
  const pickView = (v: 'cards' | 'town') => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode */
    }
  }
  const [open, setOpen] = useState<Item | null>(null)
  const moods = useMemo(() => [...new Set(items.map((i) => i.card.mood).filter(Boolean))].sort(), [items])
  const shown = mood ? items.filter((i) => i.card.mood === mood) : items
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [open])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setMood('')} className={`rounded-full px-3 py-1 ${!mood ? 'bg-black text-white' : 'bg-neutral-100'}`}>
          All {items.length}
        </button>
        {moods.map((m) => (
          <button
            key={m}
            onClick={() => setMood(m === mood ? '' : m)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${mood === m ? 'bg-black text-white' : 'bg-neutral-100'}`}
          >
            <span className="size-2.5 rounded-full" style={{ background: moodOf(m).color }} />
            {m} {items.filter((i) => i.card.mood === m).length}
          </button>
        ))}
        <span className="flex-1" />
        {view === 'cards' && (
          <label className="flex items-center gap-2 text-neutral-600">
            <input type="checkbox" checked={plain} onChange={(e) => setPlain(e.target.checked)} />
            Drawings only
          </label>
        )}
        <div className="flex rounded-full bg-neutral-100 p-0.5" role="group" aria-label="Plaza view">
          {(
            [
              ['cards', 'Cards'],
              ['town', 'Town'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => pickView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-3 py-1 ${view === v ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'town' && <PlazaTown items={shown} onOpen={setOpen} />}

      {view === 'cards' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {shown.map((i) => (
            <button key={`${i.owner.user_id}:${i.card.id}`} onClick={() => setOpen(i)} className="group text-left">
              <div className={`rounded-[10px] ring-1 ring-neutral-200 transition group-hover:ring-2 group-hover:ring-black ${i.pending ? 'opacity-60' : ''}`}>
                <div className="pointer-events-none">
                  <CardView card={i.card} plain={plain} />
                </div>
              </div>
              <p className="mt-1 truncate text-xs text-neutral-500">
                {who(i.owner)}
                {i.pending ? ' · not sent yet' : ''}
              </p>
            </button>
          ))}
        </div>
      )}
      {view === 'cards' && shown.length === 0 && <p className="text-neutral-500">No drawings yet.</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(null)}>
          <div
            className="flex max-h-full w-full max-w-2xl flex-col gap-5 overflow-auto rounded-2xl bg-white p-5 sm:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full shrink-0 sm:w-[280px]">
              <CardView card={open.card} />
            </div>
            <dl className="grid flex-1 grid-cols-[80px_1fr] content-start gap-x-3 gap-y-2 text-sm">
              <dt className="text-neutral-500">By</dt>
              <dd>
                {open.owner.state.nickname && <div>{open.owner.state.nickname}</div>}
                <div className="text-neutral-500">{open.owner.email ?? open.owner.user_id}</div>
              </dd>
              <dt className="text-neutral-500">Town</dt>
              <dd>{open.pending ? 'Not sent to a town yet' : (open.town?.name ?? '—')}</dd>
              <dt className="text-neutral-500">Made</dt>
              <dd>{when(open.card.createdAt)}</dd>
              <dt className="text-neutral-500">Serial</dt>
              <dd>{open.card.serial}</dd>
              <dt className="text-neutral-500">Mood</dt>
              <dd>{open.card.mood || '—'}</dd>
              <dt className="text-neutral-500">Place</dt>
              <dd>{open.card.place || '—'}</dd>
              <dt className="text-neutral-500">Name</dt>
              <dd>{open.card.nickname || '—'}</dd>
              <dt className="text-neutral-500">Memo</dt>
              <dd className="break-words whitespace-pre-wrap">{open.card.memo || '—'}</dd>
              <dd className="col-span-2 mt-3 flex gap-2">
                <button className="rounded-full bg-black px-4 py-2 text-white" onClick={() => onViewAs(open.owner.user_id)}>
                  View as this person
                </button>
                <button className="rounded-full bg-neutral-100 px-4 py-2" onClick={() => setOpen(null)}>
                  Close
                </button>
              </dd>
            </dl>
          </div>
        </div>
      )}
    </>
  )
}
