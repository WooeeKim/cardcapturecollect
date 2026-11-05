import { useMemo, useRef, useState } from 'react'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import SketchBorder from '../components/SketchBorder'
import { PaperBackground, TopBar } from '../components/Paper'
import Toolbar, { COLORS, SIZES } from '../components/Toolbar'
import CardDetailScreen from './CardDetailScreen'
import { wobblyRect } from '../lib/sketch'
import type { Sticker } from '../lib/stickers'

// 2:3 카드 폭. Figma 300px. 화면이 낮으면 위(128px)·아래(가이드 줄 + 툴바 약 190px)와 겹치지 않게 높이 기준으로 줄인다.
const CARD_WIDTH = 'min(300px, var(--app-w) - 80px, (var(--app-h) - env(safe-area-inset-top) - 100px - 190px) * 2 / 3)'

// Figma: 02 그리기 (그리기 전 · 그리는 중 · 두께 · 색). 다 그리면 "Leave an impression"로 03 세부사항에 넘어간다.
// 장소·별명·분위기·메모는 넘어간 03 세부사항에서 받아 함께 저장한다.
export default function CanvasScreen({ onSaved, onClose }: { onSaved: (sticker: Sticker) => void; onClose: () => void }) {
  const canvas = useRef<DrawingCanvasHandle>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [guide, setGuide] = useState(readGuidePref)
  // 상세 입력으로 넘긴 그림. 있으면 상세 화면을 위에 띄운다.
  const [image, setImage] = useState<Blob | null>(null)
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState({ inked: false, canUndo: false, canRedo: false })
  const track = useMemo(() => wobblyRect(30, 16, 8, 611, 0.4), [])

  // 다음: 그림을 이미지로 떠서 상세 입력 화면으로. 그림은 그대로 두어 "뒤로" 오면 이어 그릴 수 있다.
  async function next() {
    if (!canvas.current || canvas.current.isEmpty()) {
      setMessage('Draw something first')
      return
    }
    setMessage('')
    try {
      setImage(await canvas.current.toBlob())
    } catch (e) {
      setMessage(`Couldn’t capture the drawing: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div className="relative h-full overflow-hidden">
      <PaperBackground />
      <TopBar left="Close" title="Draw a Card" right="" onLeft={onClose} />

      <div className="absolute top-[calc(env(safe-area-inset-top)+100px)] left-1/2 -translate-x-1/2" style={{ width: CARD_WIDTH }}>
        {/* 그리는 카드 (2:3 도화지) */}
        <div className="relative aspect-[2/3] rounded-[12px] bg-card shadow-sticker">
          <div className="absolute inset-[6px] overflow-hidden rounded-[8px]">
            <DrawingCanvas ref={canvas} tool={tool} color={color} size={size} guide={guide} onHistory={setHistory} />
            {!history.inked && <p className="pointer-events-none absolute inset-x-0 top-[46%] text-center font-pen text-[24px] leading-none">A few lines will do!</p>}
          </div>
          <SketchBorder w={300} h={450} r={12} seed={501} weight={1.5} />
        </div>

        {/* 가이드 켜기/끄기 · 날짜 */}
        <div className="mt-[14px] flex items-center justify-between text-pencil">
          <button
            type="button"
            role="switch"
            aria-checked={guide}
            onClick={() => {
              setGuide(!guide)
              writeGuidePref(!guide)
            }}
            className="-my-[6px] flex items-center gap-[6px] py-[6px] pr-[8px]"
          >
            <svg viewBox="-1 -1 32 18" className="h-[18px] w-[32px] overflow-visible" aria-hidden>
              <path d={track} fill={guide ? 'var(--color-wash)' : 'none'} stroke="currentColor" strokeWidth={1.2} />
              <circle cx={8} cy={8} r={5} fill="currentColor" className="transition-transform duration-300 ease-spring" style={{ transform: guide ? 'translateX(14px)' : undefined }} />
            </svg>
            <span className="font-pen text-[20px] leading-none">Guide</span>
          </button>
          <button onClick={next} className="font-pen text-[22px] leading-none underline decoration-1 underline-offset-[6px]">
            Leave an impression
          </button>
        </div>
        {message && <p className="pt-2 text-center font-pen text-[18px] text-muted">{message}</p>}
      </div>

      <Toolbar
        tool={tool}
        size={size}
        color={color}
        onTool={setTool}
        onSize={setSize}
        onColor={setColor}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => canvas.current?.undo()}
        onRedo={() => canvas.current?.redo()}
      />

      {image && (
        <CardDetailScreen
          image={image}
          onBack={() => setImage(null)}
          onSaved={(sticker) => {
            canvas.current?.clear()
            setImage(null)
            onSaved(sticker)
          }}
        />
      )}
    </div>
  )
}

// 가이드 켜짐/꺼짐을 기기에 기억해 둔다 (저장소를 못 쓰는 환경이면 기본값 켜짐)
const GUIDE_KEY = 'subwayseal.figureGuide'

function readGuidePref() {
  try {
    return localStorage.getItem(GUIDE_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeGuidePref(on: boolean) {
  try {
    localStorage.setItem(GUIDE_KEY, on ? 'on' : 'off')
  } catch {
    // 시크릿 모드 등 — 이번 세션에서만 유지된다
  }
}
