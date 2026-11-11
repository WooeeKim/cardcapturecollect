import xIcon from '../assets/proto/x.svg'
import handleIcon from '../assets/proto/handle.svg'
import goBox from '../assets/proto/gobox.svg'
import backIcon from '../assets/proto/back.svg'
import plusIcon from '../assets/proto/plus.svg'
import underlineSvg from '../assets/proto/underline.svg'
import wifiIcon from '../assets/proto/wifi.svg'
import batteryIcon from '../assets/proto/battery.svg'
import { type ReactNode } from 'react'
import { moodOf } from '../lib/moods'
import type { Card } from '../lib/store'

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
  return (
    <span className="relative block h-[37px] w-[54px]">
      <img src={goBox} alt="" className="absolute inset-0 size-full" />
      <span className="absolute top-[3px] left-[13px] font-hand text-[25px] leading-[normal]">Go</span>
    </span>
  )
}

// Underlined text button (Figma: "Edit", "Done", "Got it!" … hand-drawn underline)
export function TextButton({ children, onClick, dim = false, light = false, className = '', style }: { children: ReactNode; onClick: () => void; dim?: boolean; light?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} className={`${className.includes('absolute') ? '' : 'relative'} font-hand leading-[normal] ${dim ? 'text-[#646464]' : ''} ${className}`} style={style}>
      {children}
      <img src={underlineSvg} alt="" className={`absolute inset-x-[-3px] -bottom-[2px] h-[3px] w-[calc(100%+6px)] max-w-none ${dim ? 'opacity-60' : ''} ${light ? 'invert' : ''}`} />
    </button>
  )
}

// Figma header (townList): back chevron · title · optional right control
export function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <>
      <button aria-label="Back" onClick={onBack} className="absolute top-[72px] left-[17px] z-20 p-[10px]">
        <img src={backIcon} alt="" className="h-[25.3px] w-[16.1px] -scale-x-100" />
      </button>
      <h1 className="pointer-events-none absolute inset-x-0 top-[77px] z-20 text-center font-hand text-[24px] leading-[normal] [-webkit-text-stroke:0.6px_black]">{title}</h1>
      {right}
    </>
  )
}

export function PlusButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button aria-label={label} onClick={onClick} className="absolute top-[72px] left-[344px] z-20 p-[10px]">
      <img src={plusIcon} alt="" className="h-[23.8px] w-[26.8px]" />
    </button>
  )
}

// ---------- popup ----------

export type PopupAction = { label: string; onClick: () => void }

export function Popup({ message, actions }: { message: ReactNode; actions: PopupAction[] }) {
  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex items-center bg-black/35 px-[24px]">
      <div role="dialog" className="animate-pop-in w-full rounded-[14px] bg-[#f0f0f0] px-[20px] pt-[26px] pb-[18px] text-center">
        <p className="font-hand text-[22px] leading-[1.35]">{message}</p>
        <div className="mt-[18px] flex justify-around">
          {actions.map((a) => (
            <TextButton key={a.label} onClick={a.onClick} className="text-[19px]">
              {a.label}
            </TextButton>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- town thumbnail: chief's drawing inside a sketchy ring ----------

export function Thumb({ image, size = 70, strong = false, grey = false }: { image?: string; size?: number; strong?: boolean; grey?: boolean }) {
  // Figma townThumbnail: white circle, 9px #ccc ring (8.5px #686868 when open); drawing zoomed on the upper body
  const ring = strong ? 8.5 : 9
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full bg-white"
      style={{ width: size, height: size, border: `${ring}px solid ${strong ? '#686868' : '#ccc'}` }}
    >
      {image ? (
        <img src={image} alt="" className={`absolute top-[10%] left-[-8%] w-[116%] max-w-none ${grey ? 'mix-blend-luminosity grayscale' : ''}`} />
      ) : (
        <span className="flex size-full items-center justify-center font-hand leading-none" style={{ fontSize: size * 0.55 }}>
          ?
        </span>
      )}
    </span>
  )
}

// ---------- mood chip ----------

export function MoodChip({ mood, size = 21 }: { mood: string; size?: number }) {
  if (!mood) return null
  const m = moodOf(mood)
  return (
    <span className="inline-block rounded-full font-hand leading-[1.1]" style={{ background: m.color, color: m.ink, fontSize: size, padding: `${size * 0.33}px ${size * 0.6}px` }}>
      {mood}
    </span>
  )
}

// ---------- character card (Figma card-example 360×515) ----------

export function CardView({ card, plain = false, onImage }: { card: Card; plain?: boolean; onImage?: () => void }) {
  return (
    <div className="relative aspect-[360/515] w-full overflow-hidden rounded-[12px] bg-[#f0f0f0] font-hand text-black [container-type:inline-size]">
      <button aria-label="Show drawing only" onClick={onImage} className="absolute inset-[3%_4%_6%] block">
        <img src={card.image} alt={card.nickname || 'drawing'} className="size-full object-contain" />
      </button>
      {!plain && (
        <>
          {card.mood && (
            <span className="absolute top-[3.5cqw] left-[5.5cqw]">
              <ChipCq mood={card.mood} />
            </span>
          )}
          {card.place && <span className="absolute top-[5.5cqw] right-[5cqw] text-[3.9cqw] leading-[1.1]">{card.place}</span>}
          {(card.nickname || card.memo) && (
            <div className="absolute inset-x-[2.8cqw] bottom-[8.5cqw] rounded-[2.8cqw] bg-white/70 p-[2.8cqw] backdrop-blur-[2px]">
              {card.nickname && <p className="text-[5.9cqw] leading-[1.1]">{card.nickname}</p>}
              {card.memo && <p className="mt-[2cqw] line-clamp-4 text-[4.7cqw] leading-[1.2] break-words">{card.memo}</p>}
            </div>
          )}
          <span className="absolute right-[4cqw] bottom-[2.5cqw] text-[3.9cqw] leading-[1.1]">{card.serial}</span>
        </>
      )}
    </div>
  )
}

// chip sized in container units so the card scales as one piece
function ChipCq({ mood }: { mood: string }) {
  const m = moodOf(mood)
  return (
    <span className="block rounded-full px-[3.3cqw] py-[1.8cqw] text-[5.8cqw] leading-[1.1]" style={{ background: m.color, color: m.ink }}>
      {mood}
    </span>
  )
}

// ---------- phone chrome from the Figma frames: status bar, home indicator, black bezel ----------


export function PhoneChrome() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[100]">
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
      <span className="absolute inset-0 rounded-[62px] border-[13px] border-black" />
    </div>
  )
}
