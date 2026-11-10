import { useEffect, useMemo, useRef, useState } from 'react'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import { BackIcon, CardView, CheckIcon, Popup, type PopupAction } from '../components/ui'
import { MOODS } from '../lib/moods'
import { locatePlace } from '../lib/place'
import { wobblyCircle, wobblyLine, wobblyPoly } from '../lib/sketch'
import type { Card } from '../lib/store'

// Figma wireframe 그리기: Draw | Write tabs, guide toggle, pencil · highlighter · eraser, undo/redo, color.
const COLORS = ['#000000', '#7a766c', '#ffffff', '#c0392b', '#e67e22', '#f1c40f', '#469015', '#2e86de', '#8e44ad', '#c584c0']
const SIZES = [2, 4, 8, 14, 22]

type Draft = Omit<Card, 'id' | 'createdAt' | 'serial'>

export default function DrawScreen({ onExit, onFinish }: { onExit: () => void; onFinish: (draft: Draft) => void }) {
  const canvas = useRef<DrawingCanvasHandle>(null)
  const [tab, setTab] = useState<'draw' | 'write'>('draw')
  const [tool, setTool] = useState<Tool>('pen')
  const [size, setSize] = useState(4)
  const [color, setColor] = useState('#000000')
  const [guide, setGuide] = useState(true)
  const [open, setOpen] = useState<'size' | 'color' | null>(null)
  const [empty, setEmpty] = useState(true)
  const [mood, setMood] = useState('')
  const [place, setPlace] = useState('')
  const [nickname, setNickname] = useState('')
  const [memo, setMemo] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const typedPlace = useRef(false)
  const art = useMemo(drawArt, [])

  useEffect(() => {
    locatePlace().then((p) => {
      if (p && !typedPlace.current) setPlace(p)
    })
  }, [])

  const draft = (image: string): Draft => ({ image, mood, place: place.trim(), nickname: nickname.trim(), memo: memo.trim() })

  function back() {
    if (empty && !nickname && !memo && !mood) return onExit()
    setPopup({
      message: 'Discard this drawing?',
      actions: [
        { label: 'Discard', onClick: onExit },
        { label: 'Cancel', onClick: () => setPopup(null) },
      ],
    })
  }

  async function check() {
    if (canvas.current?.isEmpty()) {
      return setPopup({ message: 'Draw at least one line first.', actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
    }
    setPreview(await toDataUrl(await canvas.current!.toBlob()))
  }

  function pickTool(t: Tool) {
    if (tool === t) setOpen(open === 'size' ? null : 'size')
    else {
      setTool(t)
      setOpen(null)
    }
  }

  const toolX = { pen: 48, highlighter: 112, eraser: 178 }

  return (
    <div className="relative h-full overflow-hidden bg-white font-hand">
      {/* header */}
      <button aria-label="Back" onClick={back} className="absolute left-[18px] z-10 p-[6px]" style={{ top: 'calc(var(--top) + 8px)' }}>
        <BackIcon />
      </button>
      <div className="absolute inset-x-0 flex justify-center gap-[22px] text-[24px]" style={{ top: 'calc(var(--top) + 10px)' }}>
        {(['draw', 'write'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setOpen(null) }} aria-pressed={tab === t} className="relative px-[4px] pb-[6px]">
            {t === 'draw' ? 'Draw' : 'Write'}
            {tab === t && (
              <svg viewBox="0 0 60 8" className="absolute inset-x-0 bottom-0 h-[8px] w-full overflow-visible" preserveAspectRatio="none" aria-hidden>
                <path d={art.underline} transform="translate(0 4)" fill="none" stroke="#000" strokeWidth={1.6} strokeLinecap="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <button aria-label="Finish card" onClick={check} className="absolute right-[18px] z-10 p-[4px]" style={{ top: 'calc(var(--top) + 4px)' }}>
        <CheckIcon />
      </button>

      {/* canvas */}
      <div className="absolute inset-x-[32px] overflow-hidden rounded-[10px] bg-[#f0f0f0]" style={{ top: 'calc(var(--top) + 64px)', bottom: 220 }}>
        <DrawingCanvas ref={canvas} tool={tool} color={color} size={size} guide={guide && tab === 'draw'} onChange={() => setEmpty(!!canvas.current?.isEmpty())} />
        {empty && tab === 'draw' && <p className="pointer-events-none absolute inset-x-0 top-[42%] text-center text-[24px]">A few lines will do!</p>}

        {tab === 'write' && (
          <div className="absolute inset-0 flex flex-col gap-[14px] bg-white/60 p-[12px] backdrop-blur-[1px]">
            <div className="flex items-center justify-between gap-[8px]">
              <span className="rounded-[6px] border-[1.5px] border-dashed border-[#777] bg-white/70 px-[8px] py-[2px] text-[18px]">Mood</span>
              <input
                value={place}
                onChange={(e) => {
                  typedPlace.current = true
                  setPlace(e.target.value)
                }}
                placeholder="Where are you?"
                maxLength={30}
                aria-label="Place"
                className="min-w-0 rounded-[6px] border-[1.5px] border-dashed border-[#777] bg-white/70 px-[8px] py-[2px] text-right text-[16px] outline-none placeholder:text-[#999]"
              />
            </div>
            <div className="grid grid-cols-3 gap-[8px]">
              {MOODS.map((m) => {
                const on = mood === m.name
                return (
                  <button
                    key={m.name}
                    aria-pressed={on}
                    onClick={() => setMood(on ? '' : m.name)}
                    className="rounded-full py-[7px] text-[18px] transition-transform active:scale-95"
                    style={{ background: on ? m.color : '#ffffffcc', color: on ? m.ink : '#000', boxShadow: on ? 'none' : `inset 0 0 0 2px ${m.color}` }}
                  >
                    {m.name}
                  </button>
                )
              })}
            </div>
            <div className="mt-auto flex flex-col gap-[8px] rounded-[10px] bg-white/80 p-[10px]">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname"
                maxLength={24}
                aria-label="Nickname"
                className="w-[60%] rounded-[6px] border-[1.5px] border-dashed border-[#777] bg-transparent px-[8px] py-[2px] text-[18px] outline-none placeholder:text-[#777]"
              />
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Save the moment."
                maxLength={180}
                rows={4}
                aria-label="Memo"
                className="resize-none rounded-[6px] border-[1.5px] border-dashed border-[#777] bg-transparent px-[8px] py-[6px] text-[16px] leading-[1.25] outline-none placeholder:text-[#777]"
              />
            </div>
          </div>
        )}
      </div>

      {/* guide toggle */}
      {tab === 'draw' && (
        <button onClick={() => setGuide(!guide)} aria-pressed={guide} className="absolute left-[22px] flex items-center gap-[8px] text-[19px]" style={{ bottom: 186 }}>
          Guide
          <span className="relative h-[20px] w-[38px] rounded-full border-[1.8px] border-black">
            <span className={`absolute top-[2px] size-[12px] rounded-full bg-black transition-[left] duration-200 ${guide ? 'left-[20px]' : 'left-[3px]'}`} />
          </span>
        </button>
      )}

      {/* toolbar */}
      {tab === 'draw' && (
        <div className="absolute inset-x-0 bottom-0 h-[130px]" onPointerDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          {(['pen', 'highlighter', 'eraser'] as const).map((t) => (
            <button
              key={t}
              aria-label={t === 'pen' ? 'Pencil' : t === 'highlighter' ? 'Highlighter' : 'Eraser'}
              aria-pressed={tool === t}
              onClick={() => pickTool(t)}
              className="absolute bottom-[-40px] h-[150px] w-[60px] transition-transform duration-300 ease-[var(--ease-spring)]"
              style={{ left: toolX[t], transform: `translateX(-50%) translateY(${tool === t ? -26 : 0}px)` }}
            >
              <svg viewBox="0 0 60 140" className="size-full overflow-visible" fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {t === 'pen' && (
                  <>
                    <path d={art.pencil.body} fill="#fff" strokeWidth={1.6} />
                    <path d={art.pencil.tip} fill="#fff" strokeWidth={1.6} />
                    <path d={art.pencil.lead} fill={color} strokeWidth={1.2} />
                    <path d={art.pencil.band} strokeWidth={1.6} />
                  </>
                )}
                {t === 'highlighter' && (
                  <>
                    <path d={art.highlighter.body} fill="#fff" strokeWidth={1.6} />
                    <path d={art.highlighter.tip} fill={color} fillOpacity={0.6} strokeWidth={1.6} />
                    <path d={art.highlighter.cap} strokeWidth={1.6} />
                  </>
                )}
                {t === 'eraser' && (
                  <>
                    <path d={art.eraser.body} fill="#fff" strokeWidth={1.6} />
                    <path d={art.eraser.line} strokeWidth={1.6} />
                  </>
                )}
              </svg>
            </button>
          ))}

          <button aria-label="Undo" onClick={() => canvas.current?.undo()} className="absolute bottom-[34px] left-[252px] -translate-x-1/2 p-[6px]">
            <svg viewBox="0 0 24 24" className="size-[26px] fill-none stroke-black stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
              <path d="M9 5 L4 10 L9 15 M4 10 H14 C18 10 20 13 20 16 C20 19 18 21 15 21" />
            </svg>
          </button>
          <button aria-label="Redo" onClick={() => canvas.current?.redo()} className="absolute bottom-[34px] left-[294px] -translate-x-1/2 p-[6px]">
            <svg viewBox="0 0 24 24" className="size-[26px] -scale-x-100 fill-none stroke-black stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
              <path d="M9 5 L4 10 L9 15 M4 10 H14 C18 10 20 13 20 16 C20 19 18 21 15 21" />
            </svg>
          </button>
          <button aria-label="Color" aria-expanded={open === 'color'} onClick={() => setOpen(open === 'color' ? null : 'color')} className="absolute bottom-[26px] left-[350px] size-[46px] -translate-x-1/2">
            <span className="absolute inset-[9px] rounded-full" style={{ background: color }} />
            <svg viewBox="0 0 48 48" className="absolute inset-0 size-full" fill="none" stroke="#000" aria-hidden>
              <path d={art.ring} strokeWidth={1.8} />
            </svg>
          </button>

          {/* thickness: 5 steps in a bubble above the tool */}
          {open === 'size' && (
            <div
              className="animate-pop-in absolute bottom-[132px] flex -translate-x-1/2 items-center gap-[10px] rounded-full border-[1.8px] border-black bg-white px-[14px] py-[8px]"
              style={{ left: Math.max(110, toolX[tool]) }}
            >
              {SIZES.map((s) => (
                <button key={s} aria-label={`Size ${s}`} aria-pressed={size === s} onClick={() => { setSize(s); setOpen(null) }} className="flex size-[30px] items-center justify-center">
                  <span
                    className={`rounded-[3px] ${size === s ? 'outline-2 outline-offset-2 outline-black' : ''}`}
                    style={{ width: 6 + s * 0.9, height: 6 + s * 0.9, background: tool === 'eraser' ? '#bbb' : color, border: color === '#ffffff' ? '1px solid #999' : undefined }}
                  />
                </button>
              ))}
            </div>
          )}

          {open === 'color' && (
            <div className="animate-pop-in absolute right-[12px] bottom-[86px] grid origin-bottom-right grid-cols-5 gap-[10px] rounded-[16px] border-[1.8px] border-black bg-white p-[12px]">
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => { setColor(c); setOpen(null); if (tool === 'eraser') setTool('pen') }}
                  className={`size-[30px] rounded-full ${color === c ? 'outline-2 outline-offset-2 outline-black' : ''}`}
                  style={{ background: c, border: c === '#ffffff' ? '1px solid #999' : undefined }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* confirm (wireframe: card preview + "can't edit after") */}
      {preview && (
        <div className="animate-fade-in absolute inset-0 z-40 flex flex-col bg-white">
          <p className="text-center text-[24px]" style={{ marginTop: 'calc(var(--top) + 14px)' }}>
            Draw
          </p>
          <div className="mx-auto mt-[18px] w-[78%]">
            <CardView card={{ ...draft(preview), id: 'preview', createdAt: '', serial: '' }} />
          </div>
          <div className="animate-sheet-up mt-auto bg-[#d9d9d9] px-[24px] pt-[30px] pb-[calc(env(safe-area-inset-bottom)+24px)] text-center">
            <p className="text-[21px] leading-[1.3]">Once finished, this card can't be edited.</p>
            <div className="mt-[26px] flex justify-around text-[21px]">
              <button onClick={() => onFinish(draft(preview))}>Finish</button>
              <button onClick={() => setPreview(null)}>Back</button>
            </div>
          </div>
        </div>
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// Finished card lands with a little burst, then goes to a town (wireframe "Tada~").
export function TadaScreen({ card, onChoose }: { card: Card; onChoose: () => void }) {
  const lines = [
    'M300 150 L300 190', 'M330 165 L320 185', 'M345 205 L380 205',
    'M60 650 L80 640', 'M95 670 L100 720', 'M40 700 L75 705',
  ]
  return (
    <div className="relative h-full overflow-hidden bg-white font-hand">
      <svg viewBox="0 0 402 874" className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {lines.map((d, i) => (
          <path key={d} d={d} stroke="#000" strokeWidth={2} strokeLinecap="round" style={{ transformOrigin: i < 3 ? '320px 190px' : '80px 690px', animation: `spark 1.4s ease-out ${0.5 + (i % 3) * 0.12}s both` }} />
        ))}
      </svg>
      <div className="animate-tada absolute top-1/2 left-1/2 w-[68%] -translate-x-1/2 -translate-y-[58%] drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]">
        <CardView card={card} />
      </div>
      <button onClick={onChoose} className="absolute inset-x-0 text-[22px] underline decoration-[1.5px] underline-offset-[5px]" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}>
        Choose a town to send
      </button>
    </div>
  )
}

// PNG → data URL trimmed to the drawn lines (so walkers stand on their feet) and shrunk to fit localStorage
async function toDataUrl(blob: Blob, maxSide = 480) {
  const bmp = await createImageBitmap(blob)
  const src = document.createElement('canvas')
  src.width = bmp.width
  src.height = bmp.height
  const sctx = src.getContext('2d')!
  sctx.drawImage(bmp, 0, 0)
  const { data } = sctx.getImageData(0, 0, src.width, src.height)
  let [x0, y0, x1, y1] = [src.width, src.height, -1, -1]
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (data[(y * src.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) [x0, y0, x1, y1] = [0, 0, src.width - 1, src.height - 1]
  const pad = Math.round(src.width * 0.03)
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(src.width - 1, x1 + pad)
  y1 = Math.min(src.height - 1, y1 + pad)
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const k = Math.min(1, maxSide / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * k))
  c.height = Math.max(1, Math.round(h * k))
  c.getContext('2d')!.drawImage(src, x0, y0, w, h, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

function drawArt() {
  const rect = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  return {
    pencil: {
      body: wobblyPoly(rect(19, 36, 22, 104), 10),
      tip: wobblyPoly([[19, 36], [30, 6], [41, 36]], 11),
      lead: wobblyPoly([[26, 17], [30, 6], [34, 17]], 12),
      band: wobblyPoly([[19, 48], [41, 48]], 13, false),
    },
    highlighter: {
      body: wobblyPoly(rect(15, 42, 30, 98), 20),
      tip: wobblyPoly([[21, 42], [23, 22], [37, 15], [39, 42]], 21),
      cap: wobblyPoly([[15, 60], [45, 60]], 22, false),
    },
    eraser: {
      body: wobblyPoly(rect(4, 50, 52, 90), 30),
      line: wobblyPoly([[4, 72], [56, 72]], 31, false),
    },
    ring: wobblyCircle(24, 24, 21, 50, 0.05),
    underline: wobblyLine(60, 7, 2.2),
  }
}
