// Warm colours (Figma UX › 앱 확정 › 따뜻한컬러, paint styles color_00–06), for admin accounts only for now.
// The app's greys are written straight into many classes and SVG files, so instead of editing each one, the whole
// frame goes through one colour filter that turns every neutral grey into the warm grey Figma gives the same job:
//   #fff → color_00 #fffefd (cards, chips) · #f0f0f0 / #f9f9f9 → color_01 #f4f3f0 (screen backgrounds)
//   #e0e0e0 → color_02 #e0deda (boxes) · #ccc → color_03 #c7c5c2 (line, grey fills) · #9a9a9a → color_04 #adaaa6 (tufts)
//   #686868–#8e8e8e → color_05 #767572 (secondary text, open ring) · #000 → color_06 #1c1b19 (text, lines)
// Each channel follows its own curve through those points, so greys pick up the warm tint; colours barely move.

// [input grey, R, G, B]
const ANCHORS: [number, number, number, number][] = [
  [0, 0x1c, 0x1b, 0x19],
  [0x68, 0x76, 0x75, 0x72],
  [0x8e, 0x76, 0x75, 0x72],
  [0x9a, 0xad, 0xaa, 0xa6],
  [0xcc, 0xc7, 0xc5, 0xc2],
  [0xe0, 0xe0, 0xde, 0xda],
  [0xf0, 0xf4, 0xf3, 0xf0],
  [0xf9, 0xf4, 0xf3, 0xf0],
  [0xff, 0xff, 0xfe, 0xfd],
]

function curve(ch: 1 | 2 | 3) {
  const out: number[] = []
  for (let v = 0; v < 256; v++) {
    let i = 0
    while (i < ANCHORS.length - 2 && v > ANCHORS[i + 1][0]) i++
    const [x0, x1] = [ANCHORS[i][0], ANCHORS[i + 1][0]]
    const [y0, y1] = [ANCHORS[i][ch], ANCHORS[i + 1][ch]]
    out.push(y0 + ((y1 - y0) * (v - x0)) / (x1 - x0))
  }
  return out
}
const CURVES = [curve(1), curve(2), curve(3)]

// the same mapping in JS (the status bar colour is read from the page before the filter applies)
export function warmRGB(r: number, g: number, b: number): [number, number, number] {
  return [CURVES[0][Math.round(r)], CURVES[1][Math.round(g)], CURVES[2][Math.round(b)]]
}

let installed = false
function install() {
  if (installed) return
  installed = true
  const table = (c: number[]) => c.map((v) => (v / 255).toFixed(4)).join(' ')
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  host.innerHTML = `<svg width="0" height="0"><filter id="warm-colors" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
    <feComponentTransfer>
      <feFuncR type="table" tableValues="${table(CURVES[0])}"/>
      <feFuncG type="table" tableValues="${table(CURVES[1])}"/>
      <feFuncB type="table" tableValues="${table(CURVES[2])}"/>
    </feComponentTransfer></filter></svg>`
  document.body.appendChild(host)
}

export const isWarm = () => document.documentElement.classList.contains('warm')

export function setWarm(on: boolean) {
  if (on) install()
  document.documentElement.classList.toggle('warm', on)
  dispatchEvent(new Event('warmchange'))
}
