import { useEffect, useRef, useState } from 'react'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import backIcon from '../assets/proto/v2/back.svg'
import checkIcon from '../assets/proto/v2/check.svg'
import lineDraw from '../assets/proto/v2/tab-line-draw.svg'
import lineMemo from '../assets/proto/v2/tab-line-memo.svg'
import closeDark from '../assets/proto/v2/close-dark.svg'
import eyedropper from '../assets/proto/v2/eyedropper.svg'
import checker from '../assets/proto/v2/checker.png'
import moodBox from '../assets/proto/v2/mood-box.svg'
import chipW1 from '../assets/proto/v2/chip-w1.svg'
import chipW2 from '../assets/proto/v2/chip-w2.svg'
import spark391 from '../assets/proto/v2/spark-391.svg'
import spark392 from '../assets/proto/v2/spark-392.svg'
import spark393 from '../assets/proto/v2/spark-393.svg'
import spark394 from '../assets/proto/v2/spark-394.svg'
import spark395 from '../assets/proto/v2/spark-395.svg'
import spark396 from '../assets/proto/v2/spark-396.svg'
import spark397 from '../assets/proto/v2/spark-397.svg'
import spark398 from '../assets/proto/v2/spark-398.svg'
import { Bottom, CardView, Popup, shrink, type PopupAction } from '../components/ui'
import { ToggleIcon } from '../components/drawIcons'
import { ChipShape, ColorWheelV2, ConfirmBubble, EraserV2, HighlighterV2, PenV2, PillBack, PillFinish, PillVillage, RedoV2, SizeBubbleV2, UndoV2 } from '../components/v2'
import { MOODS } from '../lib/moods'
import { toLocal } from '../lib/frame'
import { lastPlace, locatePlace, rememberPlace } from '../lib/place'
import type { Card } from '../lib/store'

// New Figma GUI (prototyping › 그리기): Drawing | Memo tabs, hand-drawn toolbar, Colors panel with
// eyedropper, Memo with 9 mood chips, speech-bubble confirm (745:694), "Choose a village" (719:11320).
const SIZES = [2, 4, 8, 14, 22]
// toolbar geometry in Figma frame px; `up` = how far the picked tool lifts
const TOOLS = {
  pen: { left: 29, top: 793, w: 30, h: 150.5, up: 36, bubble: 18 },
  highlighter: { left: 79, top: 796, w: 37.15, h: 126.6, up: 39, bubble: 61 },
  eraser: { left: 134, top: 805, w: 40, h: 98, up: 30, bubble: 116 },
} as const

type Draft = Omit<Card, 'id' | 'createdAt' | 'serial'>
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')

export default function DrawScreen({ onExit, onFinish }: { onExit: () => void; onFinish: (draft: Draft) => void }) {
  const canvas = useRef<DrawingCanvasHandle>(null)
  const [tab, setTab] = useState<'draw' | 'memo'>('draw')
  const [tool, setTool] = useState<Tool>('pen')
  // each tool keeps its own color and thickness (eraser: thickness only)
  const [settings, setSettings] = useState<Record<Tool, { color: string; size: number }>>({
    pen: { color: '#000000', size: 4 },
    highlighter: { color: '#f5b39f', size: 8 },
    eraser: { color: '#000000', size: 14 },
  })
  const { size } = settings[tool]
  const colorTool: Tool = tool === 'eraser' ? 'pen' : tool
  const color = settings[colorTool].color
  const setSize = (v: number) => setSettings((p) => ({ ...p, [tool]: { ...p[tool], size: v } }))
  // picking a color while erasing switches back to the pencil
  const setColor = (v: string) => {
    setSettings((p) => ({ ...p, [colorTool]: { ...p[colorTool], color: v } }))
    if (tool === 'eraser') setTool('pen')
  }
  const [guide, setGuide] = useState(true)
  const [open, setOpen] = useState<'size' | 'color' | null>(null)
  const [picking, setPicking] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [empty, setEmpty] = useState(true)
  const [mood, setMood] = useState('')
  // starts with the last place used, then switches to the nearest station once location arrives
  const [place, setPlace] = useState(lastPlace)
  const [locating, setLocating] = useState(true)
  const [nickname, setNickname] = useState('')
  const [memo, setMemo] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const typedPlace = useRef(false)
  const memoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    locatePlace().then((p) => {
      if (p && !typedPlace.current) setPlace(p)
      setLocating(false)
    })
  }, [])

  const draft = (image: string): Draft => ({ image, mood, place: place.trim(), nickname: nickname.trim(), memo: memo.trim() })

  function back() {
    if (preview) return setPreview(null)
    if (empty && !nickname && !memo && !mood) return onExit()
    setPopup({
      message: 'Discard this drawing?',
      actions: [
        { label: 'Discard', onClick: onExit },
        { label: 'Cancel', onClick: () => setPopup(null) },
      ],
    })
  }

  const [showMissing, setShowMissing] = useState(false)
  const missing = [!mood && 'mood', !place.trim() && 'place', !nickname.trim() && 'nickname', !memo.trim() && 'memo'].filter(Boolean)
  const dashed = (name: string) => (showMissing && missing.includes(name) ? 'border-[#d9534f] bg-[#fdeceb]/90' : 'border-[#707070] bg-white/70')

  async function check() {
    if (canvas.current?.isEmpty()) {
      return setPopup({ message: 'Draw at least one line first.', actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
    }
    // every Memo field is required: jump to Memo and mark what's empty
    if (missing.length) {
      setTab('memo')
      setOpen(null)
      setShowMissing(true)
      return
    }
    setPreview(await toDataUrl(await canvas.current!.toBlob()))
  }

  function pickTool(t: Tool) {
    setPicking(false)
    if (tool === t) setOpen(open === 'size' ? null : 'size')
    else {
      setTool(t)
      setOpen(null)
    }
  }

  const g = TOOLS[tool]

  return (
    <div className="relative h-full overflow-hidden bg-[#f0f0f0] font-hand">
      {/* card-sized canvas (white paper) */}
      <div className="absolute top-[145px] left-[21px] h-[515px] w-[360px] overflow-hidden rounded-[10px] bg-white transition-transform duration-300" style={tab === 'draw' ? shrink(515) : undefined}>
        <DrawingCanvas
          ref={canvas}
          tool={tool}
          color={color}
          size={size}
          guide={guide && tab === 'draw'}
          picking={picking}
          onPick={(c) => {
            setColor(c)
            setPicking(false)
          }}
          onZoom={setZoomed}
          onChange={() => setEmpty(!!canvas.current?.isEmpty())}
        />
        {empty && tab === 'draw' && <p className="pointer-events-none absolute inset-x-0 top-[241px] text-center text-[25px] tracking-[-0.5px]">A few lines will do!</p>}
      </div>

      {/* header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[135px] bg-gradient-to-b from-[#f0f0f0] to-[#f0f0f0]/0" />
      <button aria-label="Back" onClick={back} className="absolute top-[75px] left-[24px] z-10 size-[50px]">
        <img src={backIcon} alt="" className="size-full" />
      </button>
      {(['draw', 'memo'] as const).map((t) => (
        <button
          key={t}
          onClick={() => {
            setTab(t)
            setOpen(null)
            setPicking(false)
          }}
          aria-pressed={tab === t}
          className={`absolute top-[86px] z-20 -translate-x-1/2 text-[24px] leading-[1.3] ${tab === 'memo' && !preview ? 'text-white' : ''}`}
          style={{ left: t === 'draw' ? 154 : 242.5 }}
        >
          {t === 'draw' ? 'Drawing' : 'Memo'}
        </button>
      ))}
      <img src={tab === 'draw' ? lineDraw : lineMemo} alt="" className="pointer-events-none absolute top-[113px] z-10 h-[3px]" style={tab === 'draw' ? { left: 116, width: 76 } : { left: 215, width: 55 }} />
      <button aria-label="Finish card" onClick={check} className="absolute top-[75px] right-[24px] z-10 size-[50px]">
        <img src={checkIcon} alt="" className="size-full" />
      </button>

      {/* memo: dims everything (header stays tappable through it) */}
      {tab === 'memo' && !preview && (
        <>
          <div className="animate-fade-in pointer-events-none absolute inset-0 z-10 bg-black/35 backdrop-blur-[1.5px]" />
          <div className="absolute inset-0 top-[140px] z-20">
            {/* folder-tab box around the moods (Figma 787:3578 Vector 413) */}
            <img src={moodBox} alt="" className="pointer-events-none absolute top-[10.5px] left-[21px] h-[226.5px] w-[367px] max-w-none -scale-y-100" />
            <span className={`absolute top-[27px] left-[68px] text-[21px] leading-[1.1] tracking-[-0.63px] ${showMissing && !mood ? 'text-[#d9534f]' : 'text-[#3d3d3d]'}`}>Mood</span>
            <label className={`absolute top-[11px] right-[25px] flex rounded-[10px] border-2 border-dashed px-[7px] py-[5px] ${dashed('place')}`}>
              <input
                value={place}
                onChange={(e) => {
                  typedPlace.current = true
                  setPlace(e.target.value)
                }}
                placeholder={locating ? 'Finding where you are…' : 'Where are you?'}
                maxLength={30}
                aria-label="Place"
                size={Math.max(4, (place || (locating ? 'Finding where you are…' : 'Where are you?')).length)}
                className="max-w-[220px] bg-transparent text-right text-[17px] leading-[1.1] tracking-[-0.34px] text-[#3d3d3d] outline-none placeholder:text-[#777]"
              />
            </label>
            <div className="absolute top-[69px] left-[36px] grid w-[327px] grid-cols-3 gap-x-[9.35px] gap-y-[13.36px]">
              {MOODS.map((m, i) => {
                const on = mood === m.name
                return (
                  <button key={m.name} aria-pressed={on} onClick={() => setMood(on ? '' : m.name)} className="relative h-[40px] transition-transform active:scale-95">
                    <span className="absolute inset-[-2.5%_-1%]">
                      {on ? <ChipShape on i={i} /> : <img src={i % 3 === 1 ? chipW2 : chipW1} alt="" className="size-full" />}
                    </span>
                    <span className={`relative text-[19px] leading-[1.1] ${on ? 'text-[#f3f3f3]' : 'text-[#3d3d3d]'}`}>{m.name}</span>
                  </button>
                )
              })}
            </div>
            {/* the whole lower area starts writing the memo */}
            <div onClick={() => memoRef.current?.focus()} className="absolute top-[262px] left-[21px] flex h-[258px] w-[360px] cursor-text flex-col items-start gap-[10px] rounded-[10px] p-[10px]">
              <label className={`flex rounded-[10px] border-2 border-dashed px-[7px] py-[5px] ${dashed('nickname')}`} onClick={(e) => e.stopPropagation()}>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nickname"
                  maxLength={24}
                  aria-label="Nickname"
                  size={Math.max(8, nickname.length + 1)}
                  className="max-w-[320px] bg-transparent text-[21px] leading-[1.1] tracking-[-0.42px] text-[#3d3d3d] outline-none placeholder:text-[#3d3d3d]"
                />
              </label>
              <textarea
                value={memo}
                ref={memoRef}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Save the moment."
                maxLength={180}
                aria-label="Memo"
                className={`h-[86px] w-full resize-none rounded-[10px] border-2 border-dashed px-[7px] py-[5px] text-[17px] leading-[1.15] tracking-[-0.34px] text-[#3d3d3d] outline-none placeholder:text-[#3d3d3d] ${dashed('memo')}`}
              />
            </div>
          </div>
        </>
      )}

      {/* toolbar */}
      {tab === 'draw' && (
        <Bottom>
          <div className="pointer-events-none absolute top-[704px] left-0 h-[170px] w-[402px] rounded-t-[20px] bg-gradient-to-b from-[#f0f0f0]/0 to-[#f0f0f0]" />
          {(['pen', 'highlighter', 'eraser'] as const).map((t) => {
            const s = TOOLS[t]
            return (
              <button
                key={t}
                aria-label={t === 'pen' ? 'Pencil' : t === 'highlighter' ? 'Highlighter' : 'Eraser'}
                aria-pressed={tool === t}
                onClick={() => pickTool(t)}
                className="absolute transition-transform duration-300 ease-[var(--ease-spring)]"
                style={{ left: s.left, top: s.top, width: s.w, height: s.h, transform: `translateY(${tool === t ? -s.up : 0}px)` }}
              >
                {t === 'pen' ? <PenV2 /> : t === 'highlighter' ? <HighlighterV2 color={settings.highlighter.color} /> : <EraserV2 />}
              </button>
            )
          })}
          <button aria-label="Undo" onClick={() => canvas.current?.undo()} className="absolute top-[801px] left-[201px] h-[24.6px] w-[22.7px]">
            <UndoV2 />
          </button>
          <button aria-label="Redo" onClick={() => canvas.current?.redo()} className="absolute top-[799px] left-[239.7px] h-[27.7px] w-[20.2px]">
            <RedoV2 />
          </button>
          <button onClick={() => setGuide(!guide)} aria-pressed={guide} aria-label="Guide" className="absolute top-[774px] left-[268px] h-[63px] w-[68px]">
            <span className="absolute inset-x-0 top-0 text-center text-[25px] leading-[normal] tracking-[-0.5px]">Guide</span>
            <span className="absolute top-[39px] left-[11px] h-[23px] w-[46px]">
              <ToggleIcon on={guide} />
            </span>
          </button>
          <button
            aria-label="Color"
            aria-expanded={open === 'color'}
            onClick={() => {
              setPicking(false)
              setOpen(open === 'color' ? null : 'color')
            }}
            className="absolute top-[793px] left-[344.7px] h-[38.4px] w-[38.8px]"
          >
            <ColorWheelV2 color={color} />
          </button>

          {/* thickness: 5 steps in a bubble above the picked tool */}
          {open === 'size' && (
            <div className="animate-pop-in absolute top-[713px] h-[43.6px] w-[148px]" style={{ left: g.bubble }}>
              <SizeBubbleV2 />
              {SIZES.map((s, i) => {
                const side = [7, 9, 12, 15, 18][i]
                return (
                  <button
                    key={s}
                    aria-label={`Size ${s}`}
                    aria-pressed={size === s}
                    onClick={() => {
                      setSize(s)
                      setOpen(null)
                    }}
                    className="absolute top-[9px] flex h-[24px] w-[26px] -translate-x-1/2 items-center justify-center"
                    style={{ left: [22, 42, 64, 90, 118][i] }}
                  >
                    <span
                      className={`${tool === 'highlighter' ? 'rotate-[-12deg] rounded-[2px]' : 'rounded-full'} ${size === s ? 'outline-[1.5px] outline-offset-[3px] outline-black' : ''}`}
                      style={{ width: side, height: tool === 'highlighter' ? side * 0.8 : side, background: tool === 'eraser' ? '#bbb' : color }}
                    />
                  </button>
                )
              })}
            </div>
          )}

          {/* back to normal size after pinch zoom */}
          {zoomed && (
            <button aria-label="Fit drawing" onClick={() => canvas.current?.resetView()} className="animate-pop-in absolute top-[662px] left-[330px] size-[36px] rounded-[4px] border-2 border-black bg-white">
              <svg viewBox="0 0 36 36" className="size-full" aria-hidden>
                <path d="M13 7v6H7M23 29v-6h6" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </Bottom>
      )}

      {picking && <p className="animate-fade-in pointer-events-none absolute inset-x-0 top-[124px] z-10 text-center text-[17px] text-[#555]">Tap the drawing to pick a color</p>}

      {open === 'color' && (
        <ColorPanel
          color={color}
          onChange={setColor}
          onClose={() => setOpen(null)}
          onEyedropper={() => {
            setOpen(null)
            setPicking(true)
          }}
        />
      )}

      {/* confirm (Figma drawing-handwrite 745:694): card + speech bubble */}
      {preview && (
        <div className="animate-fade-in absolute inset-0 top-[130px] z-30 bg-[#f0f0f0]">
          <div className="absolute top-[15px] left-[21px] w-[360px]" style={shrink(515)}>
            <CardView card={{ ...draft(preview), id: 'preview', createdAt: '', serial: '' }} />
          </div>
          <div className="absolute inset-x-0 top-[-130px] h-0">
            <Bottom>
              <div className="animate-pop-in">
                <span className="absolute top-[673px] left-[17.8px] h-[122px] w-[368px]">
                  <ConfirmBubble />
                </span>
                <p className="absolute top-[689px] left-[203px] w-[370px] -translate-x-1/2 text-center text-[24.3px] leading-[1.2]">
                  Ready to finish?
                  <br />
                  You won’t be able to edit this afterward.
                </p>
                <button
                  onClick={() => {
                    rememberPlace(place.trim())
                    onFinish(draft(preview))
                  }}
                  className="absolute top-[768.6px] left-[63.8px] h-[54.8px] w-[113px]"
                >
                  <span className="absolute inset-0 rotate-[-178.73deg]">
                    <PillFinish />
                  </span>
                  <span className="relative text-[24.3px] leading-[1.1]">Finish</span>
                </button>
                <button onClick={() => setPreview(null)} className="absolute top-[766px] left-[221px] h-[58.3px] w-[133.6px]">
                  <span className="absolute inset-0 rotate-[-177.79deg]">
                    <PillBack />
                  </span>
                  <span className="relative text-[24.3px] leading-[1.1]">Go Back</span>
                </button>
              </div>
            </Bottom>
          </div>
        </div>
      )}

      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// Colors panel (Figma Color Picker in 719:10698): spectrum (hue → right, light → top, dark → bottom),
// opacity slider, eyedropper, close.
function ColorPanel({ color, onChange, onClose, onEyedropper }: { color: string; onChange: (c: string) => void; onClose: () => void; onEyedropper: () => void }) {
  const base = color.slice(0, 7)
  const alpha = color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null)
  const spectrum = useRef<HTMLDivElement>(null)
  const slider = useRef<HTMLDivElement>(null)

  const withAlpha = (hex: string, a: number) => (a >= 0.995 ? hex : `${hex}${hex2(a * 255)}`)

  function fromSpectrum(e: React.PointerEvent) {
    const el = spectrum.current!
    const p = toLocal(e.clientX, e.clientY, el) // works when the frame is scaled or rotated
    const fx = Math.min(1, Math.max(0, p.x / el.offsetWidth))
    const fy = Math.min(1, Math.max(0, p.y / el.offsetHeight))
    setKnob({ x: fx, y: fy })
    onChange(withAlpha(hslHex(fx * 360, 1, 1 - fy), alpha))
  }
  function fromSlider(e: React.PointerEvent) {
    const el = slider.current!
    const f = Math.min(1, Math.max(0, toLocal(e.clientX, e.clientY, el).x / el.offsetWidth))
    onChange(withAlpha(base, f))
  }

  return (
    <div className="animate-fade-in absolute inset-0 z-40 bg-black/35 backdrop-blur-[1.5px]" onClick={onClose}>
      <Bottom>
        <div
          role="dialog"
          aria-label="Colors"
          className="animate-pop-in absolute top-[371px] left-[11px] h-[460px] w-[380px] overflow-hidden rounded-[20px] bg-white shadow-[0_3px_20px_rgba(0,0,0,0.1)]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="absolute inset-x-0 top-[19px] text-center text-[20px] leading-[1.3] text-[#121212]">Colors</p>
          <button aria-label="Pick a color from the drawing" onClick={onEyedropper} className="absolute top-[14px] left-[13px] flex size-[34px] items-center justify-center">
            <img src={eyedropper} alt="" className="h-[34px] w-[11px] rotate-[42.59deg]" />
          </button>
          <button aria-label="Close" onClick={onClose} className="absolute top-[18px] left-[349px] flex size-[26px] items-center justify-center">
            <img src={closeDark} alt="" className="h-[15px] w-[12.3px]" />
          </button>
          <div
            ref={spectrum}
            className="absolute top-[57px] left-[13px] h-[296px] w-[354px] touch-none rounded-[10px]"
            style={{
              background:
                'linear-gradient(to bottom, #fff 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, #000 100%), linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)',
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              fromSpectrum(e)
            }}
            onPointerMove={(e) => e.buttons && fromSpectrum(e)}
          >
            {knob && <span className="pointer-events-none absolute size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_2px_rgba(0,0,0,0.4)]" style={{ left: `${knob.x * 100}%`, top: `${knob.y * 100}%`, background: base }} />}
          </div>
          <p className="absolute top-[372px] left-[15px] text-[15px] leading-[1.3] uppercase">Opacity</p>
          <div className="absolute top-[396px] left-[15px] flex w-[350px] items-center gap-[11px]">
            <div
              ref={slider}
              className="relative h-[34px] flex-1 touch-none rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${base}00 12%, ${base} 88%), url(${checker})`, backgroundSize: 'auto, 23.2px 23.2px' }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                fromSlider(e)
              }}
              onPointerMove={(e) => e.buttons && fromSlider(e)}
            >
              <span className="pointer-events-none absolute top-0 size-[34px] -translate-x-1/2 rounded-full border-[3px] border-white drop-shadow-[0_0_1.5px_rgba(0,0,0,0.25)]" style={{ left: `clamp(17px, ${alpha * 100}%, calc(100% - 17px))`, background: withAlpha(base, alpha) }} />
            </div>
            <p className="w-[44px] text-right text-[17px] leading-[1.3]">{Math.round(alpha * 100)}%</p>
          </div>
        </div>
      </Bottom>
    </div>
  )
}

function hslHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `#${hex2(f(0) * 255)}${hex2(f(8) * 255)}${hex2(f(4) * 255)}`
}

// Finished card lands with a little burst, then goes to a village (Figma 719:11320).
export function TadaScreen({ card, onChoose }: { card: Card; onChoose: () => void }) {
  // Figma spark strokes (Vector 391–398), positioned as in the frame
  const sparks = [
    { src: spark391, x: 274.2, y: 135.3, w: 2, h: 21.2 },
    { src: spark392, x: 302.2, y: 149.3, w: 41, h: 36.4 },
    { src: spark393, x: 252.8, y: 126, w: 13.4, h: 31.8 },
    { src: spark394, x: 339.2, y: 209, w: 36.5, h: 2 },
    { src: spark395, x: 340.1, y: 219.5, w: 10.9, h: 3.6 },
    { src: spark396, x: 36.1, y: 675.1, w: 29.3, h: 33.5 },
    { src: spark397, x: 64.7, y: 677.8, w: 10.4, h: 22.9 },
    { src: spark398, x: 41.4, y: 666.8, w: 14, h: 6 },
  ]
  return (
    <div className="relative h-full overflow-hidden bg-[#f0f0f0] font-hand">
      {sparks.map((s, i) => (
        <img key={i} src={s.src} alt="" className="pointer-events-none absolute" style={{ left: s.x, top: s.y, width: s.w, height: s.h, animation: `spark 1.4s ease-out ${0.5 + (i % 3) * 0.12}s both` }} />
      ))}
      <div className="absolute top-[203.6px] left-[50.7px] w-[300px]" style={shrink(470)}>
        <div className="animate-tada drop-shadow-[0_6px_14px_rgba(0,0,0,0.15)]">
          {/* the tada wobble ends at -6°; Figma tilts the card -8.4° */}
          <div className="rotate-[-2.4deg]">
            <CardView card={card} />
          </div>
        </div>
      </div>
      <Bottom>
        <button onClick={onChoose} className="absolute top-[774px] left-[88px] flex h-[45px] w-[227px] items-center justify-center">
          <span className="absolute inset-[-2.22%_-0.44%]">
            <PillVillage />
          </span>
          <span className="relative text-[21px] leading-[1.1]">Choose a village</span>
        </button>
      </Bottom>
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
