import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import FigureGuide from './FigureGuide'

export type Tool = 'pen' | 'highlighter' | 'eraser'

type Point = { x: number; y: number }
type Stroke = { tool: Tool; color: string; size: number; points: Point[] }
// 확대 상태. 화면(CSS px) = 원래 좌표 × s + (x, y)
type View = { s: number; x: number; y: number }

export type DrawingCanvasHandle = {
  undo: () => void
  redo: () => void
  clear: () => void
  isEmpty: () => boolean
  toBlob: () => Promise<Blob>
}

type Props = {
  tool: Tool
  color: string
  size: number
  guide?: boolean
  ref?: Ref<DrawingCanvasHandle>
}

// 툴바에 undo/redo 버튼이 없는 디자인이라 제스처로 대신한다: 두 손가락 탭 = 실행 취소, 세 손가락 탭 = 다시 실행
// 두 손가락을 벌리거나 끌면 탭이 아니라 확대/이동으로 본다.
const TAP_MS = 300
const TAP_SLOP = 10
const MAX_SCALE = 6
const IDENTITY: View = { s: 1, x: 0, y: 0 }

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], view: View, dpr: number) {
  const { width: w, height: h } = ctx.canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.setTransform(view.s, 0, 0, view.s, view.x * dpr, view.y * dpr)
  for (const s of strokes) {
    ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.globalAlpha = s.tool === 'highlighter' ? 0.35 : 1
    ctx.strokeStyle = s.color
    ctx.lineWidth = (s.tool === 'highlighter' ? s.size * 3 : s.size) * (w / 300)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)))
    if (s.points.length === 1) ctx.lineTo(s.points[0].x * w + 0.01, s.points[0].y * h)
    ctx.stroke()
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

// 부모 크기를 꽉 채우는 캔버스. 좌표는 0~1 비율로 저장해 크기가 바뀌어도 다시 그릴 수 있게 한다.
export default function DrawingCanvas({ tool, color, size, guide = true, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
  const strokes = useRef<Stroke[]>([])
  const redoStack = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef({ maxTouches: 0, startedAt: 0, moved: false })
  const view = useRef<View>(IDENTITY)
  const pinch = useRef<{ dist: number; mid: Point; view: View } | null>(null)

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const all = current.current ? [...strokes.current, current.current] : strokes.current
    paint(canvas.getContext('2d')!, all, view.current, window.devicePixelRatio)
    const { s, x, y } = view.current
    // CSS scale 을 쓰면 가이드 선까지 굵어지므로 박스 크기를 직접 키워 선 굵기는 그대로 둔다
    const guide = guideRef.current
    if (guide) Object.assign(guide.style, { left: `${x}px`, top: `${y}px`, width: `${s * 100}%`, height: `${s * 100}%` })
  }

  // 확대 배율을 1~MAX_SCALE 로, 이동은 그림 영역 밖이 보이지 않게 제한한다
  function setView(next: View) {
    const canvas = canvasRef.current!
    const s = Math.min(MAX_SCALE, Math.max(1, next.s))
    const clamp = (v: number, len: number) => Math.min(0, Math.max(len - len * s, v))
    view.current = { s, x: clamp(next.x, canvas.clientWidth), y: clamp(next.y, canvas.clientHeight) }
    redraw()
  }

  // 화면의 한 점(anchor)이 가리키는 그림 위치를 고정한 채로 배율을 바꾼다
  function zoomAround(base: View, s: number, from: Point, to: Point) {
    const cx = (from.x - base.x) / base.s
    const cy = (from.y - base.y) / base.s
    const ns = Math.min(MAX_SCALE, Math.max(1, s))
    setView({ s: ns, x: to.x - cx * ns, y: to.y - cy * ns })
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * window.devicePixelRatio)
      canvas.height = Math.round(canvas.clientHeight * window.devicePixelRatio)
      view.current = IDENTITY
      redraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // 트랙패드 핀치(ctrl+휠)·ctrl+휠 = 확대, 확대 중 일반 휠 = 이동. 페이지 확대를 막으려고 passive: false 로 단다.
    const onWheel = (e: WheelEvent) => {
      const rect = canvas.getBoundingClientRect()
      const at = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (e.ctrlKey) {
        e.preventDefault()
        zoomAround(view.current, view.current.s * Math.exp(-e.deltaY * 0.01), at, at)
      } else if (view.current.s > 1) {
        e.preventDefault()
        setView({ ...view.current, x: view.current.x - e.deltaX, y: view.current.y - e.deltaY })
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  function undo() {
    const s = strokes.current.pop()
    if (s) redoStack.current.push(s)
    redraw()
  }

  function redo() {
    const s = redoStack.current.pop()
    if (s) strokes.current.push(s)
    redraw()
  }

  useImperativeHandle(ref, () => ({
    undo,
    redo,
    clear() {
      strokes.current = []
      redoStack.current = []
      view.current = IDENTITY
      redraw()
    },
    isEmpty: () => strokes.current.length === 0,
    // 확대 상태와 상관없이 전체 그림을 원래 배율로 내보낸다
    toBlob: () => {
      const src = canvasRef.current!
      const out = document.createElement('canvas')
      out.width = src.width
      out.height = src.height
      paint(out.getContext('2d')!, strokes.current, IDENTITY, window.devicePixelRatio)
      return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
    },
  }))

  function screenPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function toPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const p = screenPoint(e)
    const { s, x, y } = view.current
    const { clientWidth: w, clientHeight: h } = e.currentTarget
    return { x: (p.x - x) / s / w, y: (p.y - y) / s / h }
  }

  function pinchState() {
    const [a, b] = [...pointers.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }

  return (
    <div className="relative size-full overflow-hidden">
      <div ref={guideRef} className={`pointer-events-none absolute top-0 left-0 size-full ${guide ? '' : 'hidden'}`}>
        <div className="absolute inset-[4%_0]">
          <FigureGuide />
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="relative block size-full touch-none"
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, screenPoint(e))
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // 이미 끝난 포인터면 캡처 실패 — 그리기에는 지장 없음
          }
          if (pointers.current.size === 1) {
            gesture.current = { maxTouches: 1, startedAt: e.timeStamp, moved: false }
            current.current = { tool, color, size, points: [toPoint(e)] }
          } else {
            // 손가락이 하나 더 닿으면 그리던 획은 버리고 제스처로 본다
            gesture.current.maxTouches = Math.max(gesture.current.maxTouches, pointers.current.size)
            current.current = null
            pinch.current = pointers.current.size === 2 ? { ...pinchState(), view: view.current } : null
          }
          redraw()
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return
          pointers.current.set(e.pointerId, screenPoint(e))
          if (pinch.current && pointers.current.size === 2) {
            const start = pinch.current
            const { dist, mid } = pinchState()
            if (Math.abs(dist - start.dist) > TAP_SLOP || Math.hypot(mid.x - start.mid.x, mid.y - start.mid.y) > TAP_SLOP) {
              gesture.current.moved = true
            }
            if (gesture.current.moved) zoomAround(start.view, (start.view.s * dist) / start.dist, start.mid, mid)
            return
          }
          if (!current.current || pointers.current.size > 1) return
          current.current.points.push(toPoint(e))
          redraw()
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId)
          pinch.current = null
          if (pointers.current.size > 0) return
          const { maxTouches, startedAt, moved } = gesture.current
          if (maxTouches > 1) {
            if (!moved && e.timeStamp - startedAt < TAP_MS) (maxTouches === 2 ? undo : redo)()
            // 거의 원래 크기까지 줄였으면 딱 맞춰 되돌린다
            if (view.current.s < 1.05) setView(IDENTITY)
            return
          }
          if (!current.current) return
          strokes.current.push(current.current)
          redoStack.current = []
          current.current = null
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId)
          pinch.current = null
          current.current = null
          redraw()
        }}
      />
    </div>
  )
}
