import { useMemo, type ReactNode } from 'react'
import { wobblyCircle } from '../lib/sketch'
import { moodOf } from '../lib/moods'
import type { Card } from '../lib/store'

// ---------- line icons (thin strokes like the Figma frames) ----------

const icon = 'fill-none stroke-current stroke-[2.2] [stroke-linecap:round] [stroke-linejoin:round]'

export function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className={`size-[30px] ${icon}`} aria-hidden>
      <path d="M15 3 L6 12 L15 21" />
    </svg>
  )
}
export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className={`size-[30px] ${icon}`} aria-hidden>
      <path d="M12 2 V22 M2 12 H22" />
    </svg>
  )
}
export function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className={icon} aria-hidden>
      <path d="M4 4 L20 20 M20 4 L4 20" />
    </svg>
  )
}
export function HandleIcon() {
  return (
    <svg viewBox="0 0 24 24" className={`size-[22px] ${icon}`} aria-hidden>
      <path d="M4 9 H20 M4 15 H20" />
    </svg>
  )
}
export function CheckIcon() {
  return (
    <svg viewBox="0 0 40 40" className={`size-[34px] ${icon}`} aria-hidden>
      <path d="M4 20 C8 24 10 30 13 36 C18 22 26 10 37 3" />
    </svg>
  )
}

// Underlined text button (Figma: "Edit", "Done", "Got it!" …)
export function TextButton({ children, onClick, dim = false, className = '' }: { children: ReactNode; onClick: () => void; dim?: boolean; className?: string }) {
  return (
    <button onClick={onClick} className={`font-hand underline decoration-[1.5px] underline-offset-[5px] ${dim ? 'text-[#777]' : ''} ${className}`}>
      {children}
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

export function Thumb({ image, size = 70, seed = 1, strong = false, grey = false }: { image?: string; size?: number; seed?: number; strong?: boolean; grey?: boolean }) {
  const ring = useMemo(() => wobblyCircle(50, 50, 45, seed, 0.06), [seed])
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inset-[8%] overflow-hidden rounded-full bg-white">
        {image ? (
          <img src={image} alt="" className={`size-full object-cover object-top ${grey ? 'grayscale' : ''}`} />
        ) : (
          <span className="flex size-full items-center justify-center font-hand text-[34px]" style={{ fontSize: size * 0.5 }}>
            ?
          </span>
        )}
      </span>
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
        <path d={ring} fill="none" stroke={strong ? '#5a5a5a' : '#c8c8c8'} strokeWidth={strong ? 9 : 8} strokeLinecap="round" />
      </svg>
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
