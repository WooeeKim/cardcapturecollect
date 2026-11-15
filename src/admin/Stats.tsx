import { useMemo, useState, type ReactNode } from 'react'
import { moodOf } from '../lib/moods'
import { cardCount, dayKey, who, type Item, type Row } from './data'

const INK = '#3d5a80' // single hue for every magnitude bar

// 통계: how much people draw, when, with which moods / places, and how complete their cards are.
// Only accounts are counted: guest towns live on their own device and never reach the server.
export function Stats({ rows, items, gilCount }: { rows: Row[]; items: Item[]; gilCount: number | null }) {
  const [range, setRange] = useState<14 | 30 | 90>(30)
  const s = useMemo(() => {
    const now = new Date()
    const makers = rows.filter((r) => cardCount(r) > 0)
    const since = (days: number) => items.filter((i) => now.getTime() - Date.parse(i.card.createdAt) < days * 864e5).length
    const activeWeek = new Set(items.filter((i) => now.getTime() - Date.parse(i.card.createdAt) < 7 * 864e5).map((i) => i.owner.user_id)).size

    const days: { label: string; title: string; n: number }[] = []
    const perDay = new Map<string, number>()
    for (const i of items) perDay.set(dayKey(new Date(i.card.createdAt)), (perDay.get(dayKey(new Date(i.card.createdAt))) ?? 0) + 1)
    for (let k = range - 1; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k)
      const key = dayKey(d)
      days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, title: key, n: perDay.get(key) ?? 0 })
    }

    const hours = Array.from({ length: 24 }, (_, h) => ({ label: String(h), title: `${h}:00–${h}:59`, n: 0 }))
    for (const i of items) hours[new Date(i.card.createdAt).getHours()].n++

    const tally = (vals: string[]) => {
      const m = new Map<string, number>()
      for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1)
      return [...m.entries()].sort((a, b) => b[1] - a[1])
    }
    const moods = tally(items.map((i) => i.card.mood || '(none)'))
    const places = tally(items.map((i) => i.card.place).filter(Boolean))
    const top = [...makers].sort((a, b) => cardCount(b) - cardCount(a)).slice(0, 10)

    const buckets: [string, (n: number) => boolean][] = [
      ['0', (n) => n === 0],
      ['1', (n) => n === 1],
      ['2–4', (n) => n >= 2 && n <= 4],
      ['5–9', (n) => n >= 5 && n <= 9],
      ['10+', (n) => n >= 10],
    ]
    const spread = buckets.map(([label, f]) => ({ label, title: `${label} cards`, n: rows.filter((r) => f(cardCount(r))).length }))

    const pct = (n: number) => (items.length ? Math.round((n / items.length) * 100) : 0)
    const filled = [
      ['Mood', pct(items.filter((i) => i.card.mood).length)],
      ['Place', pct(items.filter((i) => i.card.place).length)],
      ['Name', pct(items.filter((i) => i.card.nickname).length)],
      ['Memo', pct(items.filter((i) => i.card.memo).length)],
      ['Sent to a town', pct(items.filter((i) => !i.pending).length)],
    ] as const
    const towns = rows.reduce((n, r) => n + r.state.towns.length, 0)

    return { makers, since, activeWeek, days, hours, moods, places, top, spread, filled, towns }
  }, [rows, items, range])

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Accounts" value={rows.length} note={`${s.makers.length} drew at least once`} />
        <Tile label="Cards" value={items.length} note={`${s.since(1)} today · ${s.since(7)} this week`} />
        <Tile label="Cards / drawer" value={s.makers.length ? (items.length / s.makers.length).toFixed(1) : '—'} note="among people who drew" />
        <Tile label="Active this week" value={s.activeWeek} note="people who drew in 7 days" />
        <Tile label="Towns" value={s.towns} note={rows.length ? `${(s.towns / rows.length).toFixed(1)} per account` : ''} />
        <Tile label="Subway-TI answers" value={gilCount ?? '—'} note="incl. guests, latest per person" />
      </div>

      <Panel
        title="Cards per day"
        right={
          <div className="flex gap-1 text-xs">
            {([14, 30, 90] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`rounded-full px-2.5 py-1 ${range === r ? 'bg-black text-white' : 'bg-neutral-100'}`}>
                {r}d
              </button>
            ))}
          </div>
        }
      >
        <Columns data={s.days} every={range > 30 ? 14 : range > 14 ? 5 : 2} />
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Time of day (when cards are made)">
          <Columns data={s.hours} every={3} />
        </Panel>
        <Panel title="Cards per person (how many accounts)">
          <Columns data={s.spread} every={1} />
        </Panel>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Panel title="Moods">
          <Bars rows={s.moods.map(([k, n]) => ({ label: k, n, color: k === '(none)' ? '#c4c4c4' : moodOf(k).color }))} total={items.length} />
        </Panel>
        <Panel title="Top places">
          {s.places.length ? <Bars rows={s.places.slice(0, 12).map(([k, n]) => ({ label: k, n }))} total={items.length} /> : <Empty />}
        </Panel>
        <Panel title="Top drawers">
          {s.top.length ? <Bars rows={s.top.map((r) => ({ label: who(r), n: cardCount(r) }))} total={items.length} /> : <Empty />}
        </Panel>
      </div>

      <Panel title="How complete are cards (% of cards with each field)">
        <Bars rows={s.filled.map(([k, p]) => ({ label: k, n: p }))} total={100} unit="%" />
      </Panel>
      <p className="text-xs text-neutral-500">Counts accounts only: a guest's town stays on their own device until they log in.</p>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-3xl tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-neutral-500">{note}</div>}
    </div>
  )
}

function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h3 className="flex-1 text-neutral-700">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

const Empty = () => <p className="text-sm text-neutral-500">No data yet.</p>

// vertical columns sharing one baseline; hover shows the exact value
function Columns({ data, every }: { data: { label: string; title: string; n: number }[]; every: number }) {
  const max = Math.max(1, ...data.map((d) => d.n))
  return (
    <div>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-neutral-300">
        <span className="absolute -top-1 left-0 text-[10px] text-neutral-400 tabular-nums">{max}</span>
        {data.map((d) => (
          <div key={d.title} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 2 : 0, background: INK }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-black px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
              {d.title}: <b className="font-medium">{d.n}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-neutral-400">
        {data.map((d, i) => (
          <span key={d.title} className="flex-1 overflow-visible text-center whitespace-nowrap">
            {i % every === 0 || i === data.length - 1 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// horizontal bars with the label and value as text (identity never relies on the bar color)
function Bars({ rows, total, unit = '' }: { rows: { label: string; n: number; color?: string }[]; total: number; unit?: string }) {
  const max = unit ? total : Math.max(1, ...rows.map((r) => r.n)) // percentages run to 100
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-2" title={unit ? `${r.n}${unit}` : `${r.n} of ${total} (${total ? Math.round((r.n / total) * 100) : 0}%)`}>
          <span className="truncate text-neutral-700">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-r-[4px]">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${(r.n / max) * 100}%`, background: r.color ?? INK }} />
          </span>
          <span className="w-10 text-right text-neutral-600 tabular-nums">
            {r.n}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  )
}
