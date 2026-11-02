import { useRef, useState } from 'react'
import checkIcon from '../assets/figma/check.svg'
import plusIcon from '../assets/figma/plus.svg'
import DrawingCanvas, { type DrawingCanvasHandle, type Tool } from '../components/DrawingCanvas'
import StickerFrame, { formatDate } from '../components/StickerFrame'
import Toolbar, { COLORS, SIZES } from '../components/Toolbar'
import { createSticker } from '../lib/stickers'

// 카드 폭: Figma 361px. 화면이 낮으면 툴바(115px)와 겹치지 않게 높이 기준으로 줄인다 (카드 비율 361:451).
const CARD_WIDTH = 'min(361px, var(--app-w) - 41px, (var(--app-h) - env(safe-area-inset-top) - 153px - 123px) * 0.8)'

// Figma: 01 캔버스(132:376) · 02 뒷면 상세설명(132:465, 132:551)
export default function CanvasScreen({ onSaved }: { onSaved: () => void }) {
  const canvas = useRef<DrawingCanvasHandle>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [place, setPlace] = useState('')
  const [name, setName] = useState('')
  const [memo, setMemo] = useState('')
  const [back, setBack] = useState(false)
  const [guide, setGuide] = useState(readGuidePref)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function reset() {
    canvas.current?.clear()
    setPlace('')
    setName('')
    setMemo('')
    setBack(false)
    setMessage('')
  }

  async function save() {
    if (!canvas.current || canvas.current.isEmpty()) {
      setMessage('먼저 그려주세요')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const image = await canvas.current.toBlob()
      await createSticker({ place, name, memo, image })
      reset()
      onSaved()
    } catch (e) {
      setMessage(`저장 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={reset} aria-label="새 스티커" className="absolute top-[calc(env(safe-area-inset-top)+107px)] left-[21px] h-[21.156px] w-[21.738px]">
        <span className="absolute inset-[-4.73%_-4.6%]">
          <img src={plusIcon} alt="" className="block size-full max-w-none" />
        </span>
      </button>
      <button
        onClick={save}
        disabled={saving}
        aria-label="저장"
        className="absolute top-[calc(env(safe-area-inset-top)+105px)] right-[19.83px] h-[23.465px] w-[28.172px] disabled:opacity-40"
      >
        <span className="absolute inset-[-4.26%_-3.55%_-4.27%_-3.55%]">
          <img src={checkIcon} alt="" className="block size-full max-w-none" />
        </span>
      </button>

      <div className="absolute top-[calc(env(safe-area-inset-top)+153px)] left-1/2 -translate-x-1/2" style={{ width: CARD_WIDTH }}>
        <StickerFrame
          date={formatDate(new Date().toISOString())}
          onFlip={() => setBack((b) => !b)}
          footer={
            <button
              type="button"
              role="switch"
              aria-checked={guide}
              onClick={() => {
                setGuide(!guide)
                writeGuidePref(!guide)
              }}
              className={`-my-[2.5cqw] -ml-[1cqw] flex items-center gap-[1.66cqw] py-[2.5cqw] pl-[1cqw] pr-[2cqw] text-[3.324cqw] leading-normal font-semibold text-muted ${back ? 'invisible' : ''}`}
            >
              <span className={`relative h-[4.43cqw] w-[7.76cqw] rounded-full transition-colors ${guide ? 'bg-line' : 'bg-slot'}`}>
                <span
                  className={`absolute top-[0.55cqw] left-[0.55cqw] size-[3.33cqw] rounded-full bg-white shadow-chip transition-transform ${guide ? 'translate-x-[3.33cqw]' : ''}`}
                />
              </span>
              가이드
            </button>
          }
          chip={
            <div className={`flex items-center gap-[2.77cqw] overflow-hidden rounded-full border-[0.554cqw] border-chip-border bg-white pr-[4.155cqw] shadow-chip ${back ? 'invisible' : ''}`}>
              <span className="rounded-full bg-line px-[2.45cqw] py-[1.75cqw]">
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="Place"
                  size={Math.max(place.length, 5)}
                  className="m-0 bg-transparent p-0 text-[4.155cqw] leading-normal font-semibold text-white outline-none placeholder:text-white"
                />
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Drawing Name"
                size={Math.max(name.length, 12)}
                className="m-0 bg-transparent p-0 font-inter text-[4.155cqw] leading-normal font-semibold text-ink-soft outline-none placeholder:text-ink-soft"
              />
            </div>
          }
        >
          <div className="absolute inset-0 overflow-hidden rounded-[0.831cqw] border-[1.5px] border-dashed border-paper">
            <DrawingCanvas ref={canvas} tool={tool} color={color} size={size} guide={guide} />
            {back && (
              <textarea
                autoFocus
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Leaving memo.."
                className="absolute inset-0 resize-none bg-white px-[4cqw] pt-[35.46cqw] text-center text-[5.54cqw] leading-normal font-medium text-ink-soft outline-none placeholder:text-muted"
              />
            )}
          </div>
        </StickerFrame>
        {message && <p className="pt-2 text-center text-[12px] font-semibold text-muted">{message}</p>}
      </div>

      <Toolbar tool={tool} size={size} color={color} onTool={setTool} onSize={setSize} onColor={setColor} />
    </>
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
