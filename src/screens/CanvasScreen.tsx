import { useMemo, useRef, useState } from 'react'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import SketchBorder from '../components/SketchBorder'
import { formatDate } from '../components/StickerFrame'
import Toolbar, { COLORS, SIZES } from '../components/Toolbar'
import { wobblyLine, wobblyRect } from '../lib/sketch'
import { createSticker } from '../lib/stickers'

// 2:3 카드 폭. Figma 300px. 화면이 낮으면 위(128px)·아래(가이드 줄 + 툴바 약 190px)와 겹치지 않게 높이 기준으로 줄인다.
const CARD_WIDTH = 'min(300px, var(--app-w) - 80px, (var(--app-h) - env(safe-area-inset-top) - 128px - 190px) * 2 / 3)'

// Figma: 나은 섹션 01a 빈 카드 · 01b 그리는 중 · 01c 두께 · 01d 색
// 이름·장소·메모는 다음 화면(02 상세 입력)에서 받는다. 그 화면이 생기기 전까지 "다음"은 그림만 저장한다.
export default function CanvasScreen({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const canvas = useRef<DrawingCanvasHandle>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [guide, setGuide] = useState(readGuidePref)
  const [drawn, setDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const lines = useMemo(() => ({ title: wobblyLine(90, 7), track: wobblyRect(30, 16, 8, 611, 0.4) }), [])

  async function save() {
    if (!canvas.current || canvas.current.isEmpty()) {
      setMessage('먼저 그려주세요')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const image = await canvas.current.toBlob()
      await createSticker({ place: '', name: '', memo: '', image })
      canvas.current.clear()
      setDrawn(false)
      onSaved()
    } catch (e) {
      setMessage(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative h-full overflow-hidden bg-card">
      {/* 따뜻한 종이 + 아주 옅은 연필 격자 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(58 50 43 / 0.05) 0.6px, transparent 0.6px), linear-gradient(to bottom, rgb(58 50 43 / 0.05) 0.6px, transparent 0.6px)',
          backgroundSize: '48px 48px',
          backgroundPosition: '33px 40px',
        }}
        aria-hidden
      />

      {/* 위 막대 */}
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+28px)] flex h-[52px] items-center justify-between px-[20px] text-pencil">
        <button onClick={onClose} className="font-pen text-[24px] leading-none">
          닫기
        </button>
        <h1 className="relative font-hand text-[22px] leading-none font-bold">
          카드 그리기
          <svg viewBox="-2 -3 94 6" className="absolute -bottom-[7px] left-1/2 h-[6px] w-[94px] -translate-x-1/2 overflow-visible" aria-hidden>
            <path d={lines.title} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
          </svg>
        </h1>
        <button onClick={save} disabled={saving} className="font-pen text-[24px] leading-none disabled:opacity-40">
          다음
        </button>
      </div>

      {/* 한 줄 안내 + 되돌리기/다시하기 */}
      <div className="absolute top-[calc(env(safe-area-inset-top)+92px)] left-1/2 flex -translate-x-1/2 items-center justify-between" style={{ width: CARD_WIDTH }}>
        <p className="font-pen text-[20px] leading-none text-muted">{drawn ? '천천히 그려도 괜찮아요' : '오늘 눈에 들어온 한 사람'}</p>
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
        <div className="relative aspect-[2/3] rounded-[12px] bg-card shadow-sticker" onPointerDownCapture={() => setDrawn(true)}>
          <div className="absolute inset-[6px] overflow-hidden rounded-[8px]">
            <DrawingCanvas ref={canvas} tool={tool} color={color} size={size} guide={guide} />
          </div>
          {!drawn && (
            <p className="pointer-events-none absolute inset-x-0 bottom-[14px] text-center font-pen text-[19px] leading-none text-muted opacity-80">
              흐린 선을 따라, 기억나는 만큼만
            </p>
          )}
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
              <path d={lines.track} fill={guide ? 'var(--color-wash)' : 'none'} stroke="currentColor" strokeWidth={1.2} />
              <circle cx={8} cy={8} r={5} fill="currentColor" className="transition-transform duration-300 ease-spring" style={{ transform: guide ? 'translateX(14px)' : undefined }} />
            </svg>
            <span className="font-pen text-[20px] leading-none">가이드</span>
          </button>
          <span className="font-hand text-[15px] leading-none text-muted">{formatDate(new Date().toISOString())}</span>
        </div>
        {message && <p className="pt-2 text-center font-pen text-[18px] text-muted">{message}</p>}
      </div>

      <Toolbar tool={tool} size={size} color={color} onTool={setTool} onSize={setSize} onColor={setColor} />
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
