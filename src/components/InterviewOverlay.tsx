import { useState } from 'react'
import bubble from '../assets/proto/interview/start-bubble.svg'
import pill from '../assets/proto/interview/pill.svg'
import sheet from '../assets/proto/interview/sheet.svg'
import { FEELINGS, type Answers, type Kind } from '../lib/interview'
import { tr } from '../lib/i18n'

// Figma UX › 08 매일 20시 인터뷰: "8pm interview - start" → "if didn't draw" (no card today)
// or "1, 2, 3" (made a card). A pad of memo sheets over the dimmed app: 3 sheets left → 2 → 1.
// No close: it stays until answered (Next / Done hang off the top sheet like the Start pill on the bubble).

// sheet positions in Figma frame px (sheet.svg is the 368×426 box + its 1px stroke all round)
const SHEETS = [
  { left: 21, top: 234 },
  { left: 14, top: 226 },
  { left: 7, top: 217 },
]
const MAX = 300

type Step = 'start' | 'didnt' | 'q1' | 'q2' | 'q3' | 'end'
const FLIP_MS = 520

function Pill({ label, top, onClick, disabled = false }: { label: string; top: number; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`absolute left-1/2 flex h-[44px] w-[96.15px] -translate-x-1/2 items-center justify-center transition-opacity ${disabled ? 'opacity-40' : ''}`}
      style={{ top }}
    >
      <img src={pill} alt="" className="absolute inset-0 size-full max-w-none" />
      <span className="relative text-[18px] leading-[normal]">{label}</span>
    </button>
  )
}

const field = 'absolute left-[47px] w-[298px] resize-none rounded-[8px] border-2 border-dashed border-[#555] bg-white px-[11px] py-[7px] text-[20px] leading-[1.25] outline-none placeholder:text-[#9a9a9a]'

export default function InterviewOverlay({ kind, onDone }: { kind: Kind; onDone: (answers: Answers) => Promise<void> | void }) {
  const [step, setStep] = useState<Step>('start')
  const [a, setA] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setA((x) => ({ ...x, [k]: v.slice(0, MAX) }))
  const filled = (k: string) => !!a[k]?.trim()

  async function finish() {
    if (busy) return
    setBusy(true)
    const out: Answers = {}
    for (const [k, v] of Object.entries(a)) if (v.trim()) out[k] = v.trim()
    if (out.feeling !== 'Other') delete out.feeling_other
    await onDone(out)
  }

  // sheets left on the pad for each step ('end' = the last one has flipped away)
  const padOf = (x: Step) => (x === 'end' ? 0 : x === 'q3' ? 1 : x === 'q2' ? 2 : 3)
  const pad = padOf(step)
  const bottom = pad ? SHEETS[pad - 1].top + 426 : 0

  // Next / Done: the written sheet slides up and fades away; the next question is already
  // on the sheet underneath. After the last one, the answers are sent.
  const [leaving, setLeaving] = useState<Step | null>(null)
  function turn(next: Step) {
    if (leaving) return
    setLeaving(step)
    setStep(next)
    setTimeout(() => {
      setLeaving(null)
      if (next === 'end') finish()
    }, FLIP_MS)
  }

  // one sheet's question + answer fields; `live` = false for the copy that is flipping away
  const page = (x: Step, live: boolean) => {
    const ro = live ? {} : { readOnly: true, tabIndex: -1 }
    const text = (k: string, prompt: string, top: number) => (
      <>
        <p className="absolute top-[261px] left-[47px] w-[298px] text-[24px] leading-[1.2]">{prompt}</p>
        <textarea
          value={a[k] ?? ''}
          onChange={(e) => set(k, e.target.value)}
          placeholder={tr('A line or two is plenty')}
          aria-label={prompt}
          className={field}
          style={{ top, height: 120 }}
          {...ro}
        />
      </>
    )
    if (x === 'didnt') return text('why_not', tr('Why didn’t you draw today?'), 310)
    if (x === 'q1') return text('situation', tr('In what situation did you collect?'), 334)
    if (x === 'q2') return text('who_why', tr('Who did you collect, and why?'), 310)
    if (x !== 'q3') return null
    return (
      <>
        <p className="absolute top-[261px] left-[47px] w-[308px] text-[24px] leading-[1.2] whitespace-pre-line">{tr('How did you feel\nwhile collecting them?')}</p>
        {FEELINGS.map((f, i) => {
          const on = a.feeling === f
          return (
            <button
              key={f}
              onClick={() => set('feeling', f)}
              aria-pressed={on}
              tabIndex={live ? undefined : -1}
              className={`absolute left-[47px] h-[46.8px] w-[307.8px] rounded-[9px] border-[1.8px] border-[#2e2e2e] px-[12.6px] text-left text-[18.9px] ${on ? 'bg-[#2e2e2e] text-white' : 'bg-white text-black'}`}
              style={{ top: 340 + i * 55.8 }}
            >
              {tr(f)}
            </button>
          )
        })}
        <input
          value={a.feeling_other ?? ''}
          onChange={(e) => {
            const v = e.target.value.slice(0, MAX)
            // typing here picks "Other"; clearing it un-picks it
            setA((y) => ({ ...y, feeling_other: v, feeling: v.trim() ? 'Other' : y.feeling === 'Other' ? '' : (y.feeling ?? '') }))
          }}
          onFocus={() => a.feeling_other?.trim() && set('feeling', 'Other')}
          placeholder={tr('Other feelings...')}
          aria-label={tr('Other feelings...')}
          className={`absolute top-[563px] left-[48px] h-[44.9px] w-[307px] rounded-[7.2px] border-[1.8px] bg-white px-[12.2px] text-[18px] outline-none placeholder:text-[#9a9a9a] ${a.feeling === 'Other' ? 'border-solid border-[#2e2e2e]' : 'border-dashed border-[#555]'}`}
          {...ro}
        />
      </>
    )
  }

  const sheetImg = (i: number) => (
    <img key={i} src={sheet} alt="" className="absolute h-[428px] w-[370px] max-w-none" style={{ left: SHEETS[i].left - 1, top: SHEETS[i].top - 1 }} />
  )

  return (
    <div role="dialog" aria-modal className="animate-fade-in absolute inset-0 z-[60] overflow-hidden bg-black/35 font-hand backdrop-blur-[1px]">
      {/* Figma frame px, kept centred when the phone is shorter than 874. --interview-scale (index.css): full size on
          phones; 90% in the desktop preview, whose fake phone frame covers the outer 13px */}
      <div className="absolute top-0 left-[calc(50%-201px)] h-[874px] w-[402px] origin-center" style={{ transform: 'translateY(calc(var(--cut) * -0.5px)) scale(var(--interview-scale))' }}>
        {step === 'start' ? (
          <div className="animate-pop-in">
            <img src={bubble} alt="" className="absolute top-[353px] left-[73px] h-[122px] w-[257px] max-w-none" />
            <p className="absolute top-[382px] left-1/2 -translate-x-1/2 text-center text-[27px] leading-[1.1] tracking-[-0.27px] whitespace-nowrap">
              {tr('It’s 8p.m.')}
              <br />
              {tr('Interview Time!')}
            </p>
            <Pill label={tr('Start')} top={452} onClick={() => setStep(kind === 'drew' ? 'q1' : 'didnt')} />
          </div>
        ) : (
          <>
            {/* the pad: remaining sheets, the current question on top */}
            <div className="animate-pop-in">
              {SHEETS.slice(0, pad).map((_, i) => sheetImg(i))}
              {page(step, true)}
              {step === 'didnt' && <Pill label={tr('Done')} top={bottom - 22} disabled={!filled('why_not') || busy} onClick={() => turn('end')} />}
              {step === 'q1' && <Pill label={tr('Next')} top={bottom - 22} disabled={!filled('situation')} onClick={() => turn('q2')} />}
              {step === 'q2' && <Pill label={tr('Next')} top={bottom - 22} disabled={!filled('who_why')} onClick={() => turn('q3')} />}
              {step === 'q3' && <Pill label={tr('Done')} top={bottom - 22} disabled={!filled('feeling') || busy} onClick={() => turn('end')} />}
            </div>
            {/* the written sheet, sliding up and away */}
            {leaving && (
              <div key={leaving} aria-hidden className="animate-sheet-away pointer-events-none absolute inset-0">
                {sheetImg(padOf(leaving) - 1)}
                {page(leaving, false)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
