import { useState } from 'react'
import colorRing from '../assets/figma/color-ring.svg'
import colorScribble from '../assets/figma/color-scribble.svg'
import eraserBody from '../assets/figma/eraser-body.svg'
import eraserLine1 from '../assets/figma/eraser-line1.svg'
import eraserLine2 from '../assets/figma/eraser-line2.svg'
import pencilBand from '../assets/figma/pencil-band.svg'
import pencilBody from '../assets/figma/pencil-body.svg'
import pencilLead from '../assets/figma/pencil-lead.svg'
import pencilLead2 from '../assets/figma/pencil-lead2.svg'
import pencilTip from '../assets/figma/pencil-tip.svg'
import size1 from '../assets/figma/size1.svg'
import size2 from '../assets/figma/size2.svg'
import size3 from '../assets/figma/size3.svg'
import size4 from '../assets/figma/size4.svg'
import size5 from '../assets/figma/size5.svg'
import highlighterBand from '../assets/figma/highlighter-band.svg'
import highlighterBody from '../assets/figma/highlighter-body.svg'
import highlighterCap from '../assets/figma/highlighter-cap.svg'
import highlighterTip from '../assets/figma/highlighter-tip.svg'
import type { Tool } from './DrawingCanvas'

export const COLORS = ['#000000', '#7a766c', '#ffffff', '#c0392b', '#e67e22', '#f1c40f', '#469015', '#2e86de', '#8e44ad', '#c584c0']
export const SIZES = [2, 4, 8, 14, 22]

// Figma 툴바 영역: 화면 아래 402×115 (프레임 y 760~875). x는 402 기준 비율, 크기는 px 그대로.
const pct = (x: number) => `${(x / 402) * 100}%`

// Figma 벡터 한 조각: 박스 위치/크기 + 획 두께만큼 바깥으로 넓힌 inset
function Vec({ src, x, y, w, h, inset }: { src: string; x: number; y: number; w: number; h: number; inset: string }) {
  return (
    <span className="absolute" style={{ left: x, top: y, width: w, height: h }}>
      <span className="absolute" style={{ inset }}>
        <img src={src} alt="" className="block size-full max-w-none" draggable={false} />
      </span>
    </span>
  )
}

const SIZE_ICONS = [
  { src: size1, x: 158.9, y: 52, w: 6.257, h: 6.561, inset: '-15.24% -15.98% -15.24% -15.97%' },
  { src: size2, x: 180.16, y: 48, w: 13.366, h: 11.864, inset: '-8.43% -7.48%' },
  { src: size3, x: 208.53, y: 43, w: 22.076, h: 19.735, inset: '-5.07% -4.53% -5.08% -4.53%' },
  { src: size4, x: 245.6, y: 38, w: 24, h: 27, inset: '-3.7% -4.17%' },
  { src: size5, x: 284.6, y: 31, w: 36, h: 39, inset: '-2.56% -2.78%' },
]

// 고른 도구는 위로 올라와 있다 (Figma 기본 상태: 연필이 올라와 있음)
const LIFT = 24

type Props = {
  tool: Tool
  size: number
  color: string
  onTool: (tool: Tool) => void
  onSize: (size: number) => void
  onColor: (color: string) => void
}

export default function Toolbar({ tool, size, color, onTool, onSize, onColor }: Props) {
  const [picking, setPicking] = useState(false)

  return (
    <div className="absolute inset-x-0 bottom-0 h-[115px]">
      {/* 연필 */}
      <button
        aria-label="펜"
        onClick={() => onTool('pen')}
        className="absolute top-0 h-[115px] w-[39.5px] transition-transform"
        style={{ left: pct(22.5), transform: `translateY(${tool === 'pen' ? 0 : LIFT}px)` }}
      >
        <Vec src={pencilBody} x={0} y={33} w={39.5} h={82} inset="-1.22% -2.53%" />
        <Vec src={pencilTip} x={7.5} y={0} w={30} h={33} inset="-3.03% -3.33%" />
        <Vec src={pencilLead} x={23.5} y={2} w={4} h={5} inset="-20% -25%" />
        <Vec src={pencilBand} x={7.5} y={33} w={28} h={13} inset="-7.69% -3.57%" />
        <Vec src={pencilLead2} x={21.86} y={0.17} w={4.543} h={5.346} inset="-18.71% -22.01% -18.7% -22.01%" />
      </button>

      {/* 형광펜 */}
      <button
        aria-label="형광펜"
        onClick={() => onTool('highlighter')}
        className="absolute top-0 h-[115px] w-[36px] transition-transform"
        style={{ left: pct(52), transform: `translateY(${tool === 'highlighter' ? 0 : LIFT}px)` }}
      >
        <Vec src={highlighterBody} x={0} y={25} w={36} h={90} inset="-1.4% -2.8%" />
        <Vec src={highlighterTip} x={4} y={0} w={28} h={22} inset="-3.6% -3.6%" />
        <Vec src={highlighterCap} x={2} y={25} w={32} h={18} inset="-3.1% -3.1%" />
        <Vec src={highlighterBand} x={3} y={60} w={30} h={10} inset="-3.3% -10%" />
        {/* 색 표시: 몸통에 반투명 오버레이 */}
        <span className="absolute rounded-[3px] opacity-40" style={{ left: 5, top: 43, width: 26, height: 55, background: color }} />
      </button>

      {/* 지우개 */}
      <button
        aria-label="지우개"
        onClick={() => onTool('eraser')}
        className="absolute top-[37px] h-[77px] w-[67px] transition-transform"
        style={{ left: pct(80), transform: `translateY(${tool === 'eraser' ? -LIFT : 0}px)` }}
      >
        <Vec src={eraserBody} x={0} y={0} w={67} h={77} inset="-1.3% -1.49%" />
        <Vec src={eraserLine1} x={1} y={25} w={53} h={0} inset="-1px -1.89%" />
        <Vec src={eraserLine2} x={0} y={33} w={61} h={0} inset="-1px -1.64%" />
      </button>

      {/* 두께 */}
      {SIZE_ICONS.map((icon, i) => {
        const cx = icon.x + icon.w / 2
        return (
          <button
            key={i}
            aria-label={`두께 ${i + 1}`}
            aria-pressed={size === SIZES[i]}
            onClick={() => onSize(SIZES[i])}
            className="absolute top-[22px] h-[56px] w-[36px] -translate-x-1/2"
            style={{ left: pct(cx) }}
          >
            <Vec src={icon.src} x={18 - icon.w / 2} y={icon.y - 22} w={icon.w} h={icon.h} inset={icon.inset} />
            {size === SIZES[i] && <span className="absolute bottom-0 left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-line" />}
          </button>
        )
      })}

      {/* 색 */}
      <button
        aria-label="색 고르기"
        onClick={() => setPicking((p) => !p)}
        className="absolute top-[32.99px] h-[38.417px] w-[38.794px]"
        style={{ left: pct(344.74) }}
      >
        <Vec src={colorRing} x={0} y={0} w={38.794} h={38.417} inset="-2.6% -2.58%" />
        <span className="absolute flex h-[27.571px] w-[30.117px] items-center justify-center" style={{ left: 5.26, top: 5.01 }}>
          <span className="relative h-[27px] w-[24px] flex-none rotate-[81.89deg]">
            <span className="absolute" style={{ inset: '-3.7% -4.17%' }}>
              <img src={colorScribble} alt="" className="block size-full max-w-none" draggable={false} />
            </span>
          </span>
        </span>
      </button>

      {picking && (
        <div className="absolute right-[12px] bottom-[96px] grid grid-cols-5 gap-[10px] rounded-[3px] bg-white p-[12px] shadow-sticker">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`색 ${c}`}
              onClick={() => {
                onColor(c)
                if (tool === 'eraser') onTool('pen')
                setPicking(false)
              }}
              className={`size-[28px] rounded-full border-[1.5px] ${color === c ? 'border-line' : 'border-paper'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
