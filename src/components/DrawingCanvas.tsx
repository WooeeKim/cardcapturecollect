import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'

export type Tool = 'pen' | 'highlighter' | 'eraser'

type Point = { x: number; y: number }
type Stroke = { tool: Tool; color: string; size: number; points: Point[] }

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
  ref?: Ref<DrawingCanvasHandle>
}

// 툴바에 undo/redo 버튼이 없는 디자인이라 제스처로 대신한다: 두 손가락 탭 = 실행 취소, 세 손가락 탭 = 다시 실행
const TAP_MS = 300

// 부모 크기를 꽉 채우는 캔버스. 좌표는 0~1 비율로 저장해 크기가 바뀌어도 다시 그릴 수 있게 한다.
export default function DrawingCanvas({ tool, color, size, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const redoStack = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const pointers = useRef(new Set<number>())
  const gesture = useRef({ maxTouches: 0, startedAt: 0 })

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { width: w, height: h } = canvas
    ctx.clearRect(0, 0, w, h)
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
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
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * window.devicePixelRatio)
      canvas.height = Math.round(canvas.clientHeight * window.devicePixelRatio)
      redraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
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
      redraw()
    },
    isEmpty: () => strokes.current.length === 0,
    toBlob: () =>
      new Promise((resolve, reject) =>
        canvasRef.current!.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
      ),
  }))

  function toPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  return (
    <canvas
      ref={canvasRef}
      className="block size-full touch-none"
      onPointerDown={(e) => {
        pointers.current.add(e.pointerId)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // 이미 끝난 포인터면 캡처 실패 — 그리기에는 지장 없음
        }
        if (pointers.current.size === 1) {
          gesture.current = { maxTouches: 1, startedAt: e.timeStamp }
          current.current = { tool, color, size, points: [toPoint(e)] }
        } else {
          // 손가락이 하나 더 닿으면 그리던 획은 버리고 제스처로 본다
          gesture.current.maxTouches = Math.max(gesture.current.maxTouches, pointers.current.size)
          current.current = null
        }
        redraw()
      }}
      onPointerMove={(e) => {
        if (!current.current || pointers.current.size > 1) return
        current.current.points.push(toPoint(e))
        redraw()
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        if (pointers.current.size > 0) return
        const { maxTouches, startedAt } = gesture.current
        if (maxTouches > 1) {
          if (e.timeStamp - startedAt < TAP_MS) (maxTouches === 2 ? undo : redo)()
          return
        }
        if (!current.current) return
        strokes.current.push(current.current)
        redoStack.current = []
        current.current = null
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        current.current = null
        redraw()
      }}
    />
  )
}
