// Warm colours (Figma UX › 앱 확정 › 따뜻한컬러, paint styles color_00–06), for admin accounts only for now.
// The app's greys are written straight into many classes, inline styles and SVG files. For admins every neutral grey
// (r = g = b) is swapped at its source for the warm grey Figma gives the same job:
//   #fff → color_00 #fffefd (cards, chips) · #f0f0f0 / #f9f9f9 → color_01 #f5f4f4 (screen backgrounds)
//   #e0e0e0 → color_02 #e0dfdd (boxes) · #ccc → color_03 #c6c5c3 (line, grey fills) · #9a9a9a → color_04 #a8a7a5 (tufts)
//   #686868–#8e8e8e → color_05 #767573 (secondary text, open ring) · #000 → color_06 #171615 (text, lines)
// Greys in between follow the curve through those points. Colours (moods, drawings) are left alone.
// Where: the stylesheet (override rules in the same @layer), inline style / fill / stroke attributes, and SVG
// files shown as <img> (recoloured copies). (A whole-frame SVG filter was tried first, but iPhone Safari skipped
// some layers with it, so parts stayed grey.)

// [input grey, R, G, B] — Figma paint styles color_00–06
const ANCHORS: [number, number, number, number][] = [
  [0, 0x17, 0x16, 0x15],
  [0x68, 0x76, 0x75, 0x73],
  [0x8e, 0x76, 0x75, 0x73],
  [0x9a, 0xa8, 0xa7, 0xa5],
  [0xcc, 0xc6, 0xc5, 0xc3],
  [0xe0, 0xe0, 0xdf, 0xdd],
  [0xf0, 0xf5, 0xf4, 0xf4],
  [0xf9, 0xf5, 0xf4, 0xf4],
  [0xff, 0xff, 0xfe, 0xfd],
]

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')
const MAP: string[] = []
for (let v = 0; v < 256; v++) {
  let i = 0
  while (i < ANCHORS.length - 2 && v > ANCHORS[i + 1][0]) i++
  const [a, b] = [ANCHORS[i], ANCHORS[i + 1]]
  const t = (v - a[0]) / (b[0] - a[0])
  MAP.push([1, 2, 3].map((c) => hex2(a[c] + (b[c] - a[c]) * t)).join(''))
}
const warmHex = (v: number) => MAP[v]

// every neutral grey in a CSS / SVG value → its warm grey (keeps any alpha); other colours untouched
const HEX = /(#|%23)([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi
const RGB = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*([,/]\s*[\d.]+%?\s*)?\)/gi
function warmText(s: string, keywords = false) {
  let out = s.replace(HEX, (m, hash: string, h: string) => {
    const full = h.length === 3 ? h.replace(/./g, '$&$&') : h
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
    if (r !== g || g !== b) return m
    return hash + warmHex(r) + full.slice(6)
  })
  out = out.replace(RGB, (m, r: string, g: string, b: string, a?: string) => {
    if (r !== g || g !== b) return m
    const w = warmHex(Number(r))
    const rgb = [0, 2, 4].map((i) => parseInt(w.slice(i, i + 2), 16)).join(', ')
    return a ? `rgba(${rgb}, ${a.replace(/^[,/]\s*/, '').trim()})` : `rgb(${rgb})`
  })
  if (keywords) out = out.replace(/\bblack\b/g, `#${warmHex(0)}`).replace(/\bwhite\b/g, `#${warmHex(255)}`)
  return out
}

// ---------- stylesheet ----------

const COLOR_PROP = /color|fill|stroke|background|border|outline|shadow|caret|decoration|^--/
let sheet: HTMLStyleElement | null = null

function overrides(): string {
  const out: string[] = []
  const walk = (rules: CSSRuleList, wrap: (css: string) => string) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        const decls: string[] = []
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i]
          if (!COLOR_PROP.test(prop)) continue
          const val = rule.style.getPropertyValue(prop)
          const warm = warmText(val, true)
          if (warm !== val) decls.push(`${prop}: ${warm}${rule.style.getPropertyPriority(prop) ? ' !important' : ''}`)
        }
        if (decls.length) {
          // html.warm in front (or on :root / html itself): a little more specific than the rule it replaces
          const sel = rule.selectorText
            .split(',')
            .map((x) => x.trim())
            .map((x) => (/^(:root|html)\b/.test(x) ? x.replace(/^(:root|html)/, '$1.warm') : `html.warm ${x}`))
            .join(', ')
          out.push(wrap(`${sel} { ${decls.join('; ')} }`))
        }
        if (rule.cssRules?.length) walk(rule.cssRules, wrap)
      } else if (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule) {
        // same @layer, so the layer order (theme < base < utilities) still decides between rules
        walk(rule.cssRules, (css) => wrap(`@layer ${rule.name} { ${css} }`))
      } else if (rule instanceof CSSMediaRule) {
        walk(rule.cssRules, (css) => wrap(`@media ${rule.conditionText} { ${css} }`))
      } else if (rule instanceof CSSSupportsRule) {
        walk(rule.cssRules, (css) => wrap(`@supports ${rule.conditionText} { ${css} }`))
      }
    }
  }
  for (const s of Array.from(document.styleSheets)) {
    if (s.ownerNode === sheet) continue
    try {
      walk(s.cssRules, (css) => css)
    } catch {
      // a stylesheet from another site: can't be read, nothing of ours in it
    }
  }
  return out.join('\n')
}

// ---------- elements: inline style / fill / stroke, and <img> SVG files ----------

const ATTRS = ['style', 'fill', 'stroke', 'stop-color', 'color']
const original = new WeakMap<Element, Record<string, string | null>>()
// what we last wrote, so our own writes aren't mistaken for the app writing a new grey
const written = new WeakMap<Element, Record<string, string>>()
function write(el: Element, attr: string, v: string) {
  const w = written.get(el) ?? {}
  w[attr] = v
  written.set(el, w)
  el.setAttribute(attr, v)
}
const svgCache = new Map<string, Promise<string>>()
const warmSrc = new Set<string>()

function remember(el: Element, attr: string) {
  const o = original.get(el) ?? {}
  if (!(attr in o)) o[attr] = el.getAttribute(attr)
  original.set(el, o)
}

function warmSvgUrl(src: string) {
  let p = svgCache.get(src)
  if (!p) {
    p = fetch(src)
      .then((r) => r.text())
      .then((text) => {
        const url = URL.createObjectURL(new Blob([warmText(text, true)], { type: 'image/svg+xml' }))
        warmSrc.add(url)
        return url
      })
    svgCache.set(src, p)
  }
  return p
}

function warmElement(el: Element) {
  for (const attr of ATTRS) {
    const v = el.getAttribute(attr)
    if (!v) continue
    const w = warmText(v, attr !== 'style')
    if (w !== v) {
      remember(el, attr)
      write(el, attr, w)
    }
  }
  if (el instanceof HTMLImageElement) {
    const src = el.getAttribute('src') ?? ''
    if (!warmSrc.has(src) && (/\.svg(\?|#|$)/i.test(src) || src.startsWith('data:image/svg+xml'))) {
      remember(el, 'src')
      warmSvgUrl(el.src).then((url) => {
        // still the same picture, and still warm
        if (on && el.getAttribute('src') === src) write(el, 'src', url)
      }, () => {})
    }
  }
}

function warmTree(node: Node) {
  if (!(node instanceof Element)) return
  warmElement(node)
  node.querySelectorAll('*').forEach(warmElement)
}

function restoreTree(node: Element) {
  for (const el of [node, ...Array.from(node.querySelectorAll('*'))]) {
    const o = original.get(el)
    if (!o) continue
    for (const [attr, v] of Object.entries(o)) {
      if (v === null) el.removeAttribute(attr)
      else el.setAttribute(attr, v)
    }
    original.delete(el)
  }
}

// ---------- on / off ----------

let on = false
let observer: MutationObserver | null = null
let headObserver: MutationObserver | null = null

export const isWarm = () => on

export function setWarm(next: boolean) {
  if (next === on) return
  on = next
  document.documentElement.classList.toggle('warm', on)
  const root = document.body
  if (on) {
    sheet = document.createElement('style')
    sheet.dataset.warm = ''
    document.head.appendChild(sheet)
    sheet.textContent = overrides()
    // stylesheets added later (a screen's CSS loading in): redo the overrides
    headObserver = new MutationObserver((list) => {
      if (list.some((m) => Array.from(m.addedNodes).some((n) => n !== sheet && (n instanceof HTMLStyleElement || n instanceof HTMLLinkElement)))) {
        setTimeout(() => sheet && (sheet.textContent = overrides()), 50)
      }
    })
    headObserver.observe(document.head, { childList: true })
    warmTree(root)
    observer = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach(warmTree)
        else if (m.target instanceof Element && m.attributeName) {
          const el = m.target
          const attr = m.attributeName
          if (written.get(el)?.[attr] === el.getAttribute(attr)) continue // our own write
          // the app set a new value: that's the original now, then swap its greys
          const o = original.get(el)
          if (o) delete o[attr]
          warmElement(el)
        }
      }
    })
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: [...ATTRS, 'src'] })
  } else {
    observer?.disconnect()
    observer = null
    headObserver?.disconnect()
    headObserver = null
    sheet?.remove()
    sheet = null
    restoreTree(root)
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) written.delete(el)
  }
  dispatchEvent(new Event('warmchange'))
}
