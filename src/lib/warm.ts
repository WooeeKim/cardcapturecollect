// Warm colours (Figma UX › 앱 확정 › 따뜻한컬러, paint styles color_00–06), for admin accounts only for now.
// The app's colours are written straight into many classes, inline styles and SVG files. For admins each one is
// swapped at its source: the stylesheet (override rules in the same @layer), inline style / fill / stroke
// attributes, and SVG files shown as <img> (recoloured copies). (A whole-frame SVG filter was tried first, but
// iPhone Safari skipped some layers with it, so parts stayed grey.)

// The 7 Figma paint styles. Every UI colour that isn't clearly a colour (greys, and the faintly tinted greys of the
// town skies / grounds) snaps to one of these by its brightness, so admins see nothing but these 7 (alpha kept).
// Brightness bands follow the job each style has in the Figma frames:
const PALETTE: [number, string][] = [
  // [lowest brightness for this style, colour]
  [252, 'fffefd'], // color_00 white: cards, chips, thumbnails (#fff)
  [238.5, 'f5f4f4'], // color_01 screen backgrounds, town sky, light pills (#f0f0f0, #f2f2f2, #f3f3f3, #f9f9f9…)
  [212, 'e0dfdd'], // color_02 icon fills, boxes, light lines (#eaeaea triangle / menu / profile, #ededed town box, #eeeeee swirl, #e0e0e0, #d6d6d6…)
  [182, 'c6c5c3'], // color_03 line, grey fills, town ground (#ccc, #c4c4c4, #c9c9c9…)
  [150, 'a8a7a5'], // color_04 tufts, darker fills (#9a9a9a, #a4a4a4, #b3b3b3…)
  [80, '767573'], // color_05 secondary text, open ring (#686868, #8e8e8e, #555…)
  [0, '171615'], // color_06 text, lines (#000, #2e2e2e, #3d3d3d…)
]
// a colour whose channels differ by more than this is a real colour (mood, warning red, highlighter): left alone
const TINT = 40

function snap(r: number, g: number, b: number): string | null {
  if (Math.max(r, g, b) - Math.min(r, g, b) > TINT) return null
  const l = 0.299 * r + 0.587 * g + 0.114 * b
  return PALETTE.find(([min]) => l >= min)![1]
}

// every grey / faint tint in a CSS / SVG value → one of the 7 (keeps any alpha); real colours untouched
const HEX = /(#|%23)([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi
const RGB = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*([,/]\s*[\d.]+%?\s*)?\)/gi
function warmText(s: string, keywords = false) {
  let out = s.replace(HEX, (m, hash: string, h: string) => {
    const full = h.length === 3 ? h.replace(/./g, '$&$&') : h
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
    const w = snap(r, g, b)
    return w ? hash + w + full.slice(6) : m
  })
  out = out.replace(RGB, (m, r: string, g: string, b: string, a?: string) => {
    const w = snap(Number(r), Number(g), Number(b))
    if (!w) return m
    const rgb = [0, 2, 4].map((i) => parseInt(w.slice(i, i + 2), 16)).join(', ')
    return a ? `rgba(${rgb}, ${a.replace(/^[,/]\s*/, '').trim()})` : `rgb(${rgb})`
  })
  if (keywords) out = out.replace(/\bblack\b/g, `#${snap(0, 0, 0)}`).replace(/\bwhite\b/g, `#${snap(255, 255, 255)}`)
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
        // rules written for warm mode already (index.css .warm …) use exactly the colours Figma gives: leave them
        if (/\.warm\b/.test(rule.selectorText)) continue
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
