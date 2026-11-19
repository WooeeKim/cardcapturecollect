import { APP_NAME } from '../components/Splash'
import { tr } from './i18n'
import { moodOf } from './moods'
import { serialLabel, type Card } from './store'

// One finished card as a PNG for saving / sharing: the same layout as CardView (components/ui.tsx, sizes in
// container units of the card width), drawn on a canvas so the handwriting font always comes out right
// (screen-capture libraries lose web fonts on iPhone Safari). Below the card: the app's wordmark.

const FONT = '"Griun Myoeun Heullim", -apple-system, sans-serif'
const W = 1080
const PAD = 60
const CARD_W = W - PAD * 2 // 960
const CARD_H = Math.round((CARD_W * 515) / 360)
const FOOT = 150
const H = PAD + CARD_H + FOOT

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = fail
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// words wrapped to `width`; a word longer than a line breaks by letters (like CSS break-words)
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue
      if (ctx.measureText(line + word).width <= width) {
        line += word
        continue
      }
      if (line.trim()) lines.push(line.trimEnd())
      line = ''
      for (const ch of word.trimStart()) {
        if (ctx.measureText(line + ch).width > width && line) {
          lines.push(line)
          line = ''
        }
        line += ch
      }
    }
    lines.push(line.trimEnd())
  }
  return lines
}

function clamp(ctx: CanvasRenderingContext2D, lines: string[], max: number, width: number) {
  if (lines.length <= max) return lines
  const out = lines.slice(0, max)
  let last = out[max - 1]
  while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1)
  out[max - 1] = last + '…'
  return out
}

export async function renderCardPng(card: Card): Promise<Blob> {
  await document.fonts?.load(`40px ${FONT}`, `${card.nickname}${card.memo}${card.place}${APP_NAME}가`).catch(() => {})
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const u = CARD_W / 100 // 1cqw
  const x0 = PAD
  const y0 = PAD

  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, W, H)

  // card
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 14
  roundRect(ctx, x0, y0, CARD_W, CARD_H, (10 / 360) * CARD_W)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, x0, y0, CARD_W, CARD_H, (10 / 360) * CARD_W)
  ctx.clip()

  // drawing: inset 3% 4% 6%, object-contain
  if (card.image) {
    try {
      const img = await loadImg(card.image)
      const bx = x0 + CARD_W * 0.04
      const by = y0 + CARD_H * 0.03
      const bw = CARD_W * 0.92
      const bh = CARD_H * 0.91
      const k = Math.min(bw / img.width, bh / img.height)
      const dw = img.width * k
      const dh = img.height * k
      ctx.drawImage(img, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh)
    } catch {
      /* broken image: the card without its drawing */
    }
  }

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#000'

  // mood chip (top-left)
  if (card.mood) {
    const m = moodOf(card.mood)
    const label = tr(card.mood)
    ctx.font = `${5.8 * u}px ${FONT}`
    const tw = ctx.measureText(label).width
    const cw = tw + 6.6 * u
    const ch = 5.8 * u * 1.1 + 3.6 * u
    roundRect(ctx, x0 + 5.5 * u, y0 + 3.5 * u, cw, ch, ch / 2)
    ctx.fillStyle = m.color
    ctx.fill()
    ctx.fillStyle = m.ink
    ctx.fillText(label, x0 + 5.5 * u + 3.3 * u, y0 + 3.5 * u + 1.8 * u + 0.05 * 5.8 * u)
  }

  // place (top-right)
  if (card.place) {
    ctx.font = `${5.5 * u}px ${FONT}`
    ctx.fillStyle = '#000'
    ctx.textAlign = 'right'
    ctx.fillText(card.place, x0 + CARD_W - 4.2 * u, y0 + 5.5 * u, CARD_W * 0.6)
    ctx.textAlign = 'left'
  }

  // name + memo box (above the serial)
  if (card.nickname || card.memo) {
    const inner = CARD_W - 2 * 2.8 * u - 2 * 2.8 * u
    ctx.font = `${4.7 * u}px ${FONT}`
    const memo = card.memo ? clamp(ctx, wrap(ctx, card.memo, inner), 4, inner) : []
    const nameH = card.nickname ? 5.9 * u * 1.1 : 0
    const memoH = memo.length ? (card.nickname ? 2 * u : 0) + memo.length * 4.7 * u * 1.2 : 0
    const boxH = 2.8 * u * 2 + nameH + memoH
    const bx = x0 + 2.8 * u
    const by = y0 + CARD_H - 8.9 * u - boxH
    roundRect(ctx, bx, by, CARD_W - 5.6 * u, boxH, 2.8 * u)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fill()
    ctx.fillStyle = '#000'
    let ty = by + 2.8 * u
    if (card.nickname) {
      ctx.font = `${5.9 * u}px ${FONT}`
      ctx.fillText(card.nickname, bx + 2.8 * u, ty + 0.05 * 5.9 * u, inner)
      ty += nameH + 2 * u
    }
    ctx.font = `${4.7 * u}px ${FONT}`
    for (const line of memo) {
      ctx.fillText(line, bx + 2.8 * u, ty + 0.1 * 4.7 * u)
      ty += 4.7 * u * 1.2
    }
  }

  // serial (bottom-right)
  if (card.serial) {
    ctx.font = `${3.9 * u}px ${FONT}`
    ctx.fillStyle = '#000'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(serialLabel(card), x0 + CARD_W - 4 * u, y0 + CARD_H - 2.5 * u)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
  }
  ctx.restore()

  // wordmark
  ctx.font = `52px ${FONT}`
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(APP_NAME, W / 2, y0 + CARD_H + FOOT / 2 + 4)

  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob failed'))), 'image/png'))
}
