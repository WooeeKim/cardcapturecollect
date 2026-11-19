import { supabase, type User } from './auth'
import { deviceId } from './gilbti'
import type { State } from './store'

// Daily 10 p.m. interview (Figma UX › "08 매일 20시 인터뷰"; moved from 20:00 to 22:00 on 11/19), 2026-11-16 … 11-22,
// phone's local time.
// - Each day's interview opens at 22:00 and can be answered until 21:59 the next day (then the next one opens).
// - Who made no card in that day's window gets "Why didn't you draw today?"; everyone else gets the 3 questions.
//   Window = previous day 22:00 → this day 22:00 (the first day: 00:00 → 22:00).
// - Answers are kept on this device first, then sent to Supabase table interview_responses
//   (supabase/migrations/011_interview.sql); a failed send is retried on the next start.
export const FIRST_DAY = '2026-11-16'
export const LAST_DAY = '2026-11-22'
export const HOUR = 22

export type Kind = 'drew' | 'didnt_draw'
export type Slot = { day: string; from: Date; to: Date }
export type Answers = Record<string, string>

export const FEELINGS = ['Interested', 'Excited', 'Bored', 'Indifferent'] as const

const p2 = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

// the interview this moment belongs to: the day whose 22:00 passed most recently (null outside the test week)
export function currentSlot(now = new Date()): Slot | null {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (now.getHours() < HOUR) d.setDate(d.getDate() - 1)
  const day = ymd(d)
  if (day < FIRST_DAY || day > LAST_DAY) return null
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), HOUR)
  const from = day === FIRST_DAY ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, HOUR)
  return { day, from, to }
}

// cards made inside the slot's window (the one still waiting to be sent to a town counts too)
export function cardsIn(state: State, slot: Slot) {
  const all = [...Object.values(state.cards), ...(state.pending ? [state.pending] : [])]
  return all.filter((c) => {
    const t = new Date(c.createdAt).getTime()
    return t >= slot.from.getTime() && t < slot.to.getTime()
  }).length
}

// ---------- this device ----------

type Saved = { day: string; kind: Kind; cards: number; answers: Answers; at: string; sent: boolean; user: string | null }
const KEY = 'subwayseal.interview'

function readAll(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
function writeAll(list: Saved[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
}

// ---------- server ----------

async function send(s: Saved, user: User | null, nickname: string) {
  if (!supabase) return true // no server: the device copy is all there is
  const { error } = await supabase.from('interview_responses').insert({
    day: s.day,
    kind: s.kind,
    cards: s.cards,
    answers: s.answers,
    user_id: user?.id ?? null,
    email: user?.username.toLowerCase() ?? null,
    nickname: nickname || null,
    device_id: deviceId(),
    created_at: s.at,
  })
  if (error) console.warn('interview_responses save failed (run supabase/migrations/011_interview.sql?)', error.message)
  return !error
}

// Has this account answered that day's interview? This device first, then the server (another device of the same account).
export async function answered(user: User | null, day: string): Promise<boolean> {
  const who = user?.id ?? null
  if (readAll().some((s) => s.day === day && s.user === who)) return true
  if (!supabase || !user) return false
  const { data, error } = await supabase.from('interview_responses').select('id').eq('user_id', user.id).eq('day', day).limit(1)
  if (error) {
    console.warn('interview_responses read failed (run supabase/migrations/011_interview.sql?)', error.message)
    return false
  }
  return !!data?.length
}

export async function submit(user: User | null, nickname: string, slot: Slot, kind: Kind, cards: number, answers: Answers) {
  const s: Saved = { day: slot.day, kind, cards, answers, at: new Date().toISOString(), sent: false, user: user?.id ?? null }
  writeAll([...readAll(), s])
  if (await send(s, user, nickname)) writeAll(readAll().map((x) => (x.at === s.at ? { ...x, sent: true } : x)))
}

// App start: this account's answers that never reached the server go now.
export async function resendInterviews(user: User | null, nickname: string) {
  for (const s of readAll()) {
    if (s.sent || s.user !== (user?.id ?? null)) continue
    if (await send(s, user, nickname)) writeAll(readAll().map((x) => (x.at === s.at ? { ...x, sent: true } : x)))
  }
}
