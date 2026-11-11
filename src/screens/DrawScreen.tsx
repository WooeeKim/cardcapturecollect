import { useEffect, useRef, useState } from 'react'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import backIcon from '../assets/proto/back.svg'
import { CardView, Popup, TextButton, type PopupAction } from '../components/ui'
import { CheckMark, ColorIcon, EraserIcon, HighlighterIcon, PenIcon, RedoIcon, SizeBubble, TabUnderline, ToggleIcon, UndoIcon } from '../components/drawIcons'
import { MOODS } from '../lib/moods'
import { locatePlace } from '../lib/place'
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

  // Figma wireframe 그리기 geometry (frame px)
  const TOOLS = {
    pen: { left: 32, top: 793, w: 40, h: 152 },
    highlighter: { left: 86, top: 797, w: 48, h: 128 },
    eraser: { left: 155, top: 801, w: 69, h: 100 },
  } as const
  const LIFT = 46

  return (
    <div className="relative h-full overflow-hidden bg-white font-hand">
      {/* header */}
      <button aria-label="Back" onClick={back} className="absolute top-[72px] left-[17px] z-10 p-[10px]">
        <img src={backIcon} alt="" className="h-[25.3px] w-[16.1px] -scale-x-100" />
      </button>
      {(['draw', 'write'] as const).map((t) => (
        <button
          key={t}
          onClick={() => { setTab(t); setOpen(null) }}
          aria-pressed={tab === t}
          className="absolute top-[79px] -translate-x-1/2 px-[6px] text-[24px] leading-[30px]"
          style={{ left: t === 'draw' ? 161 : 244 }}
        >
          {t === 'draw' ? 'Draw' : 'Write'}
          {tab === t && (
            <span className="absolute top-[30px] left-1/2 h-[5px] w-[78px] -translate-x-1/2">
              <TabUnderline />
            </span>
          )}
        </button>
      ))}
      <button aria-label="Finish card" onClick={check} className="absolute top-[72px] left-[346px] z-10">
        <span className="block h-[35px] w-[36px]">
          <CheckMark />
        </span>
      </button>

      {/* card-sized canvas */}
      <div className="absolute top-[145px] left-[21px] h-[515px] w-[360px] overflow-hidden rounded-[10px] bg-[#f0f0f0]">
        <DrawingCanvas ref={canvas} tool={tool} color={color} size={size} guide={guide && tab === 'draw'} onChange={() => setEmpty(!!canvas.current?.isEmpty())} />
        {empty && tab === 'draw' && <p className="pointer-events-none absolute inset-x-0 top-[226px] text-center text-[22px]">A few lines will do!</p>}
        {tab === 'write' && <div className="absolute inset-0 bg-[#bdbdbd]/55" />}
      </div>

      {tab === 'write' && (
        <>
          <span className="absolute top-[150px] left-[31px] flex h-[39px] w-[71px] items-center justify-center rounded-[6px] border-[2px] border-dashed border-[#555] bg-[#f0f0f0] text-[19px]">Mood</span>
          <input
            value={place}
            onChange={(e) => {
              typedPlace.current = true
              setPlace(e.target.value)
            }}
            placeholder="Where are you?"
            maxLength={30}
            aria-label="Place"
            className="absolute top-[151px] left-[183px] h-[36px] w-[194px] rounded-[6px] border-[2px] border-dashed border-[#555] bg-[#f0f0f0] px-[9px] text-right text-[17px] outline-none placeholder:text-[#888]"
          />
          {MOODS.map((m, i) => {
            const on = mood === m.name
            return (
              <button
                key={m.name}
                aria-pressed={on}
                onClick={() => setMood(on ? '' : m.name)}
                className="absolute h-[44.5px] w-[106.5px] rounded-full text-[19px] transition-transform active:scale-95"
                style={{
                  left: 34.4 + (i % 3) * 115.9,
                  top: 215.4 + Math.floor(i / 3) * 57.9,
                  background: on ? m.color : '#e6e6e6',
                  color: on ? m.ink : '#000',
                  boxShadow: on ? 'none' : `inset 0 0 0 2.5px ${m.color}`,
                }}
              >
                {m.name}
              </button>
            )
          })}
          <div className="absolute top-[402px] left-[21px] h-[152px] w-[360px] rounded-[10px] bg-[#e6e6e6]" />
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname"
            maxLength={24}
            aria-label="Nickname"
            className="absolute top-[412px] left-[31px] h-[36px] w-[180px] rounded-[6px] border-[2px] border-dashed border-[#555] bg-[#f0f0f0] px-[9px] text-[18px] outline-none placeholder:text-black"
          />
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Save the moment."
            maxLength={180}
            aria-label="Memo"
            className="absolute top-[458px] left-[31px] h-[86px] w-[340px] resize-none rounded-[6px] border-[2px] border-dashed border-[#555] bg-[#f0f0f0] px-[9px] py-[7px] text-[15px] leading-[1.25] outline-none placeholder:text-black"
          />
        </>
      )}

      {/* guide toggle */}
      {tab === 'draw' && (
        <button onClick={() => setGuide(!guide)} aria-pressed={guide} aria-label="Guide" className="absolute top-[668px] left-[18px] h-[27px] w-[110px]">
          <span className="absolute top-0 left-0 text-[20px] leading-[27px]">Guide</span>
          <span className="absolute top-[1.5px] left-[60px] h-[26px] w-[49px]">
            <ToggleIcon on={guide} />
          </span>
        </button>
      )}

      {/* tools */}
      {tab === 'draw' && (
        <>
          {(['pen', 'highlighter', 'eraser'] as const).map((t) => {
            const g = TOOLS[t]
            return (
              <button
                key={t}
                aria-label={t === 'pen' ? 'Pencil' : t === 'highlighter' ? 'Highlighter' : 'Eraser'}
                aria-pressed={tool === t}
                onClick={() => pickTool(t)}
                className="absolute transition-transform duration-300 ease-[var(--ease-spring)]"
                style={{ left: g.left, top: g.top, width: g.w, height: g.h, transform: `translateY(${tool === t ? -LIFT : 0}px)` }}
              >
                {t === 'pen' ? <PenIcon /> : t === 'highlighter' ? <HighlighterIcon color={color} /> : <EraserIcon />}
              </button>
            )
          })}

          <button aria-label="Undo" onClick={() => canvas.current?.undo()} className="absolute top-[798px] left-[256px] h-[27px] w-[25px]">
            <UndoIcon />
          </button>
          <button aria-label="Redo" onClick={() => canvas.current?.redo()} className="absolute top-[797px] left-[299px] h-[29px] w-[26px]">
            <RedoIcon />
          </button>
          <button aria-label="Color" aria-expanded={open === 'color'} onClick={() => setOpen(open === 'color' ? null : 'color')} className="absolute top-[793px] left-[345px] size-[41px]">
            <ColorIcon color={color === '#ffffff' ? '#cccccc' : color} />
          </button>

          {/* thickness: 5 steps in a bubble above the tool (Figma Group 17) */}
          {open === 'size' && (
            <div
              className="animate-pop-in absolute top-[708px] h-[46px] w-[150px]"
              style={{ left: Math.min(236, Math.max(16, TOOLS[tool].left + TOOLS[tool].w / 2 - 75)) }}
            >
              <SizeBubble />
              {SIZES.map((s, i) => {
                const side = [8, 11, 14, 17, 19][i]
                return (
                  <button
                    key={s}
                    aria-label={`Size ${s}`}
                    aria-pressed={size === s}
                    onClick={() => { setSize(s); setOpen(null) }}
                    className="absolute top-[11px] flex h-[24px] w-[26px] -translate-x-1/2 items-center justify-center"
                    style={{ left: [20, 41.5, 65.5, 92.5, 121.5][i] }}
                  >
                    <span
                      className={`rotate-[-12deg] rounded-[2px] ${size === s ? 'outline-[1.5px] outline-offset-[3px] outline-black' : ''}`}
                      style={{ width: side, height: side * 0.8, background: tool === 'eraser' ? '#bbb' : color === '#ffffff' ? '#ddd' : color, opacity: tool === 'highlighter' ? 0.75 : 1 }}
                    />
                  </button>
                )
              })}
            </div>
          )}

          {open === 'color' && (
            <div className="animate-pop-in absolute top-[640px] right-[18px] grid origin-bottom-right grid-cols-5 gap-[10px] rounded-[16px] border-[2px] border-black bg-white p-[12px]">
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
        </>
      )}

      {/* confirm (wireframe: card preview + "can't edit after") */}
      {preview && (
        <div className="animate-fade-in absolute inset-0 z-40 bg-white">
          <p className="absolute inset-x-0 top-[79px] text-center text-[24px] leading-[30px]">Draw</p>
          <div className="absolute top-[142px] left-[32px] w-[338px]">
            <CardView card={{ ...draft(preview), id: 'preview', createdAt: '', serial: '' }} />
          </div>
          <div className="animate-sheet-up absolute inset-x-0 top-[642px] bottom-0 bg-[#d9d9d9]">
            <p className="absolute inset-x-0 top-[56px] text-center text-[20px]">Once finished, this card can't be edited.</p>
            <button onClick={() => onFinish(draft(preview))} className="absolute top-[134px] left-[114px] -translate-x-1/2 px-[12px] py-[6px] text-[21px]">
              Finish
            </button>
            <button onClick={() => setPreview(null)} className="absolute top-[134px] left-[290px] -translate-x-1/2 px-[12px] py-[6px] text-[21px]">
              Back
            </button>
          </div>
        </div>
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// Finished card lands with a little burst, then goes to a town (wireframe "Tada~").
export function TadaScreen({ card, onChoose }: { card: Card; onChoose: () => void }) {
  const lines = ['M252 138 L252 178', 'M290 150 L282 172', 'M318 180 L352 180', 'M40 700 L60 690', 'M96 712 L100 760', 'M34 744 L70 748']
  return (
    <div className="relative h-full overflow-hidden bg-white font-hand">
      <p className="absolute inset-x-0 top-[79px] text-center text-[24px] leading-[30px]">Draw</p>
      <svg viewBox="0 0 402 874" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {lines.map((d, i) => (
          <path key={d} d={d} stroke="#000" strokeWidth={2} strokeLinecap="round" style={{ transformOrigin: i < 3 ? '300px 190px' : '70px 730px', animation: `spark 1.4s ease-out ${0.5 + (i % 3) * 0.12}s both` }} />
        ))}
      </svg>
      <div className="absolute top-[210px] left-[46px] w-[310px]">
        <div className="animate-tada drop-shadow-[0_6px_14px_rgba(0,0,0,0.2)]">
          <CardView card={card} />
        </div>
      </div>
      <TextButton onClick={onChoose} className="absolute top-[734px] left-1/2 -translate-x-1/2 text-[21px]">
        Choose a town to send
      </TextButton>
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
