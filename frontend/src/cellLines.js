// Cancer Cell Line Proteome API wrappers and pure display helpers.
import { apiGet, encodePath } from './api.js'
import { CELL_LINES_BASE } from './config.js'

export const MAX_COMPARE_LINES = 5
export const TABS = [
  { id: 'protein', label: 'Protein' },
  { id: 'line', label: 'Cell line' },
  { id: 'compare', label: 'Compare' },
  { id: 'coexpression', label: 'Co-expression' },
  { id: 'datasets', label: 'Datasets' },
]
export const GROUP_KINDS = [
  { id: 'lineage', label: 'Lineage' },
  { id: 'primary_disease', label: 'Primary disease' },
]
export const L4_AXIS = 'Within-study rank (level 4)'

const get = (path, params) => apiGet(CELL_LINES_BASE, path, params)

export const getManifest = () => get('/manifest')
export const searchGenes = (q, limit = 12) => get('/genes', { q, limit }).then((r) => r.genes || [])
export const getGene = (gene) => get(`/genes/${encodePath(gene)}`)
export const getGeneRna = (gene) => get(`/genes/${encodePath(gene)}/rna`)
export const getGeneCoexpression = (gene) => get(`/genes/${encodePath(gene)}/coexpression`)
export const searchLines = (q, limit = 12) => get('/lines', { q, limit }).then((r) => r.lines || [])
export const getLine = (line) => get(`/lines/${encodePath(line)}`)
export const getGroups = () => get('/groups').then((r) => r.groups || [])
export const getDatasets = () => get('/datasets').then((r) => r.studies || [])

/** Query params for GET /compare, or null when the selection is incomplete. */
export function compareParams({ mode, lines, group, a, b } = {}) {
  if (mode === 'groups') {
    if (!GROUP_KINDS.some((g) => g.id === group) || !a || !b || a === b) return null
    return { group, a, b, background: true }
  }
  const picked = [...new Set((lines || []).filter(Boolean))]
  if (picked.length < 2 || picked.length > MAX_COMPARE_LINES) return null
  return { lines: picked.join(',') }
}

export function compare(selection) {
  const params = compareParams(selection)
  if (!params) return Promise.resolve(null)
  return get('/compare', params)
}

/** Tab id from the URL query, defaulting to the protein tab. */
export function tabFromQuery(query) {
  const t = String(query?.tab || '')
  return TABS.some((x) => x.id === t) ? t : 'protein'
}

/** Split a comma list from the URL query ("a,b" or ["a","b"]). */
export function listFromQuery(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '')
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))]
}

export function errorMessage(err, what = 'This item') {
  const status = err?.status
  if (status === 503) return 'The atlas is loading, try again shortly.'
  if (status === 404) return `${what} is not in the atlas.`
  return 'The cell-line atlas is temporarily unavailable.'
}

// Presence ------------------------------------------------------------------

export const PRESENCE_STATES = [
  { id: 'high', label: 'Detected, ≥2 peptides' },
  { id: 'detected', label: 'Detected' },
  { id: 'nocall', label: 'No presence call' },
  { id: 'absent', label: 'Not detected' },
  { id: 'unmeasured', label: 'Not measured' },
]

/** Presence state of one line × gene row from GET /genes/{gene}. */
export function presenceState(row) {
  if (!row || !(row.n_studies_measured > 0)) return 'unmeasured'
  if (row.n_studies_present_high > 0) return 'high'
  if (row.n_studies_present > 0) return 'detected'
  if (row.n_studies_plex_identified > 0) return 'nocall'
  return 'absent'
}

export function presenceTooltip(row) {
  const name = row.name || row.line
  const n = row.n_studies_measured || 0
  if (!n) return `${name}: not measured`
  return `${name}: detected in ${row.n_studies_present || 0} of ${n} studies that measured it` +
    ` (≥2 peptides in ${row.n_studies_present_high || 0})` +
    (row.n_studies_plex_identified ? `; no per-line presence call in ${row.n_studies_plex_identified}` : '')
}

// Groups smaller than this are hidden by default (same minimum as specificity and compare).
export const MIN_GROUP_LINES = 3
// Quartiles need at least this many lines.
export const BOX_MIN_LINES = 5

/** Group kind from the `by` URL param (lineage | disease). */
export const kindFromQuery = (by) => (by === 'disease' ? 'primary_disease' : 'lineage')
export const byParam = (kind) => (kind === 'primary_disease' ? 'disease' : 'lineage')

function quantile(sorted, p) {
  if (!sorted.length) return null
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** Five-number summary of the finite values. */
export function boxStats(values) {
  const v = (values || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  return { min: v[0], q1: quantile(v, 0.25), median: quantile(v, 0.5), q3: quantile(v, 0.75), max: v[v.length - 1], n: v.length }
}

/**
 * Dot-plot rows from the API group summary (A49): within-study enrichment vs the other lines of the
 * same studies, detection among lines with a presence call; per-line rows feed the expanded strip.
 */
export function groupDots(lines, groups, kind = 'lineage') {
  const byValue = new Map()
  for (const row of lines || []) {
    const state = presenceState(row)
    if (state === 'unmeasured') continue
    const key = row[kind] ?? 'unmapped'
    if (!byValue.has(key)) byValue.set(key, [])
    byValue.get(key).push({ ...row, state })
  }
  const out = (groups || []).filter((g) => g.kind === kind).map((g) => {
    const rows = byValue.get(g.value) || []
    const l4 = rows.map((r) => r.l4_mean).filter((v) => Number.isFinite(v))
    const enrichment = Number.isFinite(g.enrichment) ? g.enrichment : null
    return {
      value: g.value, rows, enrichment, n_called: g.n_called || 0, n_detected: g.n_detected || 0,
      n_lines: g.n_lines ?? rows.length, n_studies: g.n_studies ?? null,
      frac: g.n_called > 0 ? (g.n_detected || 0) / g.n_called : null,
      box: l4.length >= BOX_MIN_LINES ? boxStats(l4) : null,
      small: enrichment === null || (g.n_lines ?? rows.length) < MIN_GROUP_LINES,
    }
  })
  return out.sort((a, b) => a.small - b.small || (a.enrichment === null) - (b.enrichment === null) ||
    (b.enrichment ?? 0) - (a.enrichment ?? 0) || b.n_lines - a.n_lines)
}

export const PROFILE_STATES = [
  { id: 'detected', label: 'Detected' },
  { id: 'nocall', label: 'No presence call' },
  { id: 'absent', label: 'Not detected' },
]
const PROFILE_STATE = { high: 'detected', detected: 'detected', nocall: 'nocall', absent: 'absent' }

/** Bar-profile groups in dot-plot order; bars are lines with a level 4 value, highest first. */
export function profileBars(lines, groups, kind = 'lineage') {
  return groupDots(lines, groups, kind).map((g) => ({
    value: g.value, small: g.small,
    bars: g.rows.filter((r) => Number.isFinite(r.l4_mean))
      .map((r) => ({ line: r.line, name: r.name || r.line, lineage: r.lineage, primary_disease: r.primary_disease, l4_mean: r.l4_mean, state: PROFILE_STATE[r.state] }))
      .sort((x, y) => y.l4_mean - x.l4_mean),
  })).filter((g) => g.bars.length)
}

// RNA reference ------------------------------------------------------------------

export const RNA_STATES = [
  { id: 'detected', label: 'Detected' },
  { id: 'absent', label: 'Not detected' },
]

/** DepMap log2(TPM+1) per protein state; lines without a presence call or not measured are counted apart. */
export function rnaByDetection(rows) {
  const values = Object.fromEntries(RNA_STATES.map((s) => [s.id, []]))
  let unmeasured = 0
  let nocall = 0
  for (const r of rows || []) {
    if (!Number.isFinite(r.log2_tpm)) continue
    if (values[r.protein_state]) values[r.protein_state].push(r.log2_tpm)
    else if (r.protein_state === 'plex') nocall++
    else unmeasured++
  }
  const all = Object.values(values).flat()
  return {
    groups: RNA_STATES.map((s) => ({ ...s, values: values[s.id], n: values[s.id].length, box: boxStats(values[s.id]) })),
    min: all.length ? Math.min(...all) : 0,
    max: all.length ? Math.max(...all) : 0,
    unmeasured,
    nocall,
  }
}

/** One-line reading of the across-line RNA–protein agreement. */
export function rnaVerdict(agreement, flatSd = 0.5) {
  if (!agreement) return null
  const rho = agreement.rna_protein_spearman
  const icc = agreement.icc
  if (agreement.flat_rna) return { key: 'flat', text: `RNA barely varies across lines (SD < ${flatSd}); correlation is not informative.` }
  if (!Number.isFinite(rho)) return { key: 'none', text: 'Too few lines with both RNA and protein values for a correlation.' }
  if (rho >= 0.5 && icc >= 0.6) return { key: 'tracks', text: 'Protein tracks mRNA across lines.' }
  if (rho < 0.3 && Number.isFinite(icc) && icc < 0.5) {
    return { key: 'limited', text: `Low agreement, but protein reliability is limited (ICC ${fmt(icc)}); likely limited by measurement.` }
  }
  return { key: 'moderate', text: 'Moderate / low agreement across lines.' }
}

const GREY = 'rgba(100, 116, 139, 0.45)'
const INDIGO = 'rgba(79, 70, 229, 0.9)'

/** RNA (x) vs level 4 (y) for detected lines only; one lineage may be highlighted. */
export function detectedScatter(rows, xKey, { transform = (x) => x, isDetected = (r) => r.protein_state === 'detected', highlight = '' } = {}) {
  const base = []
  const hi = []
  let excluded = 0
  for (const r of rows || []) {
    const x = r[xKey]
    if (!Number.isFinite(x)) continue
    if (!isDetected(r)) { if (Number.isFinite(r.l4_mean)) excluded++; continue }
    if (!Number.isFinite(r.l4_mean)) continue
    const p = { x: transform(x), y: r.l4_mean, label: r.name || r.line, lineage: r.lineage || 'unmapped' }
    ;(highlight && p.lineage === highlight ? hi : base).push(p)
  }
  const xs = [...base, ...hi].map((p) => p.x)
  const lo = xs.length ? Math.min(...xs) : 0
  const top = xs.length ? Math.max(...xs) : 1
  const pad = Math.max(0.25, (top - lo) * 0.05)
  const datasets = [{ label: 'detected lines', data: base, backgroundColor: GREY, pointRadius: 3, pointHoverRadius: 5, order: 1 }]
  if (highlight) datasets.unshift({ label: highlight, data: hi, backgroundColor: INDIGO, pointRadius: 4, pointHoverRadius: 6, order: 0 })
  return { n: xs.length, highlighted: hi.length, excluded, xMin: Math.max(0, lo - pad), xMax: top + pad, data: { datasets } }
}

// Co-expression -----------------------------------------------------------------

export const COEXP_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'beyond', label: 'Beyond shared complexes' },
  { id: 'validated', label: 'Validated only' },
]

export const noPartnersText = (gene, minZ = 4) =>
  `No partners at |Z| ≥ ${minZ} for ${gene}: its co-variation across lines is not distinguishable from chance.`

export function filterPartners(partners, mode = 'all') {
  const rows = partners || []
  if (mode === 'validated') return rows.filter((p) => p.validated)
  if (mode === 'beyond') return rows.filter((p) => !(p.shared_complexes || []).length)
  return rows
}

// Formatting --------------------------------------------------------------------

export function fmt(v, digits = 2) {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

export function pct(v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—'
  return `${Math.round(Number(v) * 100)}%`
}

/** Background for a level-4 rank cell (0..1): light to saturated indigo. */
export function heatColor(v) {
  if (!Number.isFinite(v)) return 'transparent'
  const t = Math.min(1, Math.max(0, v))
  return `rgba(99, 102, 241, ${(0.06 + t * 0.6).toFixed(3)})`
}

/** Diverging fill for a within-study enrichment: blue below 0, grey at 0, red above; clamped at ±0.5. */
export function enrichmentColor(v) {
  if (!Number.isFinite(v)) return 'transparent'
  const t = Math.min(1, Math.max(-1, v / 0.5))
  const [from, to] = t < 0 ? [[203, 213, 225], [37, 99, 235]] : [[203, 213, 225], [220, 38, 38]]
  const k = Math.abs(t)
  const mix = (i) => Math.round(from[i] + (to[i] - from[i]) * k)
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`
}

/** Signed two-decimal number, e.g. +0.35. */
export function signed(v, digits = 2) {
  if (!Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(digits)}`
}

/** Sort a copy of rows by key; nulls last. */
export function sortRows(rows, key, dir = 'desc') {
  const s = dir === 'asc' ? 1 : -1
  return [...(rows || [])].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    if (x === y) return 0
    if (x === null || x === undefined || x === '') return 1
    if (y === null || y === undefined || y === '') return -1
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * s
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * s
  })
}

/** External page for a study accession (PRIDE, MassIVE or PubMed), or '' when unknown. */
export function accessionUrl(acc) {
  const a = String(acc || '').trim()
  if (/^PXD\d+$/i.test(a)) return `https://www.ebi.ac.uk/pride/archive/projects/${a.toUpperCase()}`
  if (/^MSV\d+$/i.test(a)) return `https://massive.ucsd.edu/ProteoSAFe/dataset.jsp?accession=${a.toUpperCase()}`
  const pmid = /^PMID:?\s*(\d+)$/i.exec(a)
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}`
  return ''
}

/** Co-expression partners on one circle, ordered by Z from 12 o'clock; strength is for edge width and opacity. */
export function radialLayout(edges, { cx = 300, cy = 300, radius = 230 } = {}) {
  const n = edges.length
  const maxZ = Math.max(...edges.map((e) => Math.abs(e.z) || 0), 1)
  return [...edges].sort((a, b) => b.z - a.z).map((e, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1)
    const strength = Math.abs(e.z) / maxZ
    return {
      ...e, strength, angle,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      anchor: Math.cos(angle) >= 0 ? 'start' : 'end',
    }
  })
}
