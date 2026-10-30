// Colours for charts and category tags, read from the CSS tokens in style.css
// (the fallbacks repeat them for environments without the stylesheet, e.g. tests).

// The --cat-1..8 palette, in its checked order.
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

const TOKENS = {
  data: ['--data', CATEGORICAL[0]],
  other: ['--data-other', '#a3acb6'],
  disease: ['--dim-disease', CATEGORICAL[1]],
  tissue: ['--dim-tissue', CATEGORICAL[2]],
  instrument: ['--dim-instrument', CATEGORICAL[3]],
  cellLine: ['--dim-cell-line', CATEGORICAL[4]],
  organism: ['--dim-organism', CATEGORICAL[6]],
}

export function chartColor(role) {
  const [name, fallback] = TOKENS[role]
  const v = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name) : ''
  return (v && v.trim()) || fallback
}

// Palette slot (1-8) for an open-ended category such as a collection name.
// Names listed in `fixed` keep their slot; any other name takes one of the
// remaining slots, picked by a hash of the name so it keeps the same colour
// however many categories exist (colour follows the category, not its rank).
export function categorySlot(name, fixed = {}) {
  if (fixed[name]) return fixed[name]
  const taken = new Set(Object.values(fixed))
  const free = CATEGORICAL.map((_, i) => i + 1).filter((i) => !taken.has(i))
  const pool = free.length ? free : CATEGORICAL.map((_, i) => i + 1)
  let h = 0
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return pool[h % pool.length]
}
