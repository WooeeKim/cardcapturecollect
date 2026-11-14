import { useState } from 'react'
import { cardCount, when, who, type Row } from './data'

// 사람별 보기: pick a person → the real app, as if logged in as them (read-only, <site>/?viewAs=<id>).
export function People({ rows, selected, onSelect }: { rows: Row[]; selected: string | null; onSelect: (userId: string) => void }) {
  const [q, setQ] = useState('')
  const [nonce, setNonce] = useState(0) // bump to reload the phone (reset in-memory pokes)
  const needle = q.trim().toLowerCase()
  const list = rows.filter((r) => !needle || [r.email, r.state.nickname].some((v) => v?.toLowerCase().includes(needle)))
  const current = rows.find((r) => r.user_id === selected)

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="w-full shrink-0 md:w-80">
        <input className="mb-2 w-full rounded border px-3 py-1.5 text-sm" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-[70vh] overflow-auto rounded border text-sm">
          {list.map((r) => (
            <li key={r.user_id}>
              <button
                onClick={() => onSelect(r.user_id)}
                className={`flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-0 ${r.user_id === selected ? 'bg-black text-white' : 'hover:bg-neutral-50'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{who(r)}</span>
                  <span className={`block truncate text-xs ${r.user_id === selected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    {r.email ?? r.user_id} · {when(r.updated_at)}
                  </span>
                </span>
                <span className="tabular-nums">{cardCount(r)}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-2 text-neutral-500">Nobody matches.</li>}
        </ul>
      </aside>

      <section className="flex flex-1 flex-col items-center">
        {current ? (
          <>
            <div className="mb-3 flex w-full max-w-[402px] items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <b className="font-medium">{who(current)}</b> · {current.state.towns.length} towns · {cardCount(current)} cards
              </span>
              <button className="underline" onClick={() => setNonce((n) => n + 1)}>
                Reload
              </button>
              <a className="underline" href={`/?viewAs=${current.user_id}`} target="_blank" rel="noreferrer">
                New tab
              </a>
            </div>
            <iframe
              key={`${current.user_id}:${nonce}`}
              title={`App as ${who(current)}`}
              src={`/?viewAs=${current.user_id}`}
              className="h-[min(898px,82vh)] w-[min(426px,calc(82vh*426/898))] border-0"
            />
            <p className="mt-3 max-w-[402px] text-center text-xs text-neutral-500">Read-only: you can tap around, but nothing is saved to their account.</p>
          </>
        ) : (
          <p className="mt-20 text-neutral-500">Pick someone on the left to see the app as they see it.</p>
        )}
      </section>
    </div>
  )
}
