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
export const getDatasets = () => get('/datasets')

/** Query params for GET /compare, or null when the selection is incomplete. */
export function compareParams({ mode, lines, group, a, b } = {}) {
  if (mode === 'groups') {
    if (!GROUP_KINDS.some((g) => g.id === group) || !a || !b || a === b) return null
    return { group, a, b }
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
  { id: 'plex', label: 'Identified in TMT plex only' },
  { id: 'absent', label: 'Not detected' },
  { id: 'unmeasured', label: 'Not measured' },
]

/** Presence state of one line × gene row from GET /genes/{gene}. */
export function presenceState(row) {
  if (!row || !(row.n_studies_measured > 0)) return 'unmeasured'
  if (row.n_studies_present_high > 0) return 'high'
  if (row.n_studies_present > 0) return 'detected'
  if (row.n_studies_plex_identified > 0) return 'plex'
  return 'absent'
}

export function presenceTooltip(row) {
  const name = row.name || row.line
  const n = row.n_studies_measured || 0
  if (!n) return `${name}: not measured`
  return `${name}: detected in ${row.n_studies_present || 0} of ${n} studies that measured it` +
    ` (≥2 peptides in ${row.n_studies_present_high || 0})` +
    (row.n_studies_plex_identified ? `; identified in the TMT plex in ${row.n_studies_plex_identified} (not channel-specific)` : '')
}

/**
 * Per group value: lines in each presence state. Lines in the atlas (from /groups) that the
 * gene response does not return, or returns with no measuring study, count as not measured.
 */
export function presenceByGroup(lines, groups, kind = 'lineage') {
  const totals = new Map()
  for (const g of groups || []) if (g.group === kind) totals.set(g.value, g.n_lines || 0)
  const byValue = new Map()
  for (const row of lines || []) {
    const key = row[kind] ?? 'unmapped'
    if (!byValue.has(key)) byValue.set(key, [])
    byValue.get(key).push(row)
  }
  const keys = new Set([...totals.keys(), ...byValue.keys()])
  const out = []
  for (const value of keys) {
    const rows = (byValue.get(value) || []).map((r) => ({ ...r, state: presenceState(r) }))
    const counts = { high: 0, detected: 0, plex: 0, absent: 0, unmeasured: 0 }
    for (const r of rows) counts[r.state]++
    const measured = counts.high + counts.detected + counts.plex + counts.absent
    const total = Math.max(totals.get(value) ?? 0, rows.length)
    counts.unmeasured = total - measured
    out.push({ value, total, counts, lines: rows.filter((r) => r.state !== 'unmeasured') })
  }
  return out.sort((x, y) => (y.counts.high + y.counts.detected) / (y.total || 1) -
    (x.counts.high + x.counts.detected) / (x.total || 1) || y.total - x.total)
}

// Summaries -------------------------------------------------------------------

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

/** Level-4 strips per group value, joined with the API's group summary. */
export function abundanceByGroup(lines, groups, kind = 'lineage') {
  const summary = new Map()
  for (const g of groups || []) if (g.group === kind) summary.set(g.group_value, g)
  const byValue = new Map()
  for (const row of lines || []) {
    if (!Number.isFinite(row.l4_mean)) continue
    const key = row[kind] ?? 'unmapped'
    if (!byValue.has(key)) byValue.set(key, [])
    byValue.get(key).push(row)
  }
  const out = []
  for (const [value, rows] of byValue) {
    const s = summary.get(value) || {}
    out.push({
      value, rows, box: boxStats(rows.map((r) => r.l4_mean)),
      mean_l4: s.mean_l4 ?? null, n_lines: s.n_lines ?? rows.length, frac_present: s.frac_present ?? null,
    })
  }
  return out.sort((a, b) => (b.mean_l4 ?? b.box.median) - (a.mean_l4 ?? a.box.median))
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

const PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#e5484d', '#3b82f6', '#7c3aed', '#14b8a6', '#d946ef',
  '#84cc16', '#f97316', '#0ea5e9', '#a16207', '#64748b', '#be123c', '#065f46', '#4338ca',
]
export const colorFor = (i) => PALETTE[i % PALETTE.length]

/** Chart.js scatter datasets of RNA (x) vs level 4 (y), one dataset per lineage. */
export function rnaScatter(rows, xKey, transform = (x) => x) {
  const byLineage = new Map()
  for (const r of rows || []) {
    const x = r[xKey]
    if (!Number.isFinite(x) || !Number.isFinite(r.l4_mean)) continue
    const key = r.lineage || 'unmapped'
    if (!byLineage.has(key)) byLineage.set(key, [])
    byLineage.get(key).push({ x: transform(x), y: r.l4_mean, label: r.name || r.line })
  }
  const keys = [...byLineage.keys()].sort()
  return {
    n: keys.reduce((s, k) => s + byLineage.get(k).length, 0),
    data: {
      datasets: keys.map((k, i) => ({
        label: k, data: byLineage.get(k), backgroundColor: colorFor(i), pointRadius: 3, pointHoverRadius: 5,
      })),
    },
  }
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

/** Portal route for a study accession: live datasets go to their page, other PXD/MSV to search. */
export function accessionRoute(acc, liveCollections = {}) {
  const a = String(acc || '')
  if (liveCollections[a]) return `/collections/${liveCollections[a]}/${a}`
  if (/^(PXD|MSV)\d+$/i.test(a)) return `/apps/dataset-search?q=${encodeURIComponent(a)}`
  return ''
}

/** Rows of the Datasets tab with a resolved live/pending status. */
export function catalogueRows(catalogue) {
  const live = new Map((catalogue?.live_status?.live || []).map((x) => [x.accession, x.portal_collection]))
  return (catalogue?.datasets || []).map((d) => {
    const isLive = live.has(d.accession) || d.live === 1 || d.live === true
    return { ...d, status: isLive ? 'live' : 'pending', portal_collection: d.portal_collection || live.get(d.accession) || '' }
  })
}

/** Accession → portal collection for live catalogue datasets. */
export function liveCollections(catalogue) {
  const out = {}
  for (const r of catalogueRows(catalogue)) if (r.status === 'live' && r.portal_collection) out[r.accession] = r.portal_collection
  return out
}

/** Radial co-expression layout: strongest partners first from 12 o'clock and closest to the centre. */
export function radialLayout(edges, { cx = 300, cy = 300, radius = 230, inner = 0.55 } = {}) {
  const n = edges.length
  const maxZ = Math.max(...edges.map((e) => Math.abs(e.z) || 0), 1)
  return edges.map((e, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1)
    const strength = Math.abs(e.z) / maxZ
    const d = radius * (inner + (1 - inner) * (1 - strength))
    return {
      ...e, strength, angle,
      x: cx + d * Math.cos(angle),
      y: cy + d * Math.sin(angle),
      anchor: Math.cos(angle) >= 0 ? 'start' : 'end',
    }
  })
}
