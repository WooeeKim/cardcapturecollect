import { useState } from 'react'
import bubble from '../assets/proto/interview/start-bubble.svg'
import pill from '../assets/proto/interview/pill.svg'
import sheet from '../assets/proto/interview/sheet.svg'
import { FINAL_QUESTIONS, OTHER, done, type FinalAnswers, type FinalQuestion } from '../lib/finalInterview'
import { tr, useLang } from '../lib/i18n'
import { COL_X, useWide } from '../lib/wide'

// Day-7 post-test interview in the 10 p.m. interview's look (InterviewOverlay): start bubble → one question per
// memo sheet (the pad thins out to 2 → 1 sheets at the end, a finished sheet slides up and away) → thank-you
// bubble. No close; optional questions can be left empty. Questions: lib/finalInterview.ts.

const SHEETS = [
  { left: 21, top: 234 },
  { left: 14, top: 226 },
  { left: 7, top: 217 },
]
const MAX = 400
const FLIP_MS = 520

function Pill({ label, top, onClick, disabled = false, wide = false }: { label: string; top: number; onClick: () => void; disabled?: boolean; wide?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`absolute left-1/2 flex h-[44px] -translate-x-1/2 items-center justify-center transition-opacity ${disabled ? 'opacity-40' : ''}`}
      style={{ top, width: wide ? 130 : 96.15 }}
    >
      <img src={pill} alt="" className="absolute inset-0 size-full max-w-none" />
      <span className="relative text-[18px] leading-[normal]">{label}</span>
    </button>
  )
}

type Step = 'start' | number | 'thanks'

export default function FinalInterviewOverlay({ onSubmit, onClose }: { onSubmit: (a: FinalAnswers) => Promise<void> | void; onClose: () => void }) {
  const lang = useLang()
  const wide = useWide()
  const say = (x: { ko: string; en: string }) => (lang === 'en' ? x.en : x.ko)
  const [step, setStep] = useState<Step>('start')
  const [a, setA] = useState<FinalAnswers>({})
  const [leaving, setLeaving] = useState<{ q: FinalQuestion; idx: number; pad: number } | null>(null)

  // questions asked with the answers so far (follow_why only after "네")
  const qs = FINAL_QUESTIONS.filter((q) => !q.when || q.when(a))
  const idx = typeof step === 'number' ? step : -1
  const padAt = (i: number) => Math.min(3, qs.length - i)
  const pad = idx >= 0 ? padAt(idx) : 0
  const bottom = pad ? SHEETS[pad - 1].top + 426 : 0

  const setText = (id: string, v: string) => setA((x) => ({ ...x, [id]: v.slice(0, MAX) }))
  const pickOne = (id: string, v: string) => setA((x) => ({ ...x, [id]: v }))
  const toggle = (q: FinalQuestion, v: string) =>
    setA((x) => {
      const list = Array.isArray(x[q.id]) ? (x[q.id] as string[]) : []
      if (list.includes(v)) return { ...x, [q.id]: list.filter((y) => y !== v) }
      if (q.exactly && list.length >= q.exactly) return { ...x, [q.id]: [...list.slice(1), v] } // keep the newest picks
      return { ...x, [q.id]: [...list, v] }
    })

  async function finish(all: FinalAnswers) {
    // only what was asked, trimmed; "기타" text kept only when 기타 is picked
    const out: FinalAnswers = {}
    for (const q of FINAL_QUESTIONS.filter((q) => !q.when || q.when(all))) {
      const v = all[q.id]
      if (Array.isArray(v) ? v.length : typeof v === 'string' && v.trim()) out[q.id] = Array.isArray(v) ? v : v!.trim()
      const other = String(all[`${q.id}_other`] ?? '').trim()
      if (Array.isArray(v) && v.includes(OTHER) && other) out[`${q.id}_other`] = other
    }
    await onSubmit(out)
  }

  function next() {
    if (leaving || idx < 0) return
    const q = qs[idx]
    if (!done(q, a)) return
    setLeaving({ q, idx, pad })
    const last = idx >= qs.length - 1
    setStep(last ? 'thanks' : idx + 1)
    if (last) finish(a)
    setTimeout(() => setLeaving(null), FLIP_MS)
  }

  const choice = (on: boolean, label: string, onClick: () => void, live: boolean) => (
    <button
      key={label}
      onClick={onClick}
      aria-pressed={on}
      tabIndex={live ? undefined : -1}
      className={`min-h-[33px] w-full shrink-0 rounded-[8px] border-[1.6px] border-[#2e2e2e] px-[11px] py-[5px] text-left text-[16px] leading-[1.15] ${on ? 'bg-[#2e2e2e] text-white' : 'bg-white text-black'}`}
    >
      {label}
    </button>
  )

  // one question on its sheet; `live` = false for the copy sliding away
  const page = (q: FinalQuestion, i: number, p: number, live: boolean) => {
    const ro = live ? {} : { readOnly: true, tabIndex: -1 }
    const top = SHEETS[p - 1].top
    const v = a[q.id]
    const list = Array.isArray(v) ? v : []
    return (
      <div className="absolute left-[47px] flex w-[310px] flex-col" style={{ top: top + 22, height: 426 - 22 - 30 }}>
        <p className="text-[14px] leading-none text-[#8e8e8e]">
          {i + 1} / {qs.length}
          {q.optional ? ` · ${tr('optional')}` : ''}
          {q.exactly ? ` · ${tr('pick {n}', { n: q.exactly })}` : ''}
        </p>
        <p className="mt-[8px] shrink-0 text-[22px] leading-[1.2] whitespace-pre-line">{say(q.prompt)}</p>
        <div className="mt-[12px] flex min-h-0 flex-1 flex-col gap-[5px] overflow-y-auto pb-[4px] [scrollbar-width:none]">
          {(q.kind === 'short' || q.kind === 'long') && (
            <textarea
              value={(v as string) ?? ''}
              onChange={(e) => setText(q.id, e.target.value)}
              placeholder={tr('A line or two is plenty')}
              aria-label={say(q.prompt)}
              rows={q.kind === 'short' ? 1 : 4}
              className="w-[298px] shrink-0 resize-none rounded-[8px] border-2 border-dashed border-[#555] bg-white px-[11px] py-[7px] text-[19px] leading-[1.25] outline-none placeholder:text-[#9a9a9a]"
              {...ro}
            />
          )}
          {q.kind === 'one' && q.choices!.map((c) => choice(v === c.ko, say(c), () => pickOne(q.id, c.ko), live))}
          {q.kind === 'many' && q.choices!.map((c) => choice(list.includes(c.ko), say(c), () => toggle(q, c.ko), live))}
          {q.kind === 'many' && q.other && (
            <input
              value={String(a[`${q.id}_other`] ?? '')}
              onChange={(e) => {
                const t = e.target.value.slice(0, MAX)
                // typing here picks 기타; clearing it un-picks it
                setA((x) => {
                  const cur = Array.isArray(x[q.id]) ? (x[q.id] as string[]) : []
                  const has = cur.includes(OTHER)
                  return { ...x, [`${q.id}_other`]: t, [q.id]: t.trim() ? (has ? cur : [...cur, OTHER]) : cur.filter((y) => y !== OTHER) }
                })
              }}
              placeholder={tr('Other (write it here)')}
              aria-label={tr('Other (write it here)')}
              className={`min-h-[33px] w-full shrink-0 rounded-[8px] border-[1.6px] bg-white px-[11px] text-[16px] outline-none placeholder:text-[#9a9a9a] ${list.includes(OTHER) ? 'border-solid border-[#2e2e2e]' : 'border-dashed border-[#555]'}`}
              {...ro}
            />
          )}
        </div>
      </div>
    )
  }

  const sheetImg = (i: number) => (
    <img key={i} src={sheet} alt="" className="absolute h-[428px] w-[370px] max-w-none" style={{ left: SHEETS[i].left - 1, top: SHEETS[i].top - 1 }} />
  )

  const bubbleWith = (lines: string[], label: string, onClick: () => void) => (
    <div key={label} className="animate-pop-in">
      <img src={bubble} alt="" className="absolute top-[353px] left-[73px] h-[122px] w-[257px] max-w-none" />
      <p className="absolute top-[380px] left-1/2 w-[240px] -translate-x-1/2 text-center text-[23px] leading-[1.15]">
        {lines.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </p>
      <Pill label={label} top={452} onClick={onClick} wide={label.length > 4} />
    </div>
  )

  const q = idx >= 0 ? qs[idx] : null
  return (
    <div role="dialog" aria-modal className="animate-fade-in absolute inset-0 z-[60] overflow-hidden bg-black/35 font-hand backdrop-blur-[1px]">
      <div className={`absolute top-0 h-[874px] origin-center ${wide ? 'w-[402px]' : 'inset-x-0'}`} style={{ left: wide ? COL_X : undefined, transform: 'translateY(calc(var(--cut) * -0.5px)) scale(var(--interview-scale))' }}>
        {step === 'start' && bubbleWith([tr('Last interview!'), tr('Let’s look back on 7 days.')], tr('Start'), () => setStep(0))}
        {step === 'thanks' && !leaving && bubbleWith([tr('Thank you for'), tr('these 7 days!')], tr('Close'), onClose)}
        {q && (
          <div className="animate-pop-in">
            {SHEETS.slice(0, pad).map((_, i) => sheetImg(i))}
            {page(q, idx, pad, true)}
            <Pill label={idx === qs.length - 1 ? tr('Done') : q.optional && !String(a[q.id] ?? '').trim() ? tr('Skip') : tr('Next')} top={bottom - 22} disabled={!done(q, a)} onClick={next} />
          </div>
        )}
        {leaving && (
          <div key={leaving.idx} aria-hidden className="animate-sheet-away pointer-events-none absolute inset-0">
            {sheetImg(leaving.pad - 1)}
            {page(leaving.q, leaving.idx, leaving.pad, false)}
          </div>
        )}
      </div>
    </div>
  )
}
