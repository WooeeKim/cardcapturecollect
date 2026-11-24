import xIcon from '../assets/proto/x.svg'
import { ConfirmBubble, PillBack, PillFinish } from './v2'
import handleIcon from '../assets/proto/handle.svg'
import goBox from '../assets/proto/v2/go-box.svg'
import backIcon from '../assets/proto/v2/back40.svg'
import plusIcon from '../assets/proto/plus.svg'
import underlineSvg from '../assets/proto/underline.svg'
import wifiIcon from '../assets/proto/wifi.svg'
import batteryIcon from '../assets/proto/battery.svg'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COL_X, useWide } from '../lib/wide'
import { CIRCLE_FRAME, stretchX } from '../lib/lineShapes'
import cardOutline from '../assets/proto/v2/card-outline.svg'
import cardChipRaw from '../assets/proto/v2/card-chip.svg?raw'
import townChipRaw from '../assets/proto/v2/town-chip.svg?raw'
import cardBlurRaw from '../assets/proto/v2/card-blur.svg?raw'
import { moodOf } from '../lib/moods'
import { serialLabel, type Card } from '../lib/store'
import { cycleLang, tr } from '../lib/i18n'
import globe from '../assets/proto/v2/globe.svg'

// ---------- line icons (thin strokes like the Figma frames) ----------

const icon = 'fill-none stroke-current stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]'

export function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className={icon} aria-hidden>
      <path d="M4 4 L20 20 M20 4 L4 20" />
    </svg>
  )
}
export function HandleIcon() {
  return <img src={handleIcon} alt="" className="h-[8.3px] w-[16.1px]" />
}
export function XIcon() {
  return <img src={xIcon} alt="" className="h-[16.8px] w-[14.3px]" />
}
export function GoTag() {
  // Figma 03 마을 목록 › townList-detail (915:885 Vector 538): white rounded hand-drawn box, thick #686868 outline (same as the open chief ring, Thumb strong)
  return (
    <span className="relative block h-[38px] w-[57px]">
      <img src={goBox} alt="" className="absolute top-[-2.5px] left-[-2.5px] h-[43px] w-[62px] max-w-none" />
      <span className="absolute top-[3px] left-[15px] font-hand text-[25px] leading-[normal]">{tr('Go')}</span>
    </span>
  )
}

// Underlined text button (Figma: "Edit", "Done", "Got it!" … hand-drawn underline)
export function TextButton({ children, onClick, dim = false, light = false, className = '', style }: { children: ReactNode; onClick: () => void; dim?: boolean; light?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick} className={`${className.includes('absolute') ? '' : 'relative'} font-hand leading-[normal] ${dim ? 'text-[#646464]' : ''} ${className}`} style={style}>
      {children}
      {/* hand-drawn underline (Figma 00 Components › TextButton): follows the text's width, 4px past each end */}
      <img src={underlineSvg} alt="" className={`absolute left-[-4px] -bottom-[2px] h-[3px] w-[calc(100%+8px)] max-w-none ${dim ? 'opacity-60' : ''} ${light ? 'invert' : ''}`} />
    </button>
  )
}

// Page header, the same on every page (Figma townList / Collection / My Page): back 40×40 at (24, 85), the title
// 24px centred on y 105, the right-hand control 40×40 at (338, 85). iPad sideways: same row at the top of the frame.
export function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  const wide = useWide()
  return (
    <>
      <button aria-label={tr('Back')} onClick={onBack} className={`absolute z-20 size-[40px] ${wide ? 'top-[30px] left-[40px]' : 'top-[85px] left-[24px]'}`}>
        <img src={backIcon} alt="" className="size-full" />
      </button>
      <h1 className={`pointer-events-none absolute inset-x-0 z-20 text-center font-hand text-[24px] leading-[1.3] ${wide ? 'top-[36px]' : 'top-[89px]'}`}>{title}</h1>
      {right}
    </>
  )
}

export function PlusButton({ onClick, label }: { onClick: () => void; label: string }) {
  const wide = useWide()
  return (
    <button aria-label={label} onClick={onClick} className={`absolute z-20 flex size-[40px] items-center justify-center ${wide ? 'top-[30px] left-[1114px]' : 'top-[85px] left-[338px]'}`}>
      <img src={plusIcon} alt="" className="h-[23.8px] w-[26.8px]" />
    </button>
  )
}

// ---------- popup ----------

export type PopupAction = { label: string; onClick: () => void }

// Speech-bubble popup (Figma townList-detail 787:1229 / 787:1304 …): first action = grey left pill
// (Discard / Delete), second = black right pill (Save / Cancel); one action = one pill in the middle.
export function Popup({ message, actions }: { message: ReactNode; actions: PopupAction[] }) {
  const pills = actions.length === 1 ? [{ ...actions[0], x: 134, w: 133.6, h: 58.3, grey: false, rot: -177.79, shape: 'back' as const }] : [
    { ...actions[0], x: 46, w: 113, h: 54.8, grey: true, rot: -178.73, shape: 'finish' as const },
    { ...actions[1], x: 203, w: 133.6, h: 58.3, grey: false, rot: -177.79, shape: 'back' as const },
  ]
  return (
    <OverFrame>
    <div className="animate-fade-in absolute inset-0 z-50 flex items-center justify-center bg-black/35 font-hand">
      <div role="dialog" className="animate-pop-in relative w-[368px] pb-[30px]">
        <div className="relative flex min-h-[122px] items-center justify-center px-[34px] pt-[18px] pb-[34px]">
          <span className="absolute inset-[-0.87%_-0.29%]">
            <ConfirmBubble />
          </span>
          <p className="relative w-[300px] text-center text-[23px] leading-[1.2] whitespace-pre-line">{message}</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[58px]">
          {pills.map((b) => (
            <button key={b.label} onClick={b.onClick} className="absolute bottom-0 flex items-center justify-center" style={{ left: b.x, width: b.w, height: b.h }}>
              <span className="absolute inset-0" style={{ transform: `rotate(${b.rot}deg)` }}>
                {b.shape === 'finish' ? <PillFinish /> : <PillBack />}
              </span>
              <span className={`relative text-[23px] leading-[1.1] ${b.grey ? 'text-[#686868]' : ''}`}>{b.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
    </OverFrame>
  )
}

// iPad sideways: dialogs cover the whole landscape frame, even when opened from a screen that sits in the
// phone-width column (WideCol), so they're moved up to #root.
export function OverFrame({ children }: { children: ReactNode }) {
  const wide = useWide()
  const root = typeof document !== 'undefined' ? document.getElementById('root') : null
  return wide && root ? createPortal(children, root) : <>{children}</>
}

// iPad sideways, for screens with no landscape design: the phone screen in a column in the middle of the
// 1194×834 frame. Shifted up 14px with --cut 56, so phone Figma y 84 lands at 70 and a bottom pill (760) at 690,
// like the iPad 길BTI question frame. `bg` fills the rest of the frame.
export function WideCol({ children, bg = '#f9f9f9' }: { children: ReactNode; bg?: string }) {
  const wide = useWide()
  if (!wide) return <>{children}</>
  return (
    <div className="absolute inset-0" style={{ background: bg }}>
      <div className="absolute top-[-14px] h-[818px] w-[402px]" style={{ left: COL_X, '--cut': 56 } as React.CSSProperties}>
        {children}
      </div>
    </div>
  )
}

// ---------- town thumbnail: chief's drawing inside a sketchy ring ----------

export function Thumb({ image, thumb, size = 70, strong = false, grey = false, ring: ringW, outline = false }: { image?: string; thumb?: string; size?: number; strong?: boolean; grey?: boolean; ring?: number; outline?: boolean }) {
  // Figma townThumbnail: white circle, 9px #ccc ring (8.5px #686868 when open); drawing zoomed on the upper body.
  // The ring is drawn as a slightly wobbly hand-drawn stroke, like the rest of the sketchy UI.
  const ring = ringW ?? (strong ? 8.5 : 9)
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      {/* with the black outline, everything inside it is white (fills the wobble too) */}
      {outline && (
        <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          <path d={CIRCLE_FRAME.d} transform={frameAt(size, size / 2 - ring * 0.75)} fill="#fff" />
        </svg>
      )}
      <span className="absolute overflow-hidden rounded-full bg-white" style={{ inset: ring * 0.75 }}>
        {thumb ? (
          <img src={thumb} alt="" className={`absolute inset-0 size-full object-cover ${grey ? 'mix-blend-luminosity grayscale' : ''}`} />
        ) : image ? (
          <img src={image} alt="" className={`absolute top-[6%] left-[-20%] w-[140%] max-w-none ${grey ? 'mix-blend-luminosity grayscale' : ''}`} />
        ) : (
          <span className="flex size-full items-center justify-center font-hand leading-none" style={{ fontSize: size * 0.55 }}>
            ?
          </span>
        )}
      </span>
      <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        {/* with the black outline, everything inside it is white (no grey ring between) */}
        {!outline && <path d={CIRCLE_FRAME.d} transform={frameAt(size, size / 2 - ring / 2)} fill="none" stroke={strong ? '#686868' : '#ccc'} strokeWidth={ring} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        {/* townList-detail (right): thin black hand-drawn line around the white circle */}
        {outline && (
          <path d={CIRCLE_FRAME.d} transform={frameAt(size, size / 2 - ring * 0.75)} fill="none" stroke="#000" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </span>
  )
}

// The Figma 원형프레임 (lib/lineShapes.ts) scaled to a circle of radius r in the middle of a size × size thumbnail
// (strokes keep their px width through vector-effect)
function frameAt(size: number, r: number) {
  return `translate(${size / 2 - r} ${size / 2 - r}) scale(${(2 * r) / CIRCLE_FRAME.w} ${(2 * r) / CIRCLE_FRAME.h})`
}


// ---------- mood chip ----------

export function MoodChip({ mood, size = 21 }: { mood: string; size?: number }) {
  if (!mood) return null
  const m = moodOf(mood)
  return (
    <span className="inline-block rounded-full font-hand leading-[1.1]" style={{ background: m.color, color: m.ink, fontSize: size, padding: `${size * 0.33}px ${size * 0.6}px` }}>
      {tr(mood)}
    </span>
  )
}

// ---------- hand-drawn shapes that follow their box (Figma 04 콜렉션 › Collection 1207:9008) ----------

const pathOf = (raw: string) => raw.match(/ d="([^"]+)"/)![1]
const CHIP = { d: pathOf(cardChipRaw), w: 72.44, h: 37.1, cap: 18 } // Vector 373: mood chip on the card
const TOWN_CHIP = { d: pathOf(townChipRaw), w: 166, h: 47, cap: 23 } // Vector 538: town chip above the open card
// blur_bg's outline as an opaque mask, so only the blur (not the text) takes its shape
const BLUR_MASK = `url("data:image/svg+xml,${encodeURIComponent(cardBlurRaw.replace(/fill="#F7F7F7"/i, 'fill="#000"').replace(/fill-opacity="[^"]*"/, ''))}")`
const BLUR_FILL = `url("data:image/svg+xml,${encodeURIComponent(cardBlurRaw)}")`

// A pill drawn by hand that keeps its rounded ends whatever its length: fills its (relative) parent, and only the
// straight middle stretches with the parent's width (lib/lineShapes stretchX). Strokes scale with the height.
function StretchPill({ shape, fill, stroke = '#000', strokeWidth = 2, className = '' }: { shape: { d: string; w: number; h: number; cap: number }; fill: string; stroke?: string; strokeWidth?: number; className?: string }) {
  const el = useRef<SVGSVGElement>(null)
  const [ratio, setRatio] = useState(shape.w / shape.h)
  useLayoutEffect(() => {
    const svg = el.current
    if (!svg) return
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect()
      if (width && height) setRatio(width / height)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])
  const len = Math.max(shape.cap * 2 + 2, shape.h * ratio)
  return (
    <svg ref={el} aria-hidden viewBox={`0 0 ${len} ${shape.h}`} preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 size-full overflow-visible ${className}`}>
      <path d={stretchX(shape.d, shape.w, len, shape.cap, shape.cap)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// town chip over an open card (Figma 1207:9188 + 9189 + 9191): grey hand-drawn pill, the chief in a small circle, the name
export function TownChip({ name, image, thumb, className = '', style }: { name: string; image?: string; thumb?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span style={style} className={`flex h-[45px] items-center pr-[19px] pl-[4.5px] font-hand text-[20px] leading-[1.1] text-black ${className}`}>
      {/* the Figma vector is turned 180° */}
      <StretchPill shape={TOWN_CHIP} fill="#CCCCCC" className="rotate-180" />
      <span className="relative">
        <Thumb image={image} thumb={thumb} size={36} ring={2} outline />
      </span>
      <span className="relative ml-[11px] max-w-[220px] truncate">{name}</span>
    </span>
  )
}

// ---------- character card (Figma card-example 360×515; outline, chip and blur box from 04 콜렉션 1207:9008) ----------

export function CardView({ card, plain = false, onImage }: { card: Card; plain?: boolean; onImage?: () => void }) {
  return (
    <div className="relative aspect-[360/515] w-full font-hand text-black [container-type:inline-size]">
      {/* white card inside the same hand-drawn outline as the drawing paper (Vector 421) */}
      <img src={cardOutline} alt="" className="pointer-events-none absolute top-[-0.19%] left-[-0.28%] h-[100.39%] w-[100.56%] max-w-none" />
      <button aria-label={tr('Show drawing only')} onClick={onImage} className="absolute inset-[3%_4%_6%] block">
        <img src={card.image} alt={card.nickname || 'drawing'} className="size-full object-contain" />
      </button>
      {!plain && (
        <>
          {card.mood && (
            <span className="absolute top-[3.06cqw] left-[3.6cqw]">
              <ChipCq mood={card.mood} />
            </span>
          )}
          {card.place && <span className="absolute top-[5.5cqw] right-[4.2cqw] text-[5.5cqw] leading-[1.1] tracking-[-0.02em]">{card.place}</span>}
          {(card.nickname || card.memo) && (
            <div className="absolute inset-x-[2.8cqw] bottom-[8.9cqw] p-[2.8cqw]">
              {/* blur_bg: the blur takes the hand-drawn box's shape, tinted #f7f7f7 at 50% */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 backdrop-blur-[2px]"
                style={{ backgroundImage: BLUR_FILL, backgroundSize: '100% 100%', maskImage: BLUR_MASK, WebkitMaskImage: BLUR_MASK, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }}
              />
              {card.nickname && <p className="relative text-[5.9cqw] leading-[1.1]">{card.nickname}</p>}
              {card.memo && <p className="relative mt-[2cqw] line-clamp-4 text-[4.7cqw] leading-[1.2] break-words">{card.memo}</p>}
            </div>
          )}
          <span className="absolute right-[4cqw] bottom-[2.5cqw] text-[3.9cqw] leading-[1.1]">{serialLabel(card)}</span>
        </>
      )}
    </div>
  )
}

// chip sized in container units so the card scales as one piece; hand-drawn pill (Vector 373) in the mood's colour
function ChipCq({ mood }: { mood: string }) {
  const m = moodOf(mood)
  return (
    <span className="relative block px-[4.5cqw] py-[2.4cqw] text-[4.72cqw] leading-[1.1] tracking-[-0.01em]" style={{ color: m.ink }}>
      <StretchPill shape={CHIP} fill={m.color} />
      <span className="relative">{tr(mood)}</span>
    </span>
  )
}

// ---------- phone chrome from the Figma frames: status bar, home indicator, black bezel ----------


export function PhoneChrome() {
  return (
    <div className="fake-chrome pointer-events-none absolute inset-0 z-[100]">
      <div className="absolute inset-x-0 top-0 flex h-[62px] items-center pt-[3px]">
        <p className="flex-1 pl-[10px] text-center font-[system-ui] text-[17.67px] leading-[22px] font-semibold">9:41</p>
        <span className="h-[37px] w-[125px] rounded-full bg-black" />
        <div className="flex flex-1 items-center justify-center gap-[8px] pr-[10px]">
          <span className="flex items-end gap-[2.33px] pt-[1.3px]">
            {[6.33, 8.67, 11, 13.67].map((h) => (
              <span key={h} className="w-[3.33px] rounded-[4px] bg-black" style={{ height: h }} />
            ))}
          </span>
          <img src={wifiIcon} alt="" className="h-[14.33px] w-[19.33px]" />
          <img src={batteryIcon} alt="" className="h-[13.67px] w-[29.33px]" />
        </div>
      </div>
      <span className="absolute top-[861px] left-[129px] h-[5px] w-[144px] rounded-full bg-[#1a1a1a]" />
    </div>
  )
}

// Pinned to the screen bottom: children keep their Figma (874-tall) `top` values and move up
// by --cut on shorter phones. Zero height, so it never blocks touches itself.
export function Bottom({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 h-0" style={{ top: 'calc(var(--cut) * -1px)' }}>
      {children}
    </div>
  )
}

// Shrinks something `h` px tall (whose bottom is pinned near the Bottom row) on shorter phones.
export const shrink = (h: number): React.CSSProperties => ({
  transform: `scale(clamp(0.5, calc((${h} - var(--cut)) / ${h}), 1))`,
  transformOrigin: 'top center',
})
// `top` that follows the screen bottom (for things that also need bottom: 0)
export const fromBottom = (top: number) => `calc(${top}px - var(--cut) * 1px)`

// A box drawn by hand: each side bows a little and the corners overshoot slightly. Same seed = same shape.
export function SketchyBox({ w, h, seed = 1, stroke = '#000', width = 2.6, className = '' }: { w: number; h: number; seed?: number; stroke?: string; width?: number; className?: string }) {
  const j = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 1.1 // small, stable wobble
  const i = width / 2
  const d = [
    `M${i + j(1)} ${i + 0.6 + j(2)}`,
    `Q${w / 2} ${i - 1.2 + j(3)} ${w - i + j(4)} ${i + j(5)}`,
    `Q${w - i + 1.3 + j(6)} ${h / 2} ${w - i + j(7)} ${h - i + j(8)}`,
    `Q${w / 2} ${h - i + 1.2 + j(9)} ${i + j(10)} ${h - i + j(11)}`,
    `Q${i - 1.3 + j(12)} ${h / 2} ${i + j(13)} ${i + 2 + j(14)}`,
  ].join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`pointer-events-none absolute inset-0 size-full overflow-visible ${className}`} aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Language button (Figma gilbti-intro 925:2832): English ↔ 한국어
export function LangButton({ className = '' }: { className?: string }) {
  return (
    <button aria-label={tr('Change language')} onClick={cycleLang} className={`absolute h-[41px] w-[45px] ${className}`}>
      <img src={globe} alt="" className="size-full" />
    </button>
  )
}
