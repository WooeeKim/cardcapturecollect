import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/auth'
import { FEELINGS } from '../lib/interview'
import { when, type Row } from './data'

// 10pm: the daily 10 p.m. interview (interview_responses, supabase/migrations/011_interview.sql).
// Per day: who answered, who drew vs didn't, how they felt; below, every answer (+ CSV).
type Resp = {
  id: string
  day: string
  kind: 'drew' | 'didnt_draw'
  cards: number
  answers: Record<string, string>
  user_id: string | null
  email: string | null
  nickname: string | null
  device_id: string
  created_at: string
}

const DAYS = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
const feelingOf = (r: Resp) => (r.kind !== 'drew' ? '' : r.answers.feeling === 'Other' ? `Other: ${r.answers.feeling_other ?? ''}` : (r.answers.feeling ?? ''))

export function Interview({ rows }: { rows: Row[] }) {
  const [data, setData] = useState<Resp[] | null>(null)
  const [error, setError] = useState('')
  const [day, setDay] = useState<string>('all')

  useEffect(() => {
    supabase!
      .from('interview_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return setError(`${error.message} — run supabase/migrations/011_interview.sql`)
        setData(data as Resp[])
      })
  }, [])

  const nameOf = (r: Resp) => r.nickname ?? (r.user_id ? rows.find((x) => x.user_id === r.user_id)?.state.nickname : undefined) ?? '—'
  const shown = useMemo(() => (data ?? []).filter((r) => day === 'all' || r.day === day), [data, day])

  const csv = () => {
    const head = ['day', 'answered_at', 'nickname', 'email', 'kind', 'cards', 'situation', 'who_why', 'feeling', 'why_not']
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = shown.map((r) => [r.day, r.created_at, nameOf(r), r.email ?? `guest ${r.device_id.slice(0, 8)}`, r.kind, r.cards, r.answers.situation, r.answers.who_why, feelingOf(r), r.answers.why_not].map(q).join(','))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `subwayseal-10pm-${day}.csv`
    a.click()
  }

  if (error) return <p className="text-red-700">{error}</p>
  if (!data) return <p className="text-neutral-500">Loading…</p>

  return (
    <div>
      {/* one card per day: answered / drew / didn't, and the feelings of those who drew */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAYS.map((d) => {
          const list = data.filter((r) => r.day === d)
          const drew = list.filter((r) => r.kind === 'drew')
          return (
            <button key={d} onClick={() => setDay(day === d ? 'all' : d)} className={`rounded p-3 text-left text-sm ${day === d ? 'bg-black text-white' : 'bg-neutral-100'}`}>
              <div className="font-medium">{d.slice(5).replace('-', '/')}</div>
              <div className="text-2xl">{list.length}</div>
              <div className="opacity-70">
                drew {drew.length} · didn't {list.length - drew.length}
              </div>
              {drew.length > 0 && (
                <div className="mt-1 text-xs opacity-70">
                  {[...FEELINGS, 'Other']
                    .map((f) => [f, drew.filter((r) => r.answers.feeling === f).length] as const)
                    .filter(([, n]) => n)
                    .map(([f, n]) => `${f} ${n}`)
                    .join(' · ')}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex items-center gap-4 text-sm text-neutral-600">
        <span>
          {day === 'all' ? 'All days' : day} · {shown.length} answers
        </span>
        <button className="underline" onClick={csv}>
          Download CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr className="border-b">
              <th className="py-2 pr-3 font-normal">Day</th>
              <th className="py-2 pr-3 font-normal">Answered</th>
              <th className="py-2 pr-3 font-normal">Who</th>
              <th className="py-2 pr-3 font-normal">Cards</th>
              <th className="min-w-[180px] py-2 pr-3 font-normal">In what situation did you collect?</th>
              <th className="min-w-[180px] py-2 pr-3 font-normal">Who did you collect, and why?</th>
              <th className="py-2 pr-3 font-normal">Feeling</th>
              <th className="min-w-[180px] py-2 pr-3 font-normal">Why didn't you draw today?</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{r.day.slice(5).replace('-', '/')}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-neutral-500">{when(r.created_at)}</td>
                <td className="py-2 pr-3">
                  <div>{nameOf(r)}</div>
                  <div className="text-xs text-neutral-500">{r.email ?? `guest · ${r.device_id.slice(0, 8)}`}</div>
                </td>
                <td className="py-2 pr-3">{r.cards}</td>
                <td className="py-2 pr-3">{r.answers.situation ?? '—'}</td>
                <td className="py-2 pr-3">{r.answers.who_why ?? '—'}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{feelingOf(r) || '—'}</td>
                <td className="py-2 pr-3">{r.answers.why_not ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="mt-4 text-neutral-500">No answers yet.</p>}
      </div>
    </div>
  )
}
