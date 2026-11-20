import { useMemo, useState } from 'react'
import FinalInterviewOverlay from '../components/FinalInterviewOverlay'
import { FINAL_QUESTIONS, type FinalAnswers } from '../lib/finalInterview'
import type { Card } from '../lib/store'
import { who, type Row } from './data'

// 7일차 인터뷰 시뮬레이터: the day-7 interview exactly as testers will get it, in a phone frame, for the team to
// click through. Nothing is saved; the answers it would send show on the right. The card questions use the
// cards of whoever is picked in "카드 가져올 사람".
export function FinalSimulator({ rows }: { rows: Row[] }) {
  const people = useMemo(() => rows.filter((r) => Object.keys(r.state.cards).length > 0).sort((a, b) => Object.keys(b.state.cards).length - Object.keys(a.state.cards).length), [rows])
  const [owner, setOwner] = useState<string>('')
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<FinalAnswers | null>(null)
  const [ended, setEnded] = useState(false)

  const row = people.find((r) => r.user_id === owner) ?? people[0]
  const cards: Card[] = row ? Object.values(row.state.cards).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []

  const restart = () => {
    setResult(null)
    setEnded(false)
    setRun((n) => n + 1)
  }

  return (
    <div className="flex flex-wrap items-start gap-8">
      {/* the phone: same 402×874 frame px as the app, shown at 80% */}
      <div className="shrink-0" style={{ width: 422 * 0.8, height: 894 * 0.8 }}>
        <div
          className="relative overflow-hidden rounded-[48px] border-[10px] border-black bg-[#c9c9c9] font-hand"
          style={{ width: 402, height: 874, boxSizing: 'content-box', transform: 'scale(0.8)', transformOrigin: 'top left', '--cut': 0, '--interview-scale': 1 } as React.CSSProperties}
        >
          {!ended ? (
            <FinalInterviewOverlay key={`${run}:${row?.user_id ?? ''}`} cards={cards} onSubmit={(a) => setResult(a)} onClose={() => setEnded(true)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-[22px]">
              <p>인터뷰 끝!</p>
              <button className="rounded-full border-2 border-black bg-white px-6 py-2 text-[18px]" onClick={restart}>
                처음부터 다시
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="min-w-[280px] flex-1 space-y-4 text-sm">
        <div>
          <h2 className="mb-1 text-lg">7일차 인터뷰 시뮬레이터</h2>
          <p className="text-neutral-600">테스터가 받게 될 7일차 인터뷰를 그대로 눌러볼 수 있어요. 답은 저장되지 않아요.</p>
        </div>
        <label className="flex flex-wrap items-center gap-2">
          <span className="text-neutral-500">카드 가져올 사람</span>
          <select className="rounded border px-2 py-1" value={row?.user_id ?? ''} onChange={(e) => (setOwner(e.target.value), restart())}>
            {people.map((r) => (
              <option key={r.user_id} value={r.user_id}>
                {who(r)} · 카드 {Object.keys(r.state.cards).length}장
              </option>
            ))}
          </select>
          {!people.length && <span className="text-neutral-500">카드가 있는 사람이 없어요 (카드 질문은 건너뛸 수 있게 나와요)</span>}
        </label>
        <button className="underline" onClick={restart}>
          처음부터 다시
        </button>

        <div>
          <h3 className="mb-1 font-medium">보내질 답 (저장 안 됨)</h3>
          {!result ? (
            <p className="text-neutral-500">끝까지 답하면 여기에 보여요.</p>
          ) : (
            <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1">
              {FINAL_QUESTIONS.filter((q) => result[q.id] !== undefined).map((q) => {
                const v = result[q.id]
                const other = result[`${q.id}_other`]
                return (
                  <div key={q.id} className="contents">
                    <dt className="whitespace-pre-line text-neutral-500">{q.prompt.ko}</dt>
                    <dd>
                      {Array.isArray(v) ? v.join(', ') : v}
                      {other ? ` (${other})` : ''}
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}
