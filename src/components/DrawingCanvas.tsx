import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react'
import FigureGuide from './FigureGuide'
import { toLocal } from '../lib/frame'

export type Tool = 'pen' | 'highlighter' | 'eraser'

export type Point = { x: number; y: number }
export type Stroke = { tool: Tool; color: string; size: number; points: Point[] }
// The whole card (paper) moves: scale s around its center, rotated r (rad), shifted (x, y) in host px.
// It may grow past the screen edges.
type View = { s: number; r: number; x: number; y: number }

export type DrawingCanvasHandle = {
  undo: () => void
  redo: () => void
  clear: () => void
  isEmpty: () => boolean
  strokes: () => Stroke[] // points as 0–1 fractions of the paper
  canUndo: () => boolean
  canRedo: () => boolean
  toBlob: () => Promise<Blob>
  resetView: () => void
}

type Props = {
  tool: Tool
  color: string
  size: number
  guide?: boolean
  onChange?: () => void
  // eyedropper: next touch reads the color under the finger instead of drawing
  picking?: boolean
  onPick?: (color: string) => void
  onZoom?: (zoomed: boolean) => void
  paperClassName?: string
  children?: ReactNode // drawn on the paper (moves with it)
  ref?: Ref<DrawingCanvasHandle>
}

// No undo/redo in some designs, so gestures too: two-finger tap = undo, three-finger tap = redo.
// Two fingers spreading / turning / moving = zoom, tilt and move the card.
const TAP_MS = 300
const TAP_SLOP = 10
const MIN_SCALE = 0.5
const MAX_SCALE = 6
const IDENTITY: View = { s: 1, r: 0, x: 0, y: 0 }
const isHome = (v: View) => v.s === 1 && v.r === 0 && v.x === 0 && v.y === 0

// Fill (highlighter) strokes sit on their own layer under the pen lines, so filling never covers a line.
// The eraser cuts both layers. Opacity comes only from the color (100% = solid fill).
let fillLayer: HTMLCanvasElement | null = null
function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  const { width: w, height: h } = ctx.canvas
  fillLayer ??= document.createElement('canvas')
  if (fillLayer.width !== w || fillLayer.height !== h) {
    fillLayer.width = w
    fillLayer.height = h
  }
  const fill = fillLayer.getContext('2d')!
  strokeAll(fill, strokes.filter((s) => s.tool !== 'pen'))
  strokeAll(ctx, strokes.filter((s) => s.tool !== 'highlighter'))
  ctx.globalCompositeOperation = 'destination-over'
  ctx.drawImage(fillLayer, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

function strokeAll(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  const { width: w, height: h } = ctx.canvas
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  for (const s of strokes) {
    ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = s.color
    // pen lines at half the step size (thinnest = 1), fill 3×, eraser as is
    ctx.lineWidth = s.size * (s.tool === 'highlighter' ? 3 : s.tool === 'pen' ? 0.5 : 1) * (w / 300)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)))
    if (s.points.length === 1) ctx.lineTo(s.points[0].x * w + 0.01, s.points[0].y * h)
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

// Card-sized drawing paper. Points are stored as 0–1 fractions so the backing resolution can change.
export default function DrawingCanvas({ tool, color, size, guide = true, onChange, picking = false, onPick, onZoom, paperClassName = '', children, ref }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const redoStack = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const pointers = useRef(new Map<number, Point>()) // host px
  const gesture = useRef({ maxTouches: 0, startedAt: 0, moved: false })
  const view = useRef<View>(IDENTITY)
  const pinch = useRef<{ dist: number; angle: number; mid: Point; view: View } | null>(null)
  const res = useRef(1) // backing-store multiplier so zoomed lines stay sharp
  const zoomed = useRef(false)
  // latest props for the window listeners
  const live = useRef({ tool, color, size, onChange, onZoom })
  live.current = { tool, color, size, onChange, onZoom }

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    paint(canvas.getContext('2d')!, current.current ? [...strokes.current, current.current] : strokes.current)
  }

  function sizeCanvas() {
    const c = canvasRef.current!
    const k = window.devicePixelRatio * res.current
    c.width = Math.round(c.clientWidth * k)
    c.height = Math.round(c.clientHeight * k)
    redraw()
  }

  function apply(animate = false) {
    const paper = paperRef.current!
    const { s, r, x, y } = view.current
    paper.style.transition = animate ? 'transform 0.3s var(--ease-spring)' : 'none'
    paper.style.transform = `translate(${x}px, ${y}px) rotate(${r}rad) scale(${s})`
    const z = !isHome(view.current)
    if (z !== zoomed.current) {
      zoomed.current = z
      live.current.onZoom?.(z)
    }
  }

  // sharper backing store once the gesture settles
  function settleResolution() {
    const want = Math.min(4, Math.max(1, Math.ceil(view.current.s)))
    if (want !== res.current) {
      res.current = want
      sizeCanvas()
    }
  }

  // host px → paper px (undo the card's move / tilt / zoom around its center)
  function toPaper(p: Point): Point {
    const host = hostRef.current!
    const cx = host.offsetWidth / 2
    const cy = host.offsetHeight / 2
    const { s, r, x, y } = view.current
    const dx = p.x - cx - x
    const dy = p.y - cy - y
    const cos = Math.cos(-r)
    const sin = Math.sin(-r)
    return { x: cx + (dx * cos - dy * sin) / s, y: cy + (dx * sin + dy * cos) / s }
  }
  const hostPoint = (e: { clientX: number; clientY: number }) => toLocal(e.clientX, e.clientY, hostRef.current!)
  const toFraction = (p: Point): Point => {
    const host = hostRef.current!
    const q = toPaper(p)
    return { x: q.x / host.offsetWidth, y: q.y / host.offsetHeight }
  }

  // keep the paper point under `from` (at `base`) under `to` after scaling to s and turning to r
  function moveTo(base: View, s: number, r: number, from: Point, to: Point) {
    const host = hostRef.current!
    const cx = host.offsetWidth / 2
    const cy = host.offsetHeight / 2
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
    // paper point under `from`, relative to the center
    const dx = from.x - cx - base.x
    const dy = from.y - cy - base.y
    const c0 = Math.cos(-base.r)
    const s0 = Math.sin(-base.r)
    const qx = (dx * c0 - dy * s0) / base.s
    const qy = (dx * s0 + dy * c0) / base.s
    const c1 = Math.cos(r)
    const s1 = Math.sin(r)
    view.current = { s: ns, r, x: to.x - cx - ns * (qx * c1 - qy * s1), y: to.y - cy - ns * (qx * s1 + qy * c1) }
    apply()
  }

  function pinchState() {
    const [a, b] = [...pointers.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }

  // nearly straight / nearly home snaps back
  function snap() {
    const v = { ...view.current }
    if (Math.abs(v.r) < (4 * Math.PI) / 180) v.r = 0
    if (v.r === 0 && Math.abs(v.s - 1) < 0.06 && Math.hypot(v.x, v.y) < 24) Object.assign(v, IDENTITY)
    view.current = v
    apply(true)
    settleResolution()
  }

  function addPointer(id: number, p: Point, t: number) {
    pointers.current.set(id, p)
    if (pointers.current.size === 1) {
      gesture.current = { maxTouches: 1, startedAt: t, moved: false }
      const { tool, color, size } = live.current
      current.current = { tool, color, size, points: [toFraction(p)] }
    } else {
      // another finger: drop the stroke in progress, it's a gesture
      gesture.current.maxTouches = Math.max(gesture.current.maxTouches, pointers.current.size)
      current.current = null
      pinch.current = pointers.current.size === 2 ? { ...pinchState(), view: view.current } : null
    }
    redraw()
  }

  // move / up anywhere on screen (fingers may leave the paper while zooming)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // a second finger outside the paper still joins the gesture
      if (!pointers.current.size || paperRef.current!.contains(e.target as Node)) return
      addPointer(e.pointerId, hostPoint(e), e.timeStamp)
    }
    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.set(e.pointerId, hostPoint(e))
      if (pinch.current && pointers.current.size === 2) {
        const start = pinch.current
        const { dist, angle, mid } = pinchState()
        let turn = angle - start.angle
        if (turn > Math.PI) turn -= 2 * Math.PI
        if (turn < -Math.PI) turn += 2 * Math.PI
        if (Math.abs(dist - start.dist) > TAP_SLOP || Math.hypot(mid.x - start.mid.x, mid.y - start.mid.y) > TAP_SLOP || Math.abs(turn) > 0.08) {
          gesture.current.moved = true
        }
        if (gesture.current.moved) moveTo(start.view, (start.view.s * dist) / start.dist, start.view.r + turn, start.mid, mid)
        return
      }
      if (!current.current || pointers.current.size > 1) return
      current.current.points.push(toFraction(hostPoint(e)))
      redraw()
    }
    const onUp = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      pointers.current.delete(e.pointerId)
      pinch.current = null
      if (e.type === 'pointercancel') {
        current.current = null
        redraw()
      }
      if (pointers.current.size > 0) return
      const { maxTouches, startedAt, moved } = gesture.current
      if (maxTouches > 1) {
        if (!moved && e.timeStamp - startedAt < TAP_MS) (maxTouches === 2 ? undo : redo)()
        snap()
        return
      }
      if (!current.current) return
      strokes.current.push(current.current)
      redoStack.current = []
      current.current = null
      live.current.onChange?.()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    const canvas = canvasRef.current!
    sizeCanvas()
    const observer = new ResizeObserver(sizeCanvas)
    observer.observe(canvas)

    // trackpad pinch (ctrl+wheel) zooms, shift+wheel tilts, plain wheel moves the card once zoomed
    const host = hostRef.current!
    const onWheel = (e: WheelEvent) => {
      const at = hostPoint(e)
      const v = view.current
      if (e.ctrlKey) {
        e.preventDefault()
        moveTo(v, v.s * Math.exp(-e.deltaY * 0.01), v.r, at, at)
      } else if (e.shiftKey) {
        e.preventDefault()
        moveTo(v, v.s, v.r + (e.deltaY || e.deltaX) * 0.003, at, at)
      } else if (!isHome(v)) {
        e.preventDefault()
        view.current = { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }
        apply()
      }
      clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(snap, 250)
    }
    let wheelTimer = 0
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      observer.disconnect()
      host.removeEventListener('wheel', onWheel)
      clearTimeout(wheelTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function undo() {
    const s = strokes.current.pop()
    if (s) redoStack.current.push(s)
    redraw()
    live.current.onChange?.()
  }

  function redo() {
    const s = redoStack.current.pop()
    if (s) strokes.current.push(s)
    redraw()
    live.current.onChange?.()
  }

  useImperativeHandle(ref, () => ({
    undo,
    redo,
    clear() {
      strokes.current = []
      redoStack.current = []
      view.current = IDENTITY
      apply()
      redraw()
    },
    isEmpty: () => strokes.current.length === 0,
    strokes: () => strokes.current,
    canUndo: () => strokes.current.length > 0,
    canRedo: () => redoStack.current.length > 0,
    resetView: () => {
      view.current = IDENTITY
      apply(true)
      settleResolution()
    },
    // whole drawing at the normal size, whatever the zoom
    toBlob: () => {
      const src = canvasRef.current!
      const out = document.createElement('canvas')
      out.width = Math.round(src.clientWidth * window.devicePixelRatio)
      out.height = Math.round(src.clientHeight * window.devicePixelRatio)
      paint(out.getContext('2d')!, strokes.current)
      return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
    },
  }))

  return (
    <div ref={hostRef} className="relative size-full">
      <div ref={paperRef} className={`absolute inset-0 origin-center overflow-hidden ${paperClassName}`}>
        <div className={`pointer-events-none absolute inset-[9.2%_0] ${guide ? '' : 'hidden'}`}>
          <FigureGuide />
        </div>
        {children}
        <canvas
          ref={canvasRef}
          className={`relative block size-full touch-none ${picking ? 'cursor-crosshair' : ''}`}
          onPointerDown={(e) => {
            const p = hostPoint(e)
            if (picking) {
              const c = e.currentTarget
              const q = toPaper(p)
              const k = c.width / c.clientWidth
              const [r, g, b, a] = c.getContext('2d')!.getImageData(Math.round(q.x * k), Math.round(q.y * k), 1, 1).data
              // empty paper reads as white
              const mix = (v: number) => Math.round(v * (a / 255) + 255 * (1 - a / 255)).toString(16).padStart(2, '0')
              onPick?.(`#${mix(r)}${mix(g)}${mix(b)}`)
              return
            }
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // pointer already gone: drawing still works
            }
            addPointer(e.pointerId, p, e.timeStamp)
          }}
        />
      </div>
    </div>
  )
}
