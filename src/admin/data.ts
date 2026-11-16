import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card, State, Town } from '../lib/store'

// One saved account (user_states row) and one drawing, flattened with who made it and where it lives.
export type Row = { user_id: string; email: string | null; state: State; updated_at: string }
export type Item = { card: Card; owner: Row; town: Town | null; pending: boolean }

export const when = (iso: string) => new Date(iso).toLocaleString()
export const who = (r: Row) => r.state.nickname || r.email || r.user_id.slice(0, 8)
export const cardCount = (r: Row) => Object.keys(r.state.cards).length + (r.state.pending ? 1 : 0)

// every drawing (placed + the one waiting to be sent), newest first
export function flatten(rows: Row[]): Item[] {
  const out: Item[] = []
  for (const owner of rows) {
    const s = owner.state
    for (const card of Object.values(s.cards)) out.push({ card, owner, town: s.towns.find((t) => t.residents.includes(card.id)) ?? null, pending: false })
    if (s.pending) out.push({ card: s.pending, owner, town: null, pending: true })
  }
  return out.sort((a, b) => b.card.createdAt.localeCompare(a.card.createdAt))
}

// local YYYY-MM-DD
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ---------- app_events (supabase/migrations/009_app_events.sql) ----------

export type Ev = {
  session_id: string
  device_id: string
  user_id: string | null
  email: string | null
  event: string
  at: string
  data: Record<string, unknown> | null
  // 012_app_events_v2.sql (before it ran, the app put them in data._as / _seq / _scr; loadEvents moves them here)
  app_session: string | null
  seq: number | null
  screen: string | null
}

// every event, oldest first (Supabase returns at most 1000 rows per request, so page through).
// Without 012 the new columns don't exist yet: then everything is read and they come from data.
export async function loadEvents(sb: SupabaseClient): Promise<{ data: Ev[]; error: string }> {
  const out: Ev[] = []
  let cols = 'session_id, device_id, user_id, email, event, at, data, app_session, seq, screen'
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('app_events').select(cols).order('at').range(from, from + 999)
    if (error && cols.includes('app_session') && /app_session|seq|screen|column/i.test(error.message)) {
      cols = 'session_id, device_id, user_id, email, event, at, data'
      from -= 1000
      continue
    }
    if (error) return { data: out.map(norm), error: error.message }
    out.push(...(data as unknown as Ev[]))
    if (data.length < 1000) return { data: out.map(norm), error: '' }
  }
}
function norm(e: Ev): Ev {
  const d = e.data ?? {}
  return {
    ...e,
    app_session: e.app_session ?? (typeof d._as === 'string' ? d._as : null),
    seq: e.seq ?? (typeof d._seq === 'number' ? d._seq : null),
    screen: e.screen ?? (typeof d._scr === 'string' ? d._scr : null),
  }
}

// ---------- people ----------
// A person = an account (user_id), or a guest device ("device:<id>"). Guest events on a device that later
// logged in belong to that account (the onboarding happens before login).
export const deviceKey = (device: string) => `device:${device}`
export function personOf(events: Ev[]) {
  const owner = new Map<string, string>()
  for (const e of events) if (e.user_id && !owner.has(e.device_id)) owner.set(e.device_id, e.user_id)
  return (x: { user_id: string | null; device_id: string }) => x.user_id ?? owner.get(x.device_id) ?? deviceKey(x.device_id)
}

// ---------- time in the app ----------
// Each gap between two events of one app session counts toward the screen of the first, up to CAP
// (heartbeats come every 30 s while the app is visible). Nothing counts after app_hide / app_close or after a
// heartbeat that says nobody touched the screen for a minute (idle).
const CAP = 40_000
export type Usage = { ms: number; sessions: Set<string>; days: Set<string>; screens: Map<string, number> }
export function usage(events: Ev[], person: (e: Ev) => string): Map<string, Usage> {
  const bySession = new Map<string, Ev[]>()
  for (const e of events) if (e.app_session) bySession.set(e.app_session, [...(bySession.get(e.app_session) ?? []), e])
  const out = new Map<string, Usage>()
  for (const [id, evs] of bySession) {
    evs.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || a.at.localeCompare(b.at))
    const u = out.get(person(evs[0])) ?? { ms: 0, sessions: new Set(), days: new Set(), screens: new Map() }
    out.set(person(evs[0]), u)
    u.sessions.add(id)
    evs.forEach((e, i) => {
      const next = evs[i + 1]
      if (!next || e.event === 'app_hide' || e.event === 'app_close' || (e.event === 'heartbeat' && e.data?.idle)) return
      const gap = Math.min(CAP, Math.max(0, Date.parse(next.at) - Date.parse(e.at)))
      if (!gap) return
      u.ms += gap
      u.days.add(dayKey(new Date(e.at)))
      const sc = e.screen ?? 'unknown'
      u.screens.set(sc, (u.screens.get(sc) ?? 0) + gap)
    })
  }
  return out
}

// feedback sent from My page → Feedback, newest first
export type Feedback = { at: string; who: string; text: string }
const whoEv = (e: Ev) => e.email ?? `guest ${e.device_id.slice(0, 6)}`
export const feedbacks = (events: Ev[]): Feedback[] =>
  events
    .filter((e) => e.event === 'feedback' && typeof e.data?.text === 'string')
    .map((e) => ({ at: e.at, who: whoEv(e), text: e.data!.text as string }))
    .reverse()

// One visit to the drawing screen. Each state event lasts until the next event of the session;
// 'hidden' (app in background) and 'confirm' (final check) count toward neither tab.
export type CardSession = { id: string; who: string; start: string; draw: number; memo: number; result: 'finish' | 'exit' | 'open'; strokes: number; stage: string; first: Ev }
const STATES = new Set(['draw', 'memo', 'confirm', 'hidden'])

export function cardSessions(events: Ev[]): CardSession[] {
  const by = new Map<string, Ev[]>()
  const strokes = new Map<string, number>()
  for (const e of events) if (e.event === 'stroke') strokes.set(e.session_id, (strokes.get(e.session_id) ?? 0) + 1)
  for (const e of events) if (e.session_id !== '-' && (STATES.has(e.event) || e.event === 'finish' || e.event === 'exit')) by.set(e.session_id, [...(by.get(e.session_id) ?? []), e])
  const out: CardSession[] = []
  for (const [id, evs] of by) {
    const s: CardSession = { id, who: whoEv(evs[0]), start: evs[0].at, draw: 0, memo: 0, result: 'open', strokes: strokes.get(id) ?? 0, stage: '', first: evs[0] }
    evs.forEach((e, i) => {
      const next = evs[i + 1]
      if (next && (e.event === 'draw' || e.event === 'memo')) s[e.event] += (Date.parse(next.at) - Date.parse(e.at)) / 1000
      if (e.event === 'finish' || e.event === 'exit') s.result = e.event
      if (e.event === 'draw' || e.event === 'memo' || e.event === 'confirm') s.stage = e.event
      if (e.event === 'exit' && typeof e.data?.stage === 'string') s.stage = e.data.stage
      if (typeof e.data?.strokes === 'number') s.strokes = Math.max(s.strokes, e.data.strokes)
    })
    out.push(s)
  }
  return out.sort((a, b) => b.start.localeCompare(a.start))
}
