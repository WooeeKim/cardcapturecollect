import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { wobblyCircle, wobblyLine } from '../lib/sketch'
import type { Sticker } from '../lib/stickers'
import SketchBorder from './SketchBorder'
import { formatDate } from './StickerFrame'

// Figma 나은 섹션 "Character Card"(250×350)를 그대로 그리고, 놓일 폭에 맞춰 통째로 줄이거나 키운다.
const W = 250
const H = 350

function CardScale({ className = '', children }: { className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = box.current!
    const read = () => setScale(el.clientWidth / W)
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={box} className={`relative aspect-[250/350] ${className}`}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

export const cardNo = (n: number) => String(n).padStart(3, '0')

// 앞면: 첫 만남 태그 · 이름 · 분위기 배지 / 그림 / 번호·장소 띠 / 성격 / 메모
function Front({ sticker, number }: { sticker: Sticker; number: number }) {
  const marks = useMemo(() => ({ energy: [wobblyCircle(6.5, 6.5, 5.6, 10), wobblyCircle(6.5, 6.5, 5.6, 21)], divider: wobblyLine(220, 7) }), [])
  const info = [`No.${cardNo(number)}`, sticker.place || '어딘가에서', formatDate(sticker.createdAt)].join(' · ')
  return (
    <div className="relative flex size-full flex-col gap-[6px] overflow-hidden rounded-[14px] bg-card px-[13px] pt-[14px] pb-[12px] text-pencil shadow-sticker">
      <div className="pointer-events-none absolute inset-[5px]">
        <SketchBorder w={240} h={340} r={11} seed={11} weight={1.5} />
      </div>

      <div className="flex items-center justify-between gap-[6px]">
        <div className="flex min-w-0 items-center gap-[6px]">
          <span className="relative shrink-0 rotate-3 rounded-[8px] bg-wash px-[7px] font-pen text-[14px] leading-[1.25]">
            첫 만남
            <SketchBorder w={50} h={18} r={8} seed={21} weight={1} double={false} />
          </span>
          <span className="truncate font-hand text-[17px] leading-tight font-bold">{sticker.name || '이름 없는 사람'}</span>
        </div>
        <span className="relative flex size-[22px] shrink-0 items-center justify-center rounded-full bg-wash font-pen text-[15px] leading-none">
          {sticker.mood ? sticker.mood[0] : '?'}
          <SketchBorder w={22} h={22} r={11} seed={31} weight={1.1} />
        </span>
      </div>

      <div className="relative h-[180px] shrink-0 overflow-hidden rounded-[4px]" style={{ background: 'color-mix(in srgb, var(--color-wash) 50%, var(--color-card))' }}>
        <img src={sticker.imageUrl} alt="" draggable={false} className="absolute inset-[4px] size-[calc(100%-8px)] object-contain" />
        <SketchBorder w={224} h={180} r={4} seed={41} weight={1.4} />
      </div>

      <div className="relative shrink-0 truncate rounded-full bg-wash px-[8px] py-[2px] text-center text-[7px] leading-normal text-muted">
        {info}
        <SketchBorder w={224} h={14} r={7} seed={51} weight={0.9} double={false} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[6px] px-[2px]">
        {sticker.traits.length === 0 && <p className="font-pen text-[17px] leading-none text-muted">성격은 아직 비밀</p>}
        {sticker.traits.slice(0, 2).map((t, i) => (
          <div key={t} className="flex items-center gap-[8px]">
            <span className="flex w-[28px] gap-[2px]">
              {Array.from({ length: i + 1 }, (_, k) => (
                <svg key={k} viewBox="0 0 13 13" className="size-[13px]" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
                  <path d={marks.energy[k]} strokeWidth={1.1} />
                  <path d="M6.5 3.6 L6.5 9.4 M3.9 5 L9.1 8 M3.9 8 L9.1 5" strokeWidth={0.9} />
                </svg>
              ))}
            </span>
            <span className="font-pen text-[21px] leading-none">{t}</span>
          </div>
        ))}
      </div>

      <svg viewBox="0 -2 220 4" preserveAspectRatio="none" className="h-[4px] w-full shrink-0 overflow-visible" aria-hidden>
        <path d={marks.divider} fill="none" stroke="currentColor" strokeWidth={0.9} opacity={0.7} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="line-clamp-3 min-h-[22px] shrink-0 pl-[60px] text-right font-pen text-[12px] leading-[1.05]">{sticker.memo}</p>
    </div>
  )
}

// 뒷면: 격자 종이 · 선로 두 줄 · 역 표지판
function Back() {
  const rails = useMemo(() => [wobblyLine(250, 3), wobblyLine(250, 5)], [])
  return (
    <div className="relative size-full overflow-hidden rounded-[14px] bg-card text-pencil shadow-sticker">
      <div
        className="absolute inset-[8px]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(58 50 43 / 0.16) 0.6px, transparent 0.6px), linear-gradient(to bottom, rgb(58 50 43 / 0.16) 0.6px, transparent 0.6px)',
          backgroundSize: '31px 44px',
          backgroundPosition: '22px 22px',
        }}
      />
      {rails.map((d, i) => (
        <svg key={i} viewBox="0 -2 250 4" className="absolute inset-x-0 h-[4px] w-full overflow-visible" style={{ top: 163 + i * 20 }} aria-hidden>
          <path d={d} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.9} />
        </svg>
      ))}
      <div className="absolute top-1/2 left-1/2 flex -translate-1/2 items-center gap-[8px] rounded-full bg-card py-[6px] pr-[16px] pl-[6px]">
        <span className="relative flex size-[34px] items-center justify-center rounded-full bg-wash font-hand text-[14px] font-bold">
          001
          <SketchBorder w={34} h={34} r={17} seed={61} weight={1.1} />
        </span>
        <span className="flex flex-col items-center">
          <span className="font-hand text-[18px] leading-none font-bold whitespace-nowrap">Subway Seal</span>
          <span className="font-pen text-[12px] leading-none text-muted">찌 부 씰</span>
        </span>
        <SketchBorder w={150} h={46} r={23} seed={71} weight={1.5} />
      </div>
      <p className="absolute inset-x-0 bottom-[34px] text-center font-pen text-[14px] text-muted">지하철에서 만난 사람들</p>
      <div className="pointer-events-none absolute inset-[5px]">
        <SketchBorder w={240} h={340} r={11} seed={81} weight={1.5} />
      </div>
    </div>
  )
}

// 캐릭터 카드. flipped 면 뒷면이 보인다 (3D 뒤집기).
export default function CharacterCard({
  sticker,
  number,
  flipped = false,
  className = '',
}: {
  sticker: Sticker
  number: number
  flipped?: boolean
  className?: string
}) {
  return (
    <CardScale className={className}>
      <div className="perspective size-full">
        <div className={`flip-inner relative size-full ${flipped ? 'flipped' : ''}`}>
          <div className="flip-face">
            <Front sticker={sticker} number={number} />
          </div>
          <div className="flip-face flip-back">
            <Back />
          </div>
        </div>
      </div>
    </CardScale>
  )
}
