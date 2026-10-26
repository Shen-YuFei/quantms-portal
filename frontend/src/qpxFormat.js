// Cell formatting and sorting for qpx tables: numbers by kind (q-value, percent,
// count, intensity), composite values (lists, structs) as readable text, and a
// natural sort that keeps "Sample-2" before "Sample-10".

const LABELS = {
  anchor_protein: 'Protein',
  global_qvalue: 'q-value',
  peptide_qvalue: 'q-value',
  posterior_error_probability: 'PEP',
  run_file_name: 'Run',
  n_psms: 'PSMs',
  n_runs: 'Runs',
  n_features: 'Features',
  n_peptides: 'Peptides',
  n_peptidoforms: 'Peptidoforms',
  unique_peptides: 'Unique peptides',
  sequence_coverage: 'Coverage',
  mass_error_ppm: 'Mass error (ppm)',
  observed_mz: 'Observed m/z',
  calculated_mz: 'Calculated m/z',
  rt: 'RT',
  max_intensity: 'Max intensity',
}

export function colLabel(key) {
  return LABELS[key] || String(key).replace(/_/g, ' ')
}

const PROBABILITY = /(qvalue|q_value|posterior_error|^pep$|fdr)/i
const IDENTIFIER = /(scan|_id$|^id$|index|fraction)/i
const PERCENT = /coverage|_pct$|percent/i

function formatNumber(n, key) {
  if (!Number.isFinite(n)) return String(n)
  if (PERCENT.test(key)) return `${n.toFixed(1)}%`
  if (PROBABILITY.test(key)) return n === 0 ? '0' : n < 0.001 ? n.toExponential(2) : n.toPrecision(3)
  if (Number.isInteger(n)) return IDENTIFIER.test(key) ? String(n) : n.toLocaleString()
  const a = Math.abs(n)
  if (a >= 1000) return Math.round(n).toLocaleString()
  if (a > 0 && a < 0.01) return n.toExponential(2)
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function summarizeObject(o) {
  if (o == null) return '—'
  if (typeof o !== 'object') return formatScalar(o, '')
  if ('name' in o && o.name != null) return String(o.name)
  const parts = Object.entries(o)
    .filter(([, v]) => v != null && typeof v !== 'object')
    .map(([k, v]) => `${colLabel(k)} ${formatScalar(v, k)}`)
  return parts.length ? parts.join(' · ') : JSON.stringify(o)
}

function formatScalar(v, key) {
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'number') return formatNumber(v, key)
  return String(v)
}

const MAX_ITEMS = 4

/** Display text for one cell; `title` carries the full value when the text is shortened. */
export function formatCell(v, key = '') {
  if (v == null || v === '') return { text: '—', title: '' }
  if (Array.isArray(v)) {
    if (!v.length) return { text: '—', title: '' }
    const items = v.map((x) => (x != null && typeof x === 'object' ? summarizeObject(x) : formatScalar(x, key)))
    const shown = items.slice(0, MAX_ITEMS).join(', ')
    const more = items.length > MAX_ITEMS ? ` +${items.length - MAX_ITEMS} more` : ''
    return { text: shown + more, title: items.join(', ') }
  }
  if (typeof v === 'object') {
    const text = summarizeObject(v)
    return { text, title: JSON.stringify(v) }
  }
  const text = formatScalar(v, key)
  return { text, title: typeof v === 'string' && v.length > 40 ? v : '' }
}

export function isNumericColumn(values) {
  let seen = false
  for (const v of values) {
    if (v == null || v === '') continue
    if (typeof v !== 'number') return false
    seen = true
  }
  return seen
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Sort comparator: numbers numerically, text naturally, empty values last. */
export function compareValues(a, b) {
  const ea = a == null || a === ''
  const eb = b == null || b === ''
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(formatCell(a).text, formatCell(b).text)
}
