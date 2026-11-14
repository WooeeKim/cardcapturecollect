import { useState } from 'react'
import { LoginSheet } from '../components/LoginSheet'
import { Bottom, TextButton } from '../components/ui'
import { PillBack, PillFinish } from '../components/v2'
import type { User } from '../lib/auth'
import { QUESTIONS, TYPES, answered, submit, type Answer, type Answers, type Result, type TypeId } from '../lib/gilbti'

// 길BTI (Subway-TI) pre-interview: intro → one question per page → result (the 2×2 persona).
// Shown on first launch (before the town) and from My Page. Monotone, hand-drawn like the rest of the app.

const field = 'w-full rounded-[8px] border-[2px] border-dashed border-[#555] bg-white px-[12px] text-[20px] outline-none placeholder:text-[#9a9a9a]'

function Pill({ label, onClick, back = false, off = false }: { label: string; onClick: () => void; back?: boolean; off?: boolean }) {
  return (
    <button onClick={onClick} aria-disabled={off || undefined} className={`relative flex h-[54px] w-[118px] items-center justify-center ${off ? 'opacity-35' : ''}`}>
      <span className={`absolute inset-0 ${back ? 'rotate-[-178.73deg]' : 'rotate-[-177.79deg]'}`}>{back ? <PillFinish /> : <PillBack />}</span>
      <span className={`relative text-[22px] leading-[1.1] ${back ? 'text-[#686868]' : ''}`}>{label}</span>
    </button>
  )
}

export function TypeGrid({ type }: { type: TypeId }) {
  const cells: { id: TypeId; row: 0 | 1; col: 0 | 1 }[] = [
    { id: 'both', row: 0, col: 0 },
    { id: 'record', row: 0, col: 1 },
    { id: 'observe', row: 1, col: 0 },
    { id: 'neither', row: 1, col: 1 },
  ]
  return (
    <div className="grid grid-cols-[64px_1fr_1fr] grid-rows-[28px_1fr_1fr] gap-[4px] text-[14px] leading-[1.15]">
      <span />
      <span className="self-end text-center text-[#6b6b6b]">Likes observing</span>
      <span className="self-end text-center text-[#6b6b6b]">Not into it</span>
      {cells.map((c) => (
        <div key={c.id} className="contents">
          {c.col === 0 && <span className="self-center text-right text-[#6b6b6b]">{c.row === 0 ? 'Likes recording' : 'Not into recording'}</span>}
          <span
            className={`flex h-[64px] items-center justify-center rounded-[8px] border-[2px] px-[6px] text-center text-[16px] ${
              c.id === type ? 'border-[#2e2e2e] bg-[#2e2e2e] text-white' : 'border-dashed border-[#b5b5b5] text-[#9a9a9a]'
            }`}
          >
            {TYPES[c.id].name}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function GilbtiScreen({
  user,
  later,
  onDone,
  onLater,
  onLogin,
}: {
  user: User | null
  later: string // "Later" on first launch, "Close" from My Page
  onDone: (r: Result) => void
  onLater: () => void
  onLogin: (u: User) => void
}) {
  const [step, setStep] = useState(-1) // -1 intro, 0..n-1 questions, n result
  const [answers, setAnswers] = useState<Answers>({})
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [login, setLogin] = useState(false)
  const n = QUESTIONS.length

  const set = (id: string, a: Answer) => setAnswers((s) => ({ ...s, [id]: a }))

  async function next() {
    if (step < n - 1) return setStep(step + 1)
    setBusy(true)
    const r = await submit(answers, user)
    setBusy(false)
    setResult(r)
    setStep(n)
  }

  // ---------- intro ----------
  if (step === -1)
    return (
      <div className="animate-fade-in relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
        <div className="absolute inset-x-[36px] top-[180px]">
          <p className="text-[18px] text-[#7a7a7a]">Before you start</p>
          <h1 className="mt-[6px] text-[44px] leading-[1.05]">Subway-TI</h1>
          <p className="mt-[22px] text-[22px] leading-[1.35] text-[#3d3d3d]">
            A few quick questions about how you ride, watch and record.
            <br />
            About 2 minutes.
          </p>
          <p className="mt-[18px] text-[16px] leading-[1.35] text-[#8a8a8a]">Only our team sees your answers. They help us understand who uses the app.</p>
        </div>
        <Bottom>
          <div className="absolute top-[730px] inset-x-0 flex flex-col items-center gap-[22px]">
            <Pill label="Start" onClick={() => setStep(0)} />
            <TextButton dim className="text-[19px]" onClick={onLater}>
              {later}
            </TextButton>
          </div>
        </Bottom>
      </div>
    )

  // ---------- result ----------
  if (step === n && result)
    return (
      <div className="animate-fade-in relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
        <div className="absolute inset-x-[30px] top-[120px]">
          <p className="text-[18px] text-[#7a7a7a]">Your Subway-TI</p>
          <h1 className="animate-pop-in mt-[4px] text-[38px] leading-[1.1]">{TYPES[result.type].name}</h1>
          <p className="mt-[10px] text-[19px] leading-[1.35] text-[#3d3d3d]">{TYPES[result.type].line}</p>
          <div className="mt-[28px]">
            <TypeGrid type={result.type} />
          </div>
          {!user && <p className="mt-[24px] text-[16px] leading-[1.35] text-[#8a8a8a]">Log in so your answers stay with your account and cards.</p>}
        </div>
        <Bottom>
          <div className="absolute top-[730px] inset-x-0 flex flex-col items-center gap-[22px]">
            <Pill label="Let's go" onClick={() => onDone(result)} />
            {!user && (
              <TextButton dim className="text-[19px]" onClick={() => setLogin(true)}>
                Log in/Sign up
              </TextButton>
            )}
          </div>
        </Bottom>
        {login && (
          <LoginSheet
            onClose={() => setLogin(false)}
            onDone={(u) => {
              setLogin(false)
              onDone(result) // nickname lands in the guest town first, then joins the account
              onLogin(u)
            }}
          />
        )}
      </div>
    )

  // ---------- one question ----------
  const q = QUESTIONS[step]
  const a = answers[q.id]
  const ok = answered(q, a)
  // single picks move on by themselves
  const pickAndGo = (v: Answer) => {
    set(q.id, v)
    if (step < n - 1) setTimeout(() => setStep((s) => (s === step ? s + 1 : s)), 260)
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <div className="absolute inset-x-[30px] top-[84px]">
        <div className="flex items-baseline justify-between text-[16px] text-[#7a7a7a]">
          <span>{q.section}</span>
          <span>
            {step + 1} / {n}
          </span>
        </div>
        <div className="mt-[8px] flex gap-[4px]">
          {QUESTIONS.map((_, i) => (
            <span key={i} className={`h-[4px] flex-1 rounded-full ${i <= step ? 'bg-[#2e2e2e]' : 'bg-[#d6d6d6]'}`} />
          ))}
        </div>
      </div>

      <div key={q.id} className="animate-fade-in absolute inset-x-[30px] top-[150px] bottom-[126px] overflow-y-auto [scrollbar-width:none]">
        <p className="text-[28px] leading-[1.2]">{q.prompt}</p>
        {q.kind === 'many' && <p className="mt-[6px] text-[15px] text-[#8a8a8a]">Pick all that fit</p>}

        <div className="mt-[24px] flex flex-col gap-[10px] pb-[16px]">
          {(q.kind === 'one' || q.kind === 'many') &&
            q.choices.map((c) => {
              const on = q.kind === 'one' ? a === c : Array.isArray(a) && a.includes(c)
              return (
                <button
                  key={c}
                  aria-pressed={on}
                  onClick={() => {
                    if (q.kind === 'one') return pickAndGo(c)
                    const list = Array.isArray(a) ? a : []
                    set(q.id, on ? list.filter((x) => x !== c) : [...list, c])
                  }}
                  className={`flex min-h-[52px] items-center rounded-[10px] border-[2px] px-[16px] text-left text-[21px] leading-[1.2] transition-colors ${
                    on ? 'border-[#2e2e2e] bg-[#2e2e2e] text-white' : 'border-[#2e2e2e] bg-white'
                  }`}
                >
                  {c}
                </button>
              )
            })}

          {q.kind === 'scale' && (
            <div>
              <div className="flex justify-between">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    aria-label={`${v} of 5`}
                    aria-pressed={a === v}
                    onClick={() => pickAndGo(v)}
                    className={`flex size-[56px] items-center justify-center rounded-full border-[2px] border-[#2e2e2e] text-[22px] transition-colors ${a === v ? 'bg-[#2e2e2e] text-white' : 'bg-white'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="mt-[10px] flex justify-between text-[16px] text-[#6b6b6b]">
                <span>{q.low}</span>
                <span>{q.high}</span>
              </div>
            </div>
          )}

          {q.kind === 'text' &&
            (q.long ? (
              <textarea
                autoFocus
                rows={4}
                maxLength={300}
                value={typeof a === 'string' ? a : ''}
                onChange={(e) => set(q.id, e.target.value)}
                placeholder={q.placeholder}
                aria-label={q.prompt}
                className={`${field} resize-none py-[8px] leading-[1.3]`}
              />
            ) : (
              <input
                autoFocus
                maxLength={20}
                value={typeof a === 'string' ? a : ''}
                onChange={(e) => set(q.id, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && next()}
                placeholder={q.placeholder}
                aria-label={q.prompt}
                className={`${field} h-[50px]`}
              />
            ))}
        </div>
      </div>

      <Bottom>
        <div className="absolute top-[760px] inset-x-[30px] flex justify-between">
          <Pill back label="Back" onClick={() => setStep(step - 1)} />
          <Pill
            label={busy ? '…' : step === n - 1 ? 'Done' : q.kind === 'text' && q.optional && !(typeof a === 'string' && a.trim()) ? 'Skip' : 'Next'}
            off={!ok || busy}
            onClick={() => ok && !busy && next()}
          />
        </div>
      </Bottom>
    </div>
  )
}
