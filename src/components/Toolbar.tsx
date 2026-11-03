import { useMemo, useState } from 'react'
import { wobblyCircle, wobblyPoly } from '../lib/sketch'
import SketchBorder from './SketchBorder'
import type { Tool } from './DrawingCanvas'

export const COLORS = ['#000000', '#7a766c', '#ffffff', '#c0392b', '#e67e22', '#f1c40f', '#469015', '#2e86de', '#8e44ad', '#c584c0']
export const SIZES = [2, 4, 8, 14, 22]

// Figma 나은 섹션 "Tool Bar": 손그림 연필 · 형광펜 · 지우개 · 두께 · 색. 폭을 5칸으로 나눈 칸 가운데에 둔다.
const slot = (i: number) => `${((i + 0.5) / 5) * 100}%`
// 도구 그림은 60×140 칸에 그리고 1.4배로 키워 아랫부분은 화면 밖으로 내보낸다
const TOOL_W = 84
const TOOL_H = 196
const SINK = 46
// 고른 도구는 위로 올라온다
const LIFT = 30
// 두께 아이콘 지름 (SIZES 순서)
const DOT = [3, 5, 8, 12, 18]
const WHEEL = 'conic-gradient(from 90deg, #e74c3c, #f1c40f, #2ecc71, #3498db, #9b59b6, #e74c3c)'

type Props = {
  tool: Tool
  size: number
  color: string
  onTool: (tool: Tool) => void
  onSize: (size: number) => void
  onColor: (color: string) => void
}

export default function Toolbar({ tool, size, color, onTool, onSize, onColor }: Props) {
  // 펼친 팝오버: 두께(세로로 선다) 또는 색
  const [open, setOpen] = useState<'size' | 'color' | null>(null)
  const sizeIndex = Math.max(0, SIZES.indexOf(size))
  const paths = useMemo(drawTools, [])

  function pick(next: Tool) {
    onTool(next)
    setOpen(null)
  }

  const toolButton = (name: Tool, label: string, i: number, art: React.ReactNode) => (
    <button
      aria-label={label}
      aria-pressed={tool === name}
      onClick={() => pick(name)}
      className="absolute transition-transform duration-[450ms] ease-spring active:scale-105"
      style={{
        left: slot(i),
        bottom: -SINK,
        width: TOOL_W,
        height: TOOL_H,
        transform: `translateX(-50%) translateY(${tool === name ? -LIFT : 0}px)`,
      }}
    >
      <svg viewBox="0 0 60 140" className="size-full overflow-visible text-pencil" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {art}
      </svg>
    </button>
  )

  return (
    <div className="absolute inset-x-0 bottom-0 h-[120px]">
      {toolButton(
        'pen',
        '연필',
        0,
        <>
          <path d={paths.pencil.body} fill="var(--color-card)" strokeWidth={1.3} />
          <path d={paths.pencil.tip} fill="var(--color-wash)" strokeWidth={1.3} />
          <path d={paths.pencil.lead} fill={color} strokeWidth={1} />
          <path d={paths.pencil.band} strokeWidth={1.3} />
          <path d="M26 60 L26 128 M34 60 L34 128" strokeWidth={0.7} opacity={0.35} />
        </>,
      )}
      {toolButton(
        'highlighter',
        '형광펜',
        1,
        <>
          <path d={paths.highlighter.body} fill="var(--color-card)" strokeWidth={1.3} />
          <path d={paths.highlighter.tip} fill={color} fillOpacity={0.7} strokeWidth={1.3} />
          <path d={paths.highlighter.cap} strokeWidth={1.3} />
          <path d="M22 80 L38 80 M22 86 L38 86" strokeWidth={0.8} opacity={0.4} />
        </>,
      )}
      {toolButton(
        'eraser',
        '지우개',
        2,
        <>
          <path d={paths.eraser.body} fill="var(--color-card)" strokeWidth={1.3} />
          <path d={paths.eraser.line} strokeWidth={1.3} />
          <path d="M8 44 L9 45 M14 41 L15 42 M50 43 L51 44" strokeWidth={1.4} opacity={0.6} />
        </>,
      )}

      {/* 두께: 지금 두께 점 하나, 누르면 5단계가 세로로 펼쳐진다 */}
      <button
        aria-label="두께 고르기"
        aria-expanded={open === 'size'}
        onClick={() => setOpen(open === 'size' ? null : 'size')}
        className="absolute top-[34px] size-[44px] -translate-x-1/2 transition-transform ease-spring active:scale-110"
        style={{ left: slot(3) }}
      >
        <svg viewBox="0 0 44 44" className="size-full text-pencil" aria-hidden>
          <path d={paths.sizeRing} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.35} />
          <circle cx={22} cy={22} r={Math.max(2.5, DOT[sizeIndex] / 2)} fill="currentColor" />
        </svg>
      </button>

      {open === 'size' && (
        <div
          className="absolute bottom-[98px] flex origin-bottom -translate-x-1/2 animate-pop-up flex-col rounded-[12px] bg-card px-[6px] py-[8px] shadow-sticker"
          style={{ left: slot(3) }}
        >
          <SketchBorder w={52} h={206} r={12} seed={421} double={false} />
          {SIZES.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => (
            <button
              key={s}
              aria-label={`두께 ${i + 1}`}
              aria-pressed={size === s}
              onClick={() => {
                onSize(s)
                setOpen(null)
              }}
              className="relative h-[38px] w-[40px]"
            >
              <svg viewBox="0 0 40 38" className="size-full text-pencil" aria-hidden>
                <circle cx={20} cy={19} r={DOT[i] / 2} fill="currentColor" />
                {size === s && <path d={paths.sizeSelected} fill="none" stroke="currentColor" strokeWidth={1.4} />}
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* 색: 무지개 고리 안에 지금 색 */}
      <button
        aria-label="색 고르기"
        aria-expanded={open === 'color'}
        onClick={() => setOpen(open === 'color' ? null : 'color')}
        className="absolute top-[30px] size-[48px] -translate-x-1/2 transition-transform ease-spring active:scale-110"
        style={{ left: slot(4) }}
      >
        <span className="absolute inset-[3px] rounded-full" style={{ background: WHEEL }} />
        <span className="absolute inset-[13px] rounded-full" style={{ background: color }} />
        <svg viewBox="0 0 48 48" className="absolute inset-0 size-full text-pencil" fill="none" stroke="currentColor" aria-hidden>
          <path d={paths.colorRing} strokeWidth={1.3} />
          <path d={paths.colorInner} strokeWidth={1.1} />
        </svg>
      </button>

      {open === 'color' && (
        <ColorPopover
          color={color}
          onColor={(c, done) => {
            onColor(c)
            if (tool === 'eraser') onTool('pen')
            if (done) setOpen(null)
          }}
        />
      )}
    </div>
  )
}

// 색 팝오버: 기본 10색 + 컬러휠(색상)과 밝기 막대로 직접 고르기
function ColorPopover({ color, onColor }: { color: string; onColor: (color: string, done: boolean) => void }) {
  const [hue, setHue] = useState(225)
  const [light, setLight] = useState(45)
  const custom = `hsl(${hue} 55% ${light}%)`
  const swatches = useMemo(() => COLORS.map((_, i) => wobblyCircle(15, 15, 12, 200 + i)), [])
  const ring = useMemo(() => wobblyCircle(15, 15, 15.5, 306, 0.05), [])
  const wheelRing = useMemo(() => wobblyCircle(23, 23, 22, 301, 0.04), [])

  function pickHue(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
    const h = Math.round(((a * 180) / Math.PI + 360) % 360)
    setHue(h)
    onColor(`hsl(${h} 55% ${light}%)`, false)
  }

  return (
    <div className="absolute right-[14px] bottom-[96px] flex origin-[86%_100%] animate-pop-up flex-col gap-[10px] rounded-[12px] bg-card px-[14px] pt-[12px] pb-[14px] shadow-sticker">
      <SketchBorder w={232} h={160} r={12} seed={311} double={false} />
      <div className="grid grid-cols-5 gap-[8px]">
        {COLORS.map((c, i) => (
          <button key={c} aria-label={`색 ${c}`} aria-pressed={color === c} onClick={() => onColor(c, true)} className="relative size-[30px]">
            <svg viewBox="0 0 30 30" className="size-full overflow-visible text-pencil" aria-hidden>
              <path d={swatches[i]} fill={c} stroke="currentColor" strokeWidth={1.1} />
              {color === c && <path d={ring} fill="none" stroke="currentColor" strokeWidth={1.5} />}
            </svg>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-[10px]">
        <div
          role="slider"
          aria-label="색상 고르기"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={hue}
          className="relative size-[46px] shrink-0 touch-none rounded-full"
          style={{ background: WHEEL }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            pickHue(e)
          }}
          onPointerMove={(e) => e.buttons && pickHue(e)}
        >
          <span
            className="absolute size-[9px] -translate-1/2 rounded-full border-[1.5px] border-pencil bg-white"
            style={{ left: `${50 + 36 * Math.cos((hue * Math.PI) / 180)}%`, top: `${50 + 36 * Math.sin((hue * Math.PI) / 180)}%` }}
          />
          <svg viewBox="0 0 46 46" className="pointer-events-none absolute inset-0 size-full text-pencil" fill="none" stroke="currentColor" aria-hidden>
            <path d={wheelRing} strokeWidth={1.2} />
          </svg>
        </div>
        <input
            type="range"
            min={15}
            max={85}
            value={light}
            aria-label="밝기"
            onChange={(e) => {
              const l = Number(e.target.value)
              setLight(l)
              onColor(`hsl(${hue} 55% ${l}%)`, false)
            }}
            className="h-[12px] w-[112px] cursor-pointer appearance-none rounded-full border border-pencil [&::-webkit-slider-thumb]:size-[14px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[1.5px] [&::-webkit-slider-thumb]:border-pencil [&::-webkit-slider-thumb]:bg-card"
            style={{ background: `linear-gradient(to right, #1a1a1a, hsl(${hue} 55% 50%), #fff)` }}
          />
        <button aria-label="직접 고른 색" aria-pressed={color === custom} onClick={() => onColor(custom, true)} className="relative size-[30px] shrink-0">
          <svg viewBox="0 0 30 30" className="size-full overflow-visible text-pencil" aria-hidden>
            <path d={swatches[7]} fill={custom} stroke="currentColor" strokeWidth={1.1} />
            {color === custom && <path d={ring} fill="none" stroke="currentColor" strokeWidth={1.5} />}
          </svg>
        </button>
      </div>
    </div>
  )
}

// 도구 그림 경로 (Figma Tool Bar 와 같은 좌표·시드)
function drawTools() {
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
    sizeRing: wobblyCircle(22, 22, 14, 41, 0.06),
    sizeSelected: wobblyCircle(20, 19, 14, 410, 0.05),
    colorRing: wobblyCircle(24, 24, 21, 50, 0.05),
    colorInner: wobblyCircle(24, 24, 11, 51, 0.08),
  }
}
