import { fillInside } from '../lib/fillInside'
import { waiting } from '../components/Loading'
import { useEffect, useRef, useState } from 'react'
import { logEvent } from '../lib/events'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import backIcon from '../assets/proto/v2/back.svg'
import checkIcon from '../assets/proto/v2/check.svg'
import lineDraw from '../assets/proto/v2/tab-line-draw.svg'
import lineMemo from '../assets/proto/v2/tab-line-memo.svg'
import closeDark from '../assets/proto/v2/close-dark.svg'
import eyedropper from '../assets/proto/v2/eyedropper.svg'
import checker from '../assets/proto/v2/checker.png'
import fitIcon from '../assets/proto/v2/fit.svg'
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
import CardActions from '../components/CardActions'
import { ToggleIcon } from '../components/drawIcons'
import { ChipShape, ColorWheelV2, ConfirmBubble, EraserV2, HighlighterV2, PenV2, PillBack, PillFinish, PillVillage, RedoV2, SizeBubbleV2, UndoV2 } from '../components/v2'
import { MOODS } from '../lib/moods'
import { framePoint, toLocal } from '../lib/frame'
import { lastPlace, locatePlace, rememberPlace } from '../lib/place'
import type { Card } from '../lib/store'
import { tr } from '../lib/i18n'
import { useWide } from '../lib/wide'

// New Figma GUI (prototyping › 그리기): Drawing | Memo tabs, hand-drawn toolbar, Colors panel with
// eyedropper, Memo with 9 mood chips, speech-bubble confirm (745:694), "move in" (was "Choose a village", 719:11320).
const SIZES = [2, 4, 8, 14, 22]
// toolbar geometry in Figma frame px; `up` = how far the picked tool lifts
const TOOLS = {
  pen: { left: 29, top: 793, w: 30, h: 150.5, up: 36, bubble: 18 },
  highlighter: { left: 79, top: 796, w: 37.15, h: 126.6, up: 39, bubble: 61 },
  eraser: { left: 134, top: 805, w: 40, h: 98, up: 30, bubble: 116 },
} as const
// iPad sideways (Figma iPad · drawing 1024:2576 / drawing-memo 1024:2614), frame px (1194×834; toolbar `top`s are
// still phone px inside <Bottom>, which moves them up 40). The paper is 488×700; on Memo it slides left to x 90
// and the memo fields sit to its right, with nothing dimmed.
const WIDE_TOOLS = { pen: { left: 60, bubble: 49 }, highlighter: { left: 120, bubble: 102 }, eraser: { left: 185, bubble: 167 } } as const
const WIDE_PAPER = { left: 353, top: 104, w: 488, h: 700, memoShift: 90 - 353 }
const WIDE_BAR = { undo: 920, redo: 960, guide: 1004, color: 1090, fit: 1080 }

type Draft = Omit<Card, 'id' | 'createdAt' | 'serial'>

// The drawing paper (Figma drawing 1011:4962, Vector 421): very light grey #f3f3f3 inside a hand-drawn outline.
// Stretched to the paper box; the outline keeps its 2px width whatever the size or zoom.
function PaperFrame() {
  return (
    <svg aria-hidden viewBox="0 0 363 520" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 block size-full">
      <path
        vectorEffect="non-scaling-stroke"
        fill="#f3f3f3"
        stroke="#404040"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M1.49745 65.9342C1.13372 34.1645 1.13372 33.8587 1.13372 33.5528C1.13372 29.8617 0.633545 24 2.63354 18C4.68903 11.8336 7.63354 6.5 14.6335 5C21.2543 3.58127 32.6837 2.04636 86.3425 1.25615C105.994 0.966762 128.772 0.691844 171.763 1.8113C214.753 2.93076 273.704 3 305.134 3C330.134 3 336.847 0.842722 347.634 3C355.134 4.5 358.134 10 359.134 20.5C360.708 37.0294 362.247 64.2968 361.134 131.5C360.29 182.439 361.254 280.174 360.363 334.968C359.257 402.979 359.036 424.178 358.31 445.064C357.486 468.758 362.686 503.783 357.634 511C354.134 516 348.634 517 342.134 517C333.795 517 308.634 516 302.134 517C297.329 517.739 278.867 519.148 235.134 517C208.204 515.677 179.766 516 153.134 516C126.386 516 110.27 518.19 89.6335 516C68.9974 513.81 44.8972 516.912 32.1335 516C18.1335 515 4.9324 517.721 2.63387 513.661C0.335955 509.602 1.13367 496.5 1.13387 490.5C1.13405 485.233 1.54946 477.987 1.13387 432C0.741915 388.628 3.73735 307.739 3.163 234.334C2.59613 161.885 1.88012 99.3538 1.51186 67.1925L1.49745 65.9342Z"
      />
    </svg>
  )
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')

// Onboarding "draw yourself" tour: the screen dims except one lit-up spot (white ring), and the step moves on
// when that spot is actually used. `target` = the data-tour element that is lit; `next` = moves on with a Next
// link instead (shown once there's something to move on from: a drawing, a filled-in memo).
type StepId = 'draw' | 'size-open' | 'size-pick' | 'color-open' | 'color-pick' | 'guide' | 'zoom' | 'fit' | 'memo' | 'memo-fill' | 'finish' | 'back'
const STEPS: { id: StepId; target: string; text: string }[] = [
  { id: 'draw', target: 'paper', text: 'Start by drawing yourself today! Follow the grey guide. A few lines will do.' },
  { id: 'size-open', target: 'pen', text: 'Pencil, highlighter and eraser, with undo and redo next to them. Tap the picked pencil again to change its thickness.' },
  { id: 'size-pick', target: 'sizes', text: 'Pick a thickness.' },
  { id: 'color-open', target: 'color', text: 'Tap the wheel to change the color.' },
  { id: 'color-pick', target: 'colors', text: 'Choose a color, then close the panel.' },
  { id: 'guide', target: 'guide', text: 'Tap to turn the dotted guide off or on.' },
  // no auto-advance: play with it as long as you like (and a PC can't pinch)
  { id: 'zoom', target: 'paper', text: 'Two fingers zoom, tilt and move the card. Try it!' },
  { id: 'fit', target: 'fit', text: 'Tap here to put the card back to its normal size.' },
  { id: 'memo', target: 'memo', text: 'Now open Memo.' },
  { id: 'memo-fill', target: 'memo-fill', text: 'Add their mood, where you are, a name and a line about them.' },
  { id: 'finish', target: 'finish', text: 'Done? Tap ✓ to see your card.' },
  // on the confirm screen: the tour ends by going back, so the user finishes the card on their own
  { id: 'back', target: 'go-back', text: "That's your card! Now tap Go Back and finish it on your own. This first drawing of you becomes your profile picture (change it on My Page)." },
]
type Rect = { x: number; y: number; w: number; h: number }

function Tour({ step, root, canNext, onPrev, onNext, onSkip }: { step: number; root: React.RefObject<HTMLDivElement | null>; canNext: boolean; onPrev: () => void; onNext: () => void; onSkip: () => void }) {
  const s = STEPS[step]
  const [hole, setHole] = useState<Rect | null>(null)
  // follow the target every frame (tools lift, panels pop in, the paper zooms, the keyboard moves things)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const r = root.current
      const el = r?.querySelector(`[data-tour="${s.target}"]`)
      let next: Rect | null = null
      if (r && el) {
        const b = el.getBoundingClientRect()
        const p = toLocal(b.left, b.top, r)
        const q = toLocal(b.right, b.bottom, r)
        next = { x: Math.min(p.x, q.x) - 6, y: Math.min(p.y, q.y) - 6, w: Math.abs(q.x - p.x) + 12, h: Math.abs(q.y - p.y) + 12 }
      }
      setHole((o) => (o && next && Math.abs(o.x - next.x) + Math.abs(o.y - next.y) + Math.abs(o.w - next.w) + Math.abs(o.h - next.h) < 0.5) || o === next ? o : next)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [s.target, root])

  const H = root.current?.clientHeight ?? 874
  const W = root.current?.clientWidth ?? 402
  // bubble goes below the lit spot if there's room, else above (the top 40px are off-screen on phones)
  const below = hole && (H - (hole.y + hole.h) >= 150 || H - (hole.y + hole.h) > hole.y - 48)
  // phone: across the screen (20px margins); wider screens: 400px wide, under / over the lit spot
  const BW = Math.min(W - 40, 400)
  const cx = hole ? hole.x + hole.w / 2 : W / 2
  // landscape: when the lit spot leaves no room above or below (the iPad paper is nearly screen-tall), the bubble
  // goes beside it instead, with no arrow
  const side = !!hole && W > 402 && H - (hole.y + hole.h) < 150 && hole.y < 150
  const sideLeft = hole ? (hole.x + hole.w + 24 + BW <= W - 20 ? hole.x + hole.w + 24 : Math.max(20, hole.x - 24 - BW)) : 20
  const bubbleLeft = side ? sideLeft : Math.min(W - BW - 20, Math.max(20, cx - BW / 2))
  const arrow = Math.min(BW - 20, Math.max(20, cx - bubbleLeft))
  const block = 'absolute pointer-events-auto' // touches outside the lit spot do nothing
  return (
    <div className="animate-fade-in pointer-events-none absolute inset-0 z-[45]">
      {hole ? (
        <>
          <div className={block} style={{ left: 0, right: 0, top: 0, height: Math.max(0, hole.y) }} />
          <div className={block} style={{ left: 0, right: 0, top: hole.y + hole.h, bottom: 0 }} />
          <div className={block} style={{ left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.h }} />
          <div className={block} style={{ left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h }} />
          <div
            className="absolute rounded-[14px] border-[3px] border-white"
            style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, boxShadow: '0 0 16px 4px rgba(255,255,255,0.75), 0 0 0 9999px rgba(0,0,0,0.55)' }}
          />
        </>
      ) : (
        <div className={`${block} inset-0 bg-black/55`} />
      )}
      <div
        key={step}
        className="animate-pop-in absolute rounded-[14px] border-[2.5px] border-[#2e2e2e] bg-white px-[16px] pt-[12px] pb-[10px]"
        style={{ left: bubbleLeft, width: BW, ...(!hole ? { top: 160 } : side ? { top: hole.y + hole.h / 2 - 60 } : below ? { top: hole.y + hole.h + 14 } : { bottom: Math.max(0, H - hole.y + 14) }) }}
      >
        {hole && !side && (
          <span
            className={`absolute size-[16px] rotate-45 border-[#2e2e2e] bg-white ${below ? 'top-[-9.5px] border-t-[2.5px] border-l-[2.5px]' : 'bottom-[-9.5px] border-r-[2.5px] border-b-[2.5px]'}`}
            style={{ left: arrow - 8 }}
          />
        )}
        <p className="text-[19px] leading-[1.3]">{tr(s.text)}</p>
        {/* Previous / Next only */}
        <div className="mt-[6px] grid grid-cols-3 items-center text-[16px] text-[#8a8a8a]">
          <span>
            {step > 0 && (
              <button onClick={onPrev} className="pointer-events-auto text-[20px] text-[#2e2e2e] underline underline-offset-4">
                {tr('Previous')}
              </button>
            )}
          </span>
          <span className="text-center">
            {step + 1} / {STEPS.length}
          </span>
          <span className="text-right">
            {/* every step can be moved on by hand; greyed out until the step has what it needs (a line, the memo) */}
            <button
              onClick={() => canNext && onNext()}
              aria-disabled={!canNext || undefined}
              className={`pointer-events-auto text-[20px] underline underline-offset-4 ${canNext ? 'text-[#2e2e2e]' : 'text-[#c4c4c4]'}`}
            >
              {tr(step === STEPS.length - 1 ? 'Done' : 'Next')}
            </button>
          </span>
        </div>
      </div>
      {/* skip: small, out of the way, above the header buttons (the top 40px are off-screen on phones) */}
      <button onClick={onSkip} className={`pointer-events-auto absolute right-[24px] text-[14px] text-white/85 underline underline-offset-2 ${W > 402 ? 'top-[8px]' : 'top-[48px]'}`}>
        {tr('Skip tutorial')}
      </button>
    </div>
  )
}

export default function DrawScreen({ onExit, onFinish, tutorial = false, by }: { onExit: () => void; onFinish: (draft: Draft) => void; tutorial?: boolean; by?: string }) {
  const wide = useWide()
  const [tip, setTip] = useState(tutorial ? 0 : -1)
  const rootRef = useRef<HTMLDivElement>(null)
  // tour step `id` was just done for real → next step
  const done = (id: StepId) => setTip((t) => (STEPS[t]?.id === id ? t + 1 : t))
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
  const [history, setHistory] = useState({ undo: false, redo: false })
  const placeRef = useRef<HTMLInputElement>(null)
  const nickRef = useRef<HTMLInputElement>(null)
  const [mood, setMood] = useState('')
  // starts with the last place used, then switches to the nearest station once location arrives
  const [place, setPlace] = useState(lastPlace)
  const [locating, setLocating] = useState(true)
  const [nickname, setNickname] = useState('')
  const [memo, setMemo] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [thumb, setThumb] = useState('')
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const typedPlace = useRef(false)
  const memoRef = useRef<HTMLTextAreaElement>(null)
  // while typing the nickname/memo, the writing box rides on top of the keyboard (frame px it moves up)
  const writeRef = useRef<HTMLDivElement>(null)
  const [lift, setLift] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    const box = writeRef.current
    if (!vv || !box) return
    const update = () => {
      let next = 0
      if (box.contains(document.activeElement)) {
        // visible bottom (above the keyboard) and the memo's unlifted bottom, both in frame px
        // (offsets ignore the transform, so a lift still animating doesn't skew the measure)
        const ta = memoRef.current!
        const visible = framePoint(0, vv.offsetTop + vv.height).y
        const bottom = framePoint(0, box.offsetParent!.getBoundingClientRect().top).y + box.offsetTop + ta.offsetTop + ta.offsetHeight
        next = Math.min(0, visible - 12 - bottom)
      }
      setLift(next)
    }
    const later = () => setTimeout(update, 0)
    box.addEventListener('focusin', update)
    box.addEventListener('focusout', later)
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      box.removeEventListener('focusin', update)
      box.removeEventListener('focusout', later)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      setLift(0)
    }
  }, [tab, preview])

  useEffect(() => {
    locatePlace().then((p) => {
      if (p && !typedPlace.current) setPlace(p)
      setLocating(false)
    })
  }, [])

  // event log (admin → Stats): one row each time the screen changes state, plus every stroke and tool choice
  const session = useRef(crypto.randomUUID()).current
  const log = (event: string, data?: Record<string, unknown>) => logEvent(event, data, session)
  const state = preview ? 'confirm' : tab
  useEffect(() => {
    const sync = () => log(document.hidden ? 'hidden' : state)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  const strokes = () => canvas.current?.strokeCount() ?? 0
  const colorAtOpen = useRef('') // color when the panel opened: one color_pick per visit, not per drag
  const exit = () => {
    log('exit', { stage: state, strokes: strokes() })
    onExit()
  }

  const draft = (image: string): Draft => ({ image, thumb: thumb || undefined, mood, place: place.trim(), nickname: nickname.trim(), memo: memo.trim(), by: by || undefined })

  function back() {
    if (preview) return setPreview(null)
    if (empty && !nickname && !memo && !mood) return exit()
    setPopup({
      message: tr('Discard this drawing?'),
      actions: [
        { label: tr('Discard'), onClick: exit },
        { label: tr('Cancel'), onClick: () => setPopup(null) },
      ],
    })
  }

  const [showMissing, setShowMissing] = useState(false)
  const missing = [!mood && 'mood', !place.trim() && 'place', !nickname.trim() && 'nickname', !memo.trim() && 'memo'].filter(Boolean)
  const dashed = (name: string) => (showMissing && missing.includes(name) ? 'border-[#d9534f] bg-[#fdeceb]/90' : 'border-[#707070] bg-white/70')

  async function check() {
    if (canvas.current?.isEmpty()) {
      return setPopup({ message: tr('Draw at least one line first.'), actions: [{ label: tr('Got it!'), onClick: () => setPopup(null) }] })
    }
    // every Memo field is required: jump to Memo and mark what's empty
    if (missing.length) {
      setTab('memo')
      setOpen(null)
      setShowMissing(true)
      return
    }
    // unpainted spots inside the figure become white (they looked white on the paper)
    const { thumb, preview } = await waiting(
      (async () => {
        const blob = await fillInside(await canvas.current!.toBlob())
        return { thumb: await toThumb(blob), preview: await toDataUrl(blob) }
      })(),
    )
    setThumb(thumb)
    setPreview(preview)
    done('finish')
  }

  function pickTool(t: Tool) {
    setPicking(false)
    if (tool === t) {
      if (open !== 'size') log('size_open', { tool: t })
      setOpen(open === 'size' ? null : 'size')
      if (open !== 'size') done('size-open')
    } else {
      log('tool_pick', { tool: t, from: tool })
      setTool(t)
      setOpen(null)
    }
  }

  // Next / Previous in the tour: open or close panels so the screen matches the step (a skipped tap left
  // the size bubble / color panel in the wrong state). 'fit' needs a zoom, so it's passed over without one.
  function goStep(t: number, dir: 1 | -1) {
    if (STEPS[tip]?.id === 'fit') canvas.current?.resetView() // leaving "normal size" puts the paper back too
    const id = STEPS[t]?.id
    if (id === 'fit' && !zoomed) return goStep(t + dir, dir)
    if (id !== 'back' && id !== 'finish') setTab(id === 'memo-fill' ? 'memo' : 'draw')
    setPicking(false)
    if (id === 'color-pick') colorAtOpen.current = color
    setOpen(id === 'size-pick' ? 'size' : id === 'color-pick' ? 'color' : null)
    setTip(t)
  }

  const g = { ...TOOLS[tool], ...(wide ? WIDE_TOOLS[tool] : {}) }
  const step = STEPS[tip]?.id
  // the fit button only exists while zoomed: no zoom (Next was used) → nothing to reset
  useEffect(() => {
    if (step === 'fit' && !zoomed) done('fit')
  })

  return (
    <div ref={rootRef} className="relative h-full touch-none overflow-hidden bg-[#f0f0f0] font-hand">
      {/* card-sized paper: two fingers zoom, tilt and move the whole card (it can go past the screen) */}
      <div
        data-tour="paper"
        className={`absolute transition-transform duration-300 ${wide ? '' : 'top-[145px] left-[21px] h-[515px] w-[360px]'}`}
        style={wide ? { left: WIDE_PAPER.left, top: WIDE_PAPER.top, width: WIDE_PAPER.w, height: WIDE_PAPER.h, transform: tab === 'memo' ? `translateX(${WIDE_PAPER.memoShift}px)` : undefined } : tab === 'draw' ? shrink(515) : undefined}
      >
        <DrawingCanvas
          ref={canvas}
          tool={tool}
          color={color}
          size={size}
          guide={guide && tab === 'draw'}
          picking={picking}
          onPick={(c) => {
            log('color_pick', { tool: colorTool, color: c, eyedropper: true })
            setColor(c)
            setPicking(false)
          }}
          onZoom={setZoomed}
          onLog={log}
          onChange={() => {
            const c = canvas.current
            setEmpty(!!c?.isEmpty())
            setHistory({ undo: !!c?.canUndo(), redo: !!c?.canRedo() })
          }}
          paperClassName="rounded-[14px]"
          paper={<PaperFrame />}
        >
          {empty && tab === 'draw' && <p className={`pointer-events-none absolute inset-x-0 text-center text-[25px] tracking-[-0.5px] ${wide ? 'top-[328px]' : 'top-[241px]'}`}>{tr('A few lines will do!')}</p>}
        </DrawingCanvas>
      </div>

      {/* header */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-[#f0f0f0] to-[#f0f0f0]/0 ${wide ? 'h-[100px]' : 'h-[135px]'}`} />
      <button aria-label={tr('Back')} onClick={back} className={`absolute z-20 size-[50px] ${wide ? 'top-[30px] left-[40px]' : 'top-[75px] left-[24px]'}`}>
        <img src={backIcon} alt="" className="size-full" />
      </button>
      {(['draw', 'memo'] as const).map((t) => (
        <button
          key={t}
          onClick={() => {
            setTab(t)
            setOpen(null)
            setPicking(false)
            if (t === 'memo') {
              canvas.current?.resetView()
              done('memo')
            }
          }}
          aria-pressed={tab === t}
          data-tour={t === 'memo' ? 'memo' : undefined}
          className={`absolute z-20 -translate-x-1/2 text-[24px] leading-[1.3] ${wide ? 'top-[40px]' : 'top-[86px]'}`}
          style={{ left: wide ? (t === 'draw' ? 561 : 649) : t === 'draw' ? 154 : 242.5 }}
        >
          {tr(t === 'draw' ? 'Drawing' : 'Memo')}
        </button>
      ))}
      <img
        src={tab === 'draw' ? lineDraw : lineMemo}
        alt=""
        className={`pointer-events-none absolute z-20 h-[3px] max-w-none ${wide ? 'top-[69px]' : 'top-[113px]'}`}
        style={wide ? (tab === 'draw' ? { left: 515, width: 92 } : { left: 619, width: 60 }) : tab === 'draw' ? { left: 116, width: 76 } : { left: 215, width: 55 }}
      />
      <button
        aria-label={tr('Finish drawing')}
        data-tour="finish"
        onClick={check}
        className={`absolute z-20 size-[50px] ${wide ? 'top-[30px] right-[40px]' : 'top-[75px] right-[24px]'}`}>
        <img src={checkIcon} alt="" className="size-full" />
      </button>

      {/* memo: dims everything (header stays tappable through it) */}
      {tab === 'memo' && !preview && (
        <>
          {!wide && <div className="animate-fade-in pointer-events-none absolute inset-0 z-10 bg-black/35 backdrop-blur-[1.5px]" />}
          <div className={`absolute z-20 ${wide ? 'animate-fade-in h-[700px] w-[402px]' : 'inset-0 top-[140px]'}`} style={wide ? { left: 637.8, top: 134.5 } : undefined}>
            <div data-tour="memo-fill" className="pointer-events-none absolute top-0 left-[16px] h-[520px] w-[370px]" />
            {/* folder-tab box around the moods (Figma 787:3578 Vector 413) */}
            <img src={moodBox} alt="" className="pointer-events-none absolute top-[10.5px] left-[21px] h-[226.5px] w-[367px] max-w-none -scale-y-100" />
            <span className={`absolute top-[27px] left-[68px] text-[21px] leading-[1.1] tracking-[-0.63px] ${showMissing && !mood ? 'text-[#d9534f]' : 'text-[#3d3d3d]'}`}>{tr('Mood')}</span>
            <label onClick={() => placeRef.current?.focus()} className={`absolute flex ${wide ? 'top-[-30.5px] right-[16px]' : 'top-[11px] right-[25px]'} cursor-text rounded-[10px] border-2 border-dashed px-[7px] py-[5px] ${dashed('place')}`}>
              {/* the box hugs the typed text: an invisible copy of the text sets the width, the input fills it */}
              <span className="relative inline-grid max-w-[220px] text-[17px] leading-[1.1] tracking-[-0.34px]">
                <span aria-hidden className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre">{(place || tr(locating ? 'Finding where you are…' : 'Where are you?')) + ' '}</span>
                <input
                  value={place}
                  onChange={(e) => {
                    typedPlace.current = true
                    setPlace(e.target.value)
                  }}
                  placeholder={tr(locating ? 'Finding where you are…' : 'Where are you?')}
                  maxLength={30}
                  aria-label={tr('Place')}
                  ref={placeRef}
                  size={1}
                  className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-right outline-none text-[#3d3d3d] placeholder:text-[#777]"
                />
              </span>
            </label>
            <div className="absolute top-[69px] left-[36px] grid w-[327px] grid-cols-3 gap-x-[9.35px] gap-y-[13.36px]">
              {MOODS.map((m, i) => {
                const on = mood === m.name
                return (
                  <button key={m.name} aria-pressed={on} onClick={() => setMood(on ? '' : m.name)} className="relative h-[40px] transition-transform active:scale-95">
                    <span className="absolute inset-[-2.5%_-1%]">
                      {on ? <ChipShape on i={i} color={m.color} /> : <img src={i % 3 === 1 ? chipW2 : chipW1} alt="" className="size-full" />}
                    </span>
                    <span className={`relative text-[19px] leading-[1.1] ${on ? '' : 'text-[#3d3d3d]'}`} style={on ? { color: m.ink } : undefined}>{tr(m.name)}</span>
                  </button>
                )
              })}
            </div>
            {/* the whole lower area starts writing the memo */}
            <div
              ref={writeRef}
              data-own-keyboard
              onClick={() => memoRef.current?.focus()}
              className={`absolute top-[262px] left-[21px] flex h-[258px] w-[360px] cursor-text flex-col items-start gap-[10px] rounded-[10px] p-[10px] transition-transform duration-200 ${lift ? 'bg-[#f0f0f0] shadow-[0_-2px_12px_rgba(0,0,0,0.15)]' : ''}`}
              style={lift ? { transform: `translateY(${lift}px)` } : undefined}
            >
              <label className={`flex cursor-text rounded-[10px] border-2 border-dashed px-[7px] py-[5px] ${dashed('nickname')}`} onClick={(e) => {
                e.stopPropagation()
                nickRef.current?.focus()
              }}>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={tr('Nickname')}
                  maxLength={24}
                  aria-label={tr('Nickname')}
                  ref={nickRef}
                  size={Math.max(8, nickname.length + 1)}
                  className="max-w-[320px] bg-transparent text-[21px] leading-[1.1] tracking-[-0.42px] text-[#3d3d3d] outline-none placeholder:text-[#3d3d3d]"
                />
              </label>
              <textarea
                value={memo}
                ref={memoRef}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={tr('Save the moment.')}
                maxLength={180}
                aria-label={tr('Memo')}
                className={`h-[86px] w-full resize-none rounded-[10px] border-2 border-dashed px-[7px] py-[5px] text-[17px] leading-[1.15] tracking-[-0.34px] text-[#3d3d3d] outline-none placeholder:text-[#3d3d3d] ${dashed('memo')}`}
              />
            </div>
          </div>
        </>
      )}

      {/* toolbar */}
      {tab === 'draw' && (
        <Bottom>
          <div className="pointer-events-none absolute top-[704px] left-0 h-[170px] rounded-t-[20px] bg-gradient-to-b from-[#f0f0f0]/0 to-[#f0f0f0]" style={{ width: wide ? 1194 : 402 }} />
          {(['pen', 'highlighter', 'eraser'] as const).map((t) => {
            const s = { ...TOOLS[t], ...(wide ? WIDE_TOOLS[t] : {}) }
            return (
              <button
                key={t}
                aria-label={tr(t === 'pen' ? 'Pencil' : t === 'highlighter' ? 'Highlighter' : 'Eraser')}
                aria-pressed={tool === t}
                data-tour={t === 'pen' ? 'pen' : undefined}
                onClick={() => pickTool(t)}
                className="absolute transition-transform duration-300 ease-[var(--ease-spring)]"
                style={{ left: s.left, top: s.top, width: s.w, height: s.h, transform: `translateY(${tool === t ? -s.up : 0}px)` }}
              >
                {t === 'pen' ? <PenV2 color={settings.pen.color} /> : t === 'highlighter' ? <HighlighterV2 color={settings.highlighter.color} /> : <EraserV2 />}
              </button>
            )
          })}
          <button aria-label={tr('Undo')} onClick={() => canvas.current?.undo()} className="absolute top-[801px] h-[24.6px] w-[22.7px]" style={{ left: wide ? WIDE_BAR.undo : 201 }}>
            <UndoV2 on={history.undo} />
          </button>
          <button aria-label={tr('Redo')} onClick={() => canvas.current?.redo()} className="absolute top-[799px] h-[27.7px] w-[20.2px]" style={{ left: wide ? WIDE_BAR.redo : 239.7 }}>
            <RedoV2 on={history.redo} />
          </button>
          <button
            onClick={() => {
              setGuide(!guide)
              done('guide')
            }}
            data-tour="guide"
            aria-pressed={guide} aria-label={tr('Guide')} className="absolute top-[774px] h-[63px] w-[68px]" style={{ left: wide ? WIDE_BAR.guide : 268 }}>
            <span className="absolute inset-x-[-14px] top-0 text-center text-[25px] leading-[normal] tracking-[-0.5px] whitespace-nowrap">{tr('Guide')}</span>
            <span className="absolute top-[39px] left-[11px] h-[23px] w-[46px]">
              <ToggleIcon on={guide} />
            </span>
          </button>
          <button
            aria-label={tr('Color')}
            aria-expanded={open === 'color'}
            onClick={() => {
              setPicking(false)
              colorAtOpen.current = color
              setOpen(open === 'color' ? null : 'color')
              if (open !== 'color') done('color-open')
            }}
            data-tour="color"
            className="absolute top-[793px] h-[38.4px] w-[38.8px]"
            style={{ left: wide ? WIDE_BAR.color : 344.7 }}
          >
            <ColorWheelV2 color={color} />
          </button>

          {/* thickness: 5 steps in a bubble above the picked tool */}
          {open === 'size' && (
            <div data-tour="sizes" className="animate-pop-in absolute top-[713px] h-[43.6px] w-[148px]" style={{ left: g.bubble }}>
              <SizeBubbleV2 />
              {SIZES.map((s, i) => {
                const side = [7, 9, 12, 15, 18][i]
                return (
                  <button
                    key={s}
                    aria-label={tr('Size {n}', { n: s })}
                    aria-pressed={size === s}
                    onClick={() => {
                      log('size_pick', { tool, size: s, from: size })
                      setSize(s)
                      setOpen(null)
                      done('size-pick')
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
            <button
              aria-label={tr('Fit drawing')}
              data-tour="fit"
              onClick={() => {
                log('fit')
                canvas.current?.resetView()
                done('fit')
              }}
              className="animate-pop-in absolute top-[705.75px] size-[52.5px]"
              style={{ left: wide ? WIDE_BAR.fit : 328.75 }}>
              {/* Figma drawing 719:10468 Frame 128, no fill */}
              <img src={fitIcon} alt="" className="size-full" />
            </button>
          )}
        </Bottom>
      )}

      {picking && <p className={`animate-fade-in pointer-events-none absolute inset-x-0 z-10 text-center text-[17px] text-[#555] ${wide ? 'top-[80px]' : 'top-[124px]'}`}>{tr('Tap the drawing to pick a color')}</p>}

      {open === 'color' && (
        <ColorPanel
          wide={wide}
          color={color}
          onChange={setColor}
          onClose={() => {
            if (color !== colorAtOpen.current) log('color_pick', { tool: colorTool, color, from: colorAtOpen.current })
            setOpen(null)
            done('color-pick')
          }}
          onEyedropper={() => {
            setOpen(null)
            setPicking(true)
            done('color-pick')
          }}
        />
      )}

      {/* confirm (Figma drawing-handwrite 745:694): card + speech bubble */}
      {/* iPad sideways: the card where the paper was, the bubble and buttons to its right */}
      {preview && wide && (
        <div className="animate-fade-in absolute inset-0 top-[100px] z-30 bg-[#f0f0f0]">
          <div className="absolute top-[4px] w-[488px]" style={{ left: WIDE_PAPER.left + WIDE_PAPER.memoShift + 60 }}>
            <CardView card={{ ...draft(preview), id: 'preview', createdAt: '', serial: '' }} />
          </div>
          <div className="animate-pop-in">
            <span className="absolute top-[230px] left-[700px] h-[122px] w-[368px]">
              <ConfirmBubble />
            </span>
            <p className="absolute top-[246px] left-[885px] w-[370px] -translate-x-1/2 text-center text-[24.3px] leading-[1.2] whitespace-pre-line">
              {tr('Ready to finish?\nYou won’t be able to edit this afterward.')}
            </p>
            <button
              onClick={() => {
                rememberPlace(place.trim())
                log('finish', { mood, strokes: strokes() })
                onFinish(draft(preview))
              }}
              className="absolute top-[325.6px] left-[746px] h-[54.8px] w-[113px]"
            >
              <span className="absolute inset-0 rotate-[-178.73deg]">
                <PillFinish />
              </span>
              <span className="relative text-[24.3px] leading-[1.1]">{tr('Finish')}</span>
            </button>
            <button
              data-tour="go-back"
              onClick={() => {
                setPreview(null)
                done('back')
              }}
              className="absolute top-[323px] left-[903px] h-[58.3px] w-[133.6px]"
            >
              <span className="absolute inset-0 rotate-[-177.79deg]">
                <PillBack />
              </span>
              <span className="relative text-[24.3px] leading-[1.1]">{tr('Go Back')}</span>
            </button>
          </div>
        </div>
      )}
      {preview && !wide && (
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
                <p className="absolute top-[689px] left-[203px] w-[370px] -translate-x-1/2 text-center text-[24.3px] leading-[1.2] whitespace-pre-line">
                  {tr('Ready to finish?\nYou won’t be able to edit this afterward.')}
                </p>
                <button
                  onClick={() => {
                    rememberPlace(place.trim())
                    log('finish', { mood, strokes: strokes() })
                    onFinish(draft(preview))
                  }}
                  className="absolute top-[768.6px] left-[63.8px] h-[54.8px] w-[113px]"
                >
                  <span className="absolute inset-0 rotate-[-178.73deg]">
                    <PillFinish />
                  </span>
                  <span className="relative text-[24.3px] leading-[1.1]">{tr('Finish')}</span>
                </button>
                <button
                  data-tour="go-back"
                  onClick={() => {
                    setPreview(null)
                    done('back')
                  }}
                  className="absolute top-[766px] left-[221px] h-[58.3px] w-[133.6px]"
                >
                  <span className="absolute inset-0 rotate-[-177.79deg]">
                    <PillBack />
                  </span>
                  <span className="relative text-[24.3px] leading-[1.1]">{tr('Go Back')}</span>
                </button>
              </div>
            </Bottom>
          </div>
        </div>
      )}

      {tip >= 0 && tip < STEPS.length && (!preview || step === 'back') && (
        <Tour
          step={tip}
          root={rootRef}
          canNext={step === 'draw' ? !empty : step === 'memo-fill' ? !missing.length : true}
          onPrev={() => {
            if (preview) setPreview(null) // back from the confirm screen to the ✓ step
            goStep(tip - 1, -1)
          }}
          // Next on the ✓ step does what ✓ does (opens the confirm screen, or points at what's missing)
          onNext={() => (step === 'finish' ? check() : goStep(tip + 1, 1))}
          onSkip={() => setTip(STEPS.length)}
        />
      )}
      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}

// Colors panel (Figma Color Picker in 719:10698): spectrum (hue → right, light → top, dark → bottom),
// opacity slider, eyedropper, close.
// iPad sideways: the same panel above the color wheel, at the right
function ColorPanel({ wide, color, onChange, onClose, onEyedropper }: { wide: boolean; color: string; onChange: (c: string) => void; onClose: () => void; onEyedropper: () => void }) {
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
          aria-label={tr('Colors')}
          data-tour="colors"
          className={`animate-pop-in absolute top-[371px] h-[460px] w-[380px] overflow-hidden ${wide ? 'left-[790px]' : 'left-[11px]'} rounded-[20px] bg-white shadow-[0_3px_20px_rgba(0,0,0,0.1)]`}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="absolute inset-x-0 top-[19px] text-center text-[20px] leading-[1.3] text-[#121212]">{tr('Colors')}</p>
          <button aria-label={tr('Pick a color from the drawing')} onClick={onEyedropper} className="absolute top-[14px] left-[13px] flex size-[34px] items-center justify-center">
            <img src={eyedropper} alt="" className="h-[34px] w-[11px] rotate-[42.59deg]" />
          </button>
          <button aria-label={tr('Close')} onClick={onClose} className="absolute top-[18px] left-[349px] flex size-[26px] items-center justify-center">
            <img src={closeDark} alt="" className="h-[15px] w-[12.3px]" />
          </button>
          <div
            ref={spectrum}
            data-quiet // picking a color makes no sound (lib/sound.ts)
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
          <p className="absolute top-[372px] left-[15px] text-[15px] leading-[1.3] uppercase">{tr('Opacity')}</p>
          <div className="absolute top-[396px] left-[15px] flex w-[350px] items-center gap-[11px]">
            <div
              ref={slider}
              data-quiet
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

// Finished card lands with a little burst (sparks stay), then moves in to a town (Figma drawing-finish 1138:2642;
// was 1134:3838, 719:11320). Back leaves it waiting (Draw → back here); Save / Share: components/CardActions.tsx.
export function TadaScreen({ card, onChoose, onBack }: { card: Card; onChoose: () => void; onBack: () => void }) {
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
      <button aria-label={tr('Back')} onClick={onBack} className="absolute top-[75px] left-[24px] z-10 size-[50px]">
        <img src={backIcon} alt="" className="size-full" />
      </button>
      {sparks.map((s, i) => (
        <img key={i} src={s.src} alt="" className="pointer-events-none absolute" style={{ left: s.x, top: s.y, width: s.w, height: s.h, animation: `spark-stay 0.7s ease-out ${0.5 + (i % 3) * 0.12}s both` }} />
      ))}
      <div className="absolute top-[203.6px] left-[50.7px] w-[300px]" style={shrink(470)}>
        <div className="animate-tada drop-shadow-[0_6px_14px_rgba(0,0,0,0.15)]">
          {/* the tada wobble ends at -6°; Figma tilts the card -8.4° */}
          <div className="rotate-[-2.4deg]">
            <CardView card={card} />
          </div>
        </div>
        {/* save / share under the card's lower right — Figma drawing-finish (1138:2642): save (314.2, 656.5), share (347, 657.7),
            minus this box's top-left (50.7, 203.6) and the icons' 5px tap padding; moves and shrinks with the card */}
        <CardActions card={card} gap={0} className="absolute top-[447.9px] left-[258.5px]" />
      </div>
      <Bottom>
        <button onClick={onChoose} className="absolute top-[751px] left-[104.3px] flex h-[53px] w-[185px] items-center justify-center">
          <span className="absolute inset-[-2.22%_-0.44%]">
            <PillVillage />
          </span>
          <span className="relative text-[28px] leading-[1.1] tracking-[-0.28px]">{tr('move in')}</span>
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

// Square thumbnail: the guide's head-and-shoulders area of the card (≈ x 11.3–88.6%, y 0–54% of the paper).
async function toThumb(blob: Blob, side = 200) {
  const bmp = await createImageBitmap(blob)
  const w = bmp.width * 0.773
  const x = bmp.width * 0.113
  const y = 0
  const c = document.createElement('canvas')
  c.width = c.height = side
  c.getContext('2d')!.drawImage(bmp, x, y, w, w, 0, 0, side, side)
  return c.toDataURL('image/png')
}
