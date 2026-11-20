import { useEffect, useState } from 'react'
import { supabase } from '../lib/auth'
import { FINAL_QUESTIONS, type FinalAnswers } from '../lib/finalInterview'
import { when, type Row } from './data'

// Day 7: the in-app 7일차 사후 인터뷰 (final_interviews, supabase/migrations/017_final_interview.sql).
// Choice questions get a count per option on top; below, every answer per person (+ CSV).
type Resp = { id: string; answers: FinalAnswers; user_id: string | null; email: string | null; nickname: string | null; device_id: string; created_at: string }

const show = (r: Resp, id: string) => {
  const v = r.answers[id]
  const list = Array.isArray(v) ? v.join(', ') : (v ?? '')
  const other = r.answers[`${id}_other`]
  return [list, other ? `(${other})` : ''].filter(Boolean).join(' ') || '—'
}

export function FinalInterview({ rows }: { rows: Row[] }) {
  const [data, setData] = useState<Resp[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase!
      .from('final_interviews')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => (error ? setError(`${error.message} — run supabase/migrations/017_final_interview.sql`) : setData(data as Resp[])))
  }, [])

  if (error) return <p className="text-red-700">{error}</p>
  if (!data) return <p className="text-neutral-500">Loading…</p>

  // latest answer per person
  const seen = new Set<string>()
  const latest = data.filter((r) => {
    const who = r.user_id ?? `device:${r.device_id}`
    if (seen.has(who)) return false
    seen.add(who)
    return true
  })
  const nameOf = (r: Resp) => r.nickname ?? (r.user_id ? rows.find((x) => x.user_id === r.user_id)?.state.nickname : undefined) ?? '—'

  const csv = () => {
    const head = ['answered_at', 'nickname', 'email', ...FINAL_QUESTIONS.map((q) => q.prompt.ko.replace(/\n/g, ' '))]
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = latest.map((r) => [r.created_at, nameOf(r), r.email ?? '', ...FINAL_QUESTIONS.map((x) => show(r, x.id).replace(/^—$/, ''))].map(q).join(','))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + [head.map(q).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `subwayseal-day7-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-sm text-neutral-600">
        <span>{latest.length} people answered</span>
        <button className="underline" onClick={csv}>
          Download CSV
        </button>
      </div>

      {/* choice questions: how many picked each option */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FINAL_QUESTIONS.filter((q) => q.choices).map((q) => (
          <div key={q.id} className="rounded bg-neutral-100 p-3 text-sm">
            <p className="mb-2 font-medium whitespace-pre-line">{q.prompt.ko}</p>
            {[...q.choices!.map((c) => c.ko), ...(q.other ? ['기타'] : [])].map((c) => {
              // 기타 = wrote something in the 기타 box (a pick and 기타 text can both be there)
              const n = latest.filter((r) =>
                c === '기타' ? !!r.answers[`${q.id}_other`] : Array.isArray(r.answers[q.id]) ? (r.answers[q.id] as string[]).includes(c) : r.answers[q.id] === c,
              ).length
              return (
                <div key={c} className="flex justify-between gap-2">
                  <span className="text-neutral-700">{c}</span>
                  <span>{n}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr className="border-b">
              <th className="py-2 pr-3 font-normal">Answered</th>
              <th className="py-2 pr-3 font-normal">Who</th>
              {FINAL_QUESTIONS.map((q) => (
                <th key={q.id} className="min-w-[160px] py-2 pr-3 font-normal whitespace-pre-line">
                  {q.prompt.ko}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latest.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="py-2 pr-3 whitespace-nowrap text-neutral-500">{when(r.created_at)}</td>
                <td className="py-2 pr-3">
                  <div>{nameOf(r)}</div>
                  <div className="text-xs text-neutral-500">{r.email ?? `guest · ${r.device_id.slice(0, 8)}`}</div>
                </td>
                {FINAL_QUESTIONS.map((q) => {
                  // card picks: the drawing next to its name (from the answerer's saved cards)
                  const cardId = q.kind === 'card' ? (r.answers[`${q.id}_card`] as string | undefined) : undefined
                  const img = cardId && r.user_id ? rows.find((x) => x.user_id === r.user_id)?.state.cards[cardId]?.image : undefined
                  return (
                    <td key={q.id} className="py-2 pr-3">
                      {img && <img src={img} alt="" className="mb-1 h-[64px] w-[45px] rounded border border-neutral-200 bg-white object-contain" />}
                      {show(r, q.id)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {latest.length === 0 && <p className="mt-4 text-neutral-500">No answers yet.</p>}
      </div>
    </div>
  )
}
