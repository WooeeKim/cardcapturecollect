import { useMemo, useRef, useState } from 'react'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import SketchBorder from '../components/SketchBorder'
import { PaperBackground, TopBar } from '../components/Paper'
import { formatDate } from '../components/StickerFrame'
import Toolbar, { COLORS, SIZES } from '../components/Toolbar'
import CardDetailScreen from './CardDetailScreen'
import { wobblyRect } from '../lib/sketch'
import type { Sticker } from '../lib/stickers'

// 2:3 카드 폭. Figma 300px. 화면이 낮으면 위(128px)·아래(가이드 줄 + 툴바 약 190px)와 겹치지 않게 높이 기준으로 줄인다.
const CARD_WIDTH = 'min(300px, var(--app-w) - 80px, (var(--app-h) - env(safe-area-inset-top) - 128px - 190px) * 2 / 3)'

// Figma: 나은 섹션 01a 빈 카드 · 01b 그리는 중 · 01c 두께 · 01d 색
// 이름·장소·분위기·성격·메모는 "다음"으로 넘어가는 02 상세 입력 화면에서 받아 함께 저장한다.
export default function CanvasScreen({ onSaved, onClose }: { onSaved: (sticker: Sticker) => void; onClose: () => void }) {
  const canvas = useRef<DrawingCanvasHandle>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [guide, setGuide] = useState(readGuidePref)
  // 상세 입력으로 넘긴 그림. 있으면 상세 화면을 위에 띄운다.
  const [image, setImage] = useState<Blob | null>(null)
  const [message, setMessage] = useState('')
  const track = useMemo(() => wobblyRect(30, 16, 8, 611, 0.4), [])

  // 다음: 그림을 이미지로 떠서 상세 입력 화면으로. 그림은 그대로 두어 "뒤로" 오면 이어 그릴 수 있다.
  async function next() {
    if (!canvas.current || canvas.current.isEmpty()) {
      setMessage('먼저 그려주세요')
      return
    }
    setMessage('')
    try {
      setImage(await canvas.current.toBlob())
    } catch (e) {
      setMessage(`그림을 담지 못했어요: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div className="relative h-full overflow-hidden">
      <PaperBackground />
      <TopBar left="닫기" title="카드 그리기" right="다음" onLeft={onClose} onRight={next} />

      {/* 한 줄 안내 + 되돌리기/다시하기 */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+92px)] left-1/2 flex -translate-x-1/2 items-center justify-between" style={{ width: CARD_WIDTH }}>
        <p className="font-pen text-[20px] leading-none text-muted">오늘 눈에 들어온 한 사람</p>
        <div className="flex gap-[6px] text-pencil">
          <button aria-label="되돌리기" onClick={() => canvas.current?.undo()} className="p-[4px]">
            <svg viewBox="0 0 26 14" className="h-[14px] w-[26px]" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
              <path d="M4 10 C8 3 18 3 22 10 M4 10 L3 3 M4 10 L10 9" />
            </svg>
          </button>
          <button aria-label="다시 하기" onClick={() => canvas.current?.redo()} className="p-[4px] opacity-50">
            <svg viewBox="0 0 26 14" className="h-[14px] w-[26px]" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden>
              <path d="M22 10 C18 3 8 3 4 10 M22 10 L23 3 M22 10 L16 9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="absolute top-[calc(env(safe-area-inset-top)+128px)] left-1/2 -translate-x-1/2" style={{ width: CARD_WIDTH }}>
        {/* 그리는 카드 (2:3 도화지) */}
        <div className="relative aspect-[2/3] rounded-[12px] bg-card shadow-sticker">
          <div className="absolute inset-[6px] overflow-hidden rounded-[8px]">
            <DrawingCanvas ref={canvas} tool={tool} color={color} size={size} guide={guide} />
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
            <span className="font-pen text-[20px] leading-none">가이드</span>
          </button>
          <span className="font-hand text-[15px] leading-none text-muted">{formatDate(new Date().toISOString())}</span>
        </div>
        {message && <p className="pt-2 text-center font-pen text-[18px] text-muted">{message}</p>}
      </div>

      <Toolbar tool={tool} size={size} color={color} onTool={setTool} onSize={setSize} onColor={setColor} />

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
