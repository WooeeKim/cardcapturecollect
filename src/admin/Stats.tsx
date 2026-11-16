import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { TYPES, type TypeId } from '../lib/gilbti'
import { moodOf } from '../lib/moods'
import { cardCount, cardSessions, dayKey, deviceKey, personOf, usage, when, who, type CardSession, type Ev, type Feedback, type Item, type Row, type Usage } from './data'

const INK = '#3d5a80' // single hue for every magnitude bar
const TYPE_ORDER: TypeId[] = ['both', 'record', 'observe', 'neither']
const TOOLS = ['pen', 'highlighter', 'eraser'] as const
const TOOL_NAME: Record<string, string> = { pen: 'Pencil', highlighter: 'Highlighter', eraser: 'Eraser' }
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SCREEN_NAME: Record<string, string> = {
  splash: 'Loading', login: 'Log in / Sign up', nickname: 'Nickname', gilbti: 'Subway-TI', main: 'Town (main)', towns: 'Town list',
  migrate: 'Move to a town', send: 'Pick a town (new card)', collection: 'Collection', draw: 'Drawing', tada: 'Card done', mypage: 'My page', unknown: '(unknown)',
}
type Gil = { user_id: string | null; device_id: string; type: TypeId; nickname: string | null; email: string | null }

// 통계 (docs/logging-plan.md step 1). Filter: everyone / one person, and Subway-TI type.
// Cards come from saved accounts (user_states); time, screens, tools and left-unsaved drawings from app_events.
export function Stats({
  rows: allRows,
  items: allItems,
  gil,
  events: allEvents,
  feedback,
  eventsError,
  admin,
}: {
  rows: Row[]
  items: Item[]
  gil: Gil[] | null
  events: Ev[] | null
  feedback: Feedback[] | null
  eventsError: string
  admin: string
}) {
  const [range, setRange] = useState<14 | 30 | 90>(30)
  const [one, setOne] = useState<string>('') // person key, '' = everyone
  const [type, setType] = useState<TypeId | ''>('')

  // who is who: people, their 길BTI type and a readable name
  const base = useMemo(() => {
    const evs = allEvents ?? []
    const person = personOf(evs)
    const tester = new Set(allRows.map((r) => r.user_id))
    // the admin's own clicks are not a tester's, unless the admin is also testing (has cards)
    const events = evs.filter((e) => person(e) !== admin || tester.has(admin))
    const typeOf = new Map<string, TypeId>()
    for (const g of gil ?? []) if (!typeOf.has(person(g))) typeOf.set(person(g), g.type)
    const names = new Map<string, string>()
    for (const r of allRows) names.set(r.user_id, who(r))
    for (const g of gil ?? []) if (!names.has(person(g))) names.set(person(g), g.nickname || g.email || `guest ${g.device_id.slice(0, 6)}`)
    for (const e of events) if (!names.has(person(e))) names.set(person(e), e.email ?? `guest ${e.device_id.slice(0, 6)}`)
    const usageAll = usage(events, person)
    return { events, person, typeOf, names, usageAll }
  }, [allEvents, allRows, gil, admin])

  // what the filter keeps
  const keep = useCallback((key: string) => (one ? key === one : !type || base.typeOf.get(key) === type), [one, type, base])
  const rows = allRows.filter((r) => keep(r.user_id))
  const items = allItems.filter((i) => keep(i.owner.user_id))
  const events = base.events.filter((e) => keep(base.person(e)))
  const sessions = allEvents ? cardSessions(events) : null

  const people = [...base.names.entries()]
    .filter(([k]) => !type || base.typeOf.get(k) === type)
    .sort((a, b) => (base.usageAll.get(b[0])?.ms ?? 0) - (base.usageAll.get(a[0])?.ms ?? 0))

  return (
    <div className="flex flex-col gap-8">
      <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-2 bg-white/95 px-2 py-2 text-sm backdrop-blur">
        <select value={one} onChange={(e) => setOne(e.target.value)} className="rounded-full bg-neutral-100 px-3 py-1.5">
          <option value="">Everyone ({people.length})</option>
          {people.map(([k, name]) => (
            <option key={k} value={k}>
              {name}
              {base.typeOf.get(k) ? ` · ${TYPES[base.typeOf.get(k)!].name}` : ''}
            </option>
          ))}
        </select>
        <span className="ml-2 text-neutral-500">Subway-TI</span>
        {(['', ...TYPE_ORDER] as const).map((t) => (
          <button key={t || 'all'} disabled={!!one} onClick={() => setType(t)} className={`rounded-full px-2.5 py-1 disabled:opacity-40 ${type === t && !one ? 'bg-black text-white' : 'bg-neutral-100'}`}>
            {t ? TYPES[t].name : 'All'}
          </button>
        ))}
        {one && (
          <button className="ml-auto underline" onClick={() => setOne('')}>
            Back to everyone
          </button>
        )}
      </div>

      {eventsError && <p className="text-sm text-red-700">{eventsError} — run supabase/migrations/009_app_events.sql and 012_app_events_v2.sql</p>}
      {allEvents && <UsagePanels events={events} base={base} one={one} keep={keep} onPick={setOne} rows={allRows} sessions={sessions ?? []} />}

      <CardStats rows={rows} items={items} range={range} setRange={setRange} one={!!one} />
      <TimePanel sessions={sessions} error={eventsError} />

      {feedback && !one && !type && (
        <Panel title={`Feedback (${feedback.length})`}>
          {feedback.length ? (
            <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
              {feedback.map((f, i) => (
                <li key={i} className="rounded-xl bg-neutral-50 p-3 text-sm">
                  <div className="mb-1 text-xs text-neutral-500">
                    {when(f.at)} · {f.who}
                  </div>
                  <p className="whitespace-pre-wrap text-neutral-800">{f.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Panel>
      )}
      <p className="text-xs text-neutral-500">
        Cards count accounts only (a guest's town stays on their own device until they log in). Time, screens and tools include guests; a guest who later logs in is counted
        as that account.
      </p>
    </div>
  )
}

type Base = { events: Ev[]; person: (e: { user_id: string | null; device_id: string }) => string; typeOf: Map<string, TypeId>; names: Map<string, string>; usageAll: Map<string, Usage> }

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mins = (ms: number) => (ms >= 3600_000 ? `${(ms / 3600_000).toFixed(1)}h` : ms >= 60_000 ? `${Math.round(ms / 60_000)}m` : `${Math.round(ms / 1000)}s`)

// per person: what the logs say they did
function profile(events: Ev[], u: Usage | undefined, sessions: CardSession[]) {
  const strokes = events.filter((e) => e.event === 'stroke')
  const byTool = Object.fromEntries(TOOLS.map((t) => [t, strokes.filter((e) => e.data?.tool === t)]))
  const finished = sessions.filter((s) => s.result === 'finish')
  const left = sessions.filter((s) => s.result !== 'finish')
  return {
    ms: u?.ms ?? 0,
    days: u?.days.size ?? 0,
    appSessions: u?.sessions.size ?? 0,
    strokes: strokes.length,
    byTool,
    undo: events.filter((e) => e.event === 'undo').length,
    finished: finished.length,
    left: left.length,
    leftWithLines: left.filter((s) => s.strokes > 0).length,
  }
}

function UsagePanels({ events, base, one, keep, onPick, rows, sessions }: { events: Ev[]; base: Base; one: string; keep: (k: string) => boolean; onPick: (k: string) => void; rows: Row[]; sessions: CardSession[] }) {
  const s = useMemo(() => {
    const kept = [...base.usageAll.entries()].filter(([k]) => keep(k))
    const total = (f: (u: Usage) => number) => sum(kept.map(([, u]) => f(u)))
    const perDay = kept.filter(([, u]) => u.days.size).map(([, u]) => u.ms / u.days.size)
    const screens = new Map<string, number>()
    for (const [, u] of kept) for (const [k, v] of u.screens) screens.set(k, (screens.get(k) ?? 0) + v)

    // when the app gets opened: weekday × hour
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
    for (const e of events) if (e.event === 'app_open') {
      const d = new Date(e.at)
      grid[(d.getDay() + 6) % 7][d.getHours()]++
    }

    // everyone's average per person, for "this person vs everyone"
    const everyone = [...base.usageAll.values()]
    const avgDay = everyone.filter((u) => u.days.size).map((u) => u.ms / u.days.size)

    const strokes = events.filter((e) => e.event === 'stroke')
    const tools = TOOLS.map((t) => {
      const xs = strokes.filter((e) => e.data?.tool === t)
      return { tool: t, n: xs.length, ms: sum(xs.map((e) => Number(e.data?.ms) || 0)) }
    })
    const undo = events.filter((e) => e.event === 'undo').length
    const redo = events.filter((e) => e.event === 'redo').length
    const sizes = new Map<string, number>()
    for (const e of strokes) sizes.set(`${TOOL_NAME[String(e.data?.tool)] ?? e.data?.tool} ${e.data?.size}`, (sizes.get(`${TOOL_NAME[String(e.data?.tool)] ?? e.data?.tool} ${e.data?.size}`) ?? 0) + 1)
    const finished = sessions.filter((x) => x.result === 'finish')
    const left = sessions.filter((x) => x.result !== 'finish')

    // one line per person (everyone view), and the Subway-TI comparison
    const table = [...base.usageAll.keys(), ...rows.map((r) => r.user_id)]
      .filter((k, i, a) => a.indexOf(k) === i && keep(k))
      .map((k) => {
        const evs = events.filter((e) => base.person(e) === k)
        const p = profile(evs, base.usageAll.get(k), sessions.filter((x) => base.person(x.first) === k))
        const row = rows.find((r) => r.user_id === k)
        return { key: k, name: base.names.get(k) ?? k.slice(0, 8), type: base.typeOf.get(k), cards: row ? cardCount(row) : null, towns: row?.state.towns.length ?? null, ...p }
      })
      .sort((a, b) => b.ms - a.ms)

    return { totalMs: total((u) => u.ms), sessions: total((u) => u.sessions.size), people: kept.length, perDay, avgDay, screens, grid, tools, undo, redo, sizes, finished, left, table }
  }, [events, base, keep, rows, sessions])

  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : 0)
  const strokesTotal = sum(s.tools.map((t) => t.n))
  const versus = one ? `everyone: ${mins(med(s.avgDay))} a day (median)` : `${s.people} people`

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Time in app / day" value={mins(med(s.perDay))} note={one ? versus : `median per person · ${s.people} people`} />
        <Tile label="Time in app (total)" value={mins(s.totalMs)} note={one ? '' : s.people ? `${mins(s.totalMs / s.people)} per person` : ''} />
        <Tile label="App sessions" value={s.sessions} note={s.sessions ? `${mins(s.totalMs / s.sessions)} each on average` : ''} />
        <Tile label="Strokes" value={strokesTotal} note={s.finished.length ? `${(strokesTotal / Math.max(1, s.finished.length + s.left.length)).toFixed(0)} per drawing visit` : ''} />
        <Tile label="Undo" value={s.undo} note={strokesTotal ? `${Math.round((s.undo / strokesTotal) * 100)}% of strokes · redo ${s.redo}` : ''} />
        <Tile label="Left without saving" value={s.left.length} note={`${s.left.filter((x) => x.strokes > 0).length} had lines · ${s.finished.length} saved`} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Which screens they spend time on">
          {s.screens.size ? (
            <Bars
              rows={[...s.screens.entries()].sort((a, b) => b[1] - a[1]).map(([k, ms]) => ({ label: SCREEN_NAME[k] ?? k, n: Math.round((ms / s.totalMs) * 100), note: mins(ms) }))}
              total={100}
              unit="%"
            />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="When they open the app (weekday × hour)">
          <Heat grid={s.grid} />
        </Panel>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Drawing tools (strokes · time drawing)">
          {strokesTotal ? (
            <>
              <Bars rows={s.tools.map((t) => ({ label: TOOL_NAME[t.tool], n: t.n, note: mins(t.ms) }))} total={strokesTotal} />
              <p className="mt-3 text-xs text-neutral-500">Most used thickness</p>
              <Bars rows={[...s.sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => ({ label: k, n }))} total={strokesTotal} />
            </>
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="Drawings left without saving">
          {s.left.length ? (
            <ul className="flex max-h-72 flex-col gap-1 overflow-auto text-sm">
              {s.left.map((x) => (
                <li key={x.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-neutral-100 py-1">
                  <span className="truncate">
                    {base.names.get(base.person(x.first)) ?? x.who} <span className="text-neutral-400">· {when(x.start)}</span>
                  </span>
                  <span className="text-neutral-600">{x.result === 'exit' ? `left at ${x.stage === 'confirm' ? 'final check' : x.stage || 'draw'}` : 'app closed'}</span>
                  <span className="w-16 text-right tabular-nums">{x.strokes} strokes</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Panel>
      </div>

      {!one && <TypeCompare table={s.table} />}

      {!one && (
        <Panel title="Each person (click a row to see only them)">
          <div className="max-h-96 overflow-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-500">
                <tr>
                  {['Who', 'Subway-TI', 'Time', 'Days', 'Per day', 'Sessions', 'Cards', 'Towns', 'Strokes', 'Pencil / Highl. / Eraser', 'Undo', 'Left unsaved'].map((h) => (
                    <th key={h} className="px-3 py-2 font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.table.map((p) => (
                  <tr key={p.key} onClick={() => onPick(p.key)} className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-3 py-1.5">{p.name}{p.key.startsWith(deviceKey('')) ? <span className="text-neutral-400"> · guest</span> : null}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-neutral-600">{p.type ? TYPES[p.type].name : '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums">{mins(p.ms)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.days}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.days ? mins(p.ms / p.days) : '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.appSessions}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.cards ?? '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.towns ?? '—'}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.strokes}</td>
                    <td className="px-3 py-1.5 tabular-nums">{TOOLS.map((t) => p.byTool[t].length).join(' / ')}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.undo}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.left}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  )
}

// 길BTI 행동분석: the same numbers, one column per type (per person averages)
function TypeCompare({ table }: { table: (ReturnType<typeof profile> & { type?: TypeId; cards: number | null })[] }) {
  const cols = TYPE_ORDER.map((t) => ({ t, xs: table.filter((p) => p.type === t) }))
  if (!cols.some((c) => c.xs.length)) return null
  const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0)
  const lines: [string, (xs: typeof table) => string][] = [
    ['People', (xs) => String(xs.length)],
    ['Time in app / day', (xs) => mins(avg(xs.filter((p) => p.days).map((p) => p.ms / p.days)))],
    ['Days active', (xs) => avg(xs.map((p) => p.days)).toFixed(1)],
    ['Cards', (xs) => avg(xs.map((p) => p.cards ?? 0)).toFixed(1)],
    ['Strokes per saved card', (xs) => { const f = sum(xs.map((p) => p.finished)); return f ? (sum(xs.map((p) => p.strokes)) / f).toFixed(0) : '—' }],
    ['Highlighter share', (xs) => { const n = sum(xs.map((p) => p.strokes)); return n ? `${Math.round((sum(xs.map((p) => p.byTool.highlighter.length)) / n) * 100)}%` : '—' }],
    ['Eraser share', (xs) => { const n = sum(xs.map((p) => p.strokes)); return n ? `${Math.round((sum(xs.map((p) => p.byTool.eraser.length)) / n) * 100)}%` : '—' }],
    ['Undo per 100 strokes', (xs) => { const n = sum(xs.map((p) => p.strokes)); return n ? ((sum(xs.map((p) => p.undo)) / n) * 100).toFixed(0) : '—' }],
    ['Left without saving', (xs) => { const all = sum(xs.map((p) => p.finished + p.left)); return all ? `${Math.round((sum(xs.map((p) => p.left)) / all) * 100)}% of visits` : '—' }],
  ]
  return (
    <Panel title="By Subway-TI type (average per person)">
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-normal" />
              {cols.map((c) => (
                <th key={c.t} className="px-3 py-2 text-right font-normal">
                  {TYPES[c.t].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(([label, f]) => (
              <tr key={label} className="border-t border-neutral-100">
                <td className="px-3 py-1.5 text-neutral-600">{label}</td>
                {cols.map((c) => (
                  <td key={c.t} className="px-3 py-1.5 text-right tabular-nums">
                    {c.xs.length ? f(c.xs) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

// weekday × hour: darker = opened more often
function Heat({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat())
  if (!grid.flat().some(Boolean)) return <Empty />
  return (
    <div className="text-[10px] text-neutral-400">
      <div className="grid grid-cols-[28px_repeat(24,1fr)] gap-[2px]">
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="self-center">{WEEK[d]}</span>
            {row.map((n, h) => (
              <span key={h} title={`${WEEK[d]} ${h}:00 — ${n} opens`} className="aspect-square rounded-[3px]" style={{ background: n ? INK : '#f2f2f2', opacity: n ? 0.2 + 0.8 * (n / max) : 1 }} />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center">
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// cards: per day / hour, per person, moods, places, completeness (from saved accounts)
function CardStats({ rows, items, range, setRange, one }: { rows: Row[]; items: Item[]; range: 14 | 30 | 90; setRange: (r: 14 | 30 | 90) => void; one: boolean }) {
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
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {!one && <Tile label="Accounts" value={rows.length} note={`${s.makers.length} drew at least once`} />}
        <Tile label="Cards" value={items.length} note={`${s.since(1)} today · ${s.since(7)} this week`} />
        {!one && <Tile label="Cards / drawer" value={s.makers.length ? (items.length / s.makers.length).toFixed(1) : '—'} note="among people who drew" />}
        {!one && <Tile label="Active this week" value={s.activeWeek} note="people who drew in 7 days" />}
        <Tile label="Towns" value={s.towns} note={!one && rows.length ? `${(s.towns / rows.length).toFixed(1)} per account` : ''} />
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
        {!one && (
          <Panel title="Cards per person (how many accounts)">
            <Columns data={s.spread} every={1} />
          </Panel>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Panel title="Moods">
          {items.length ? <Bars rows={s.moods.map(([k, n]) => ({ label: k, n, color: k === '(none)' ? '#c4c4c4' : moodOf(k).color }))} total={items.length} /> : <Empty />}
        </Panel>
        <Panel title="Top places">
          {s.places.length ? <Bars rows={s.places.slice(0, 12).map(([k, n]) => ({ label: k, n }))} total={items.length} /> : <Empty />}
        </Panel>
        {!one && (
          <Panel title="Top drawers">
            {s.top.length ? <Bars rows={s.top.map((r) => ({ label: who(r), n: cardCount(r) }))} total={items.length} /> : <Empty />}
          </Panel>
        )}
      </div>

      <Panel title="How complete are cards (% of cards with each field)">
        <Bars rows={s.filled.map(([k, p]) => ({ label: k, n: p }))} total={100} unit="%" />
      </Panel>
    </>
  )
}

// Time on the card screen, from app_events (draw / memo / confirm / hidden / finish / exit with timestamps)
const median = (xs: number[]) => {
  if (!xs.length) return 0
  const a = [...xs].sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const dur = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${Math.round(sec)}s`)

function TimePanel({ sessions, error }: { sessions: CardSession[] | null; error: string }) {
  if (error) return <Panel title="Time on the card screen"><p className="text-sm text-red-700">{error} — run supabase/migrations/009_app_events.sql</p></Panel>
  if (!sessions) return null
  const done = sessions.filter((x) => x.result === 'finish')
  const exits = sessions.filter((x) => x.result === 'exit').length
  const draw = done.map((x) => x.draw)
  const memo = done.map((x) => x.memo)
  const csv = () => {
    const head = ['started_at', 'who', 'result', 'draw_sec', 'memo_sec', 'session_id']
    const lines = sessions.map((x) => [x.start, x.who, x.result, x.draw.toFixed(1), x.memo.toFixed(1), x.id].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `subwayseal-card-time-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Panel
      title="Time on the card screen (Drawing vs Memo, finished cards)"
      right={
        sessions.length ? (
          <button className="text-xs underline" onClick={csv}>
            Download CSV
          </button>
        ) : null
      }
    >
      {sessions.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Drawing (median)" value={dur(median(draw))} note={`mean ${dur(mean(draw))}`} />
            <Tile label="Memo (median)" value={dur(median(memo))} note={`mean ${dur(mean(memo))}`} />
            <Tile label="Drawing share" value={`${Math.round((mean(draw) / (mean(draw) + mean(memo) || 1)) * 100)}%`} note="of Drawing + Memo time" />
            <Tile label="Visits" value={sessions.length} note={`${done.length} finished · ${exits} left without saving`} />
          </div>
          <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-normal">Started</th>
                  <th className="px-3 py-2 font-normal">Who</th>
                  <th className="px-3 py-2 font-normal">Result</th>
                  <th className="px-3 py-2 text-right font-normal">Drawing</th>
                  <th className="px-3 py-2 text-right font-normal">Memo</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((x) => (
                  <tr key={x.id} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5 whitespace-nowrap text-neutral-600">{when(x.start)}</td>
                    <td className="px-3 py-1.5">{x.who}</td>
                    <td className="px-3 py-1.5 text-neutral-600">{x.result === 'finish' ? 'saved' : x.result === 'exit' ? 'left' : 'unknown'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{dur(x.draw)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{dur(x.memo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Time with the app in the background and on the final “Ready to finish?” check is not counted. Includes guests. “unknown” = the app closed before saving or leaving.</p>
        </>
      ) : (
        <Empty />
      )}
    </Panel>
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
function Bars({ rows, total, unit = '' }: { rows: { label: string; n: number; color?: string; note?: string }[]; total: number; unit?: string }) {
  const max = unit ? total : Math.max(1, ...rows.map((r) => r.n)) // percentages run to 100
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-2" title={unit ? `${r.n}${unit}` : `${r.n} of ${total} (${total ? Math.round((r.n / total) * 100) : 0}%)`}>
          <span className="truncate text-neutral-700">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-r-[4px]">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${(r.n / max) * 100}%`, background: r.color ?? INK }} />
          </span>
          <span className="min-w-10 text-right text-neutral-600 tabular-nums">
            {r.n}
            {unit}
            {r.note && <span className="ml-1.5 text-neutral-400">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
