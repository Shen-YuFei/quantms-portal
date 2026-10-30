<template>
  <div class="qo">
    <QxProgress
      v-if="done < PARTS.length"
      :value="done / PARTS.length"
      :label="`Computing statistics · ${done} of ${PARTS.length}`"
      class="qo-progress"
    />

    <!-- Headline numbers -->
    <div v-if="tiles.length" class="qo-tiles">
      <div v-for="t in tiles" :key="t.label" class="qo-tile">
        <div class="qo-tile-val">{{ t.value }}</div>
        <div class="qo-tile-label">{{ t.label }}</div>
      </div>
    </div>

    <!-- Identification charts -->
    <div class="qo-grid" :style="gridCols(visibleCharts.length)">
      <section v-for="c in visibleCharts" :key="c.part" class="qo-panel">
        <h3 class="qo-h">{{ c.title }}</h3>
        <p class="qo-note">{{ c.note }}{{ outsideNote(c.part) }}</p>
        <div v-if="parts[c.part].error" class="qo-empty">{{ parts[c.part].error }}</div>
        <div v-else-if="!parts[c.part].loaded" class="qo-skeleton" :style="{ height: `${c.height}px` }"></div>
        <StatsChart v-else type="bar" :data="barData(c)" :options="barOptions(c)" :height="c.height" />
      </section>
    </div>

    <!-- Sample annotations -->
    <template v-if="metaFields.length">
      <h3 class="qo-h qo-h-section">Samples</h3>
      <div class="qo-grid" :style="gridCols(metaFields.length)">
        <section v-for="f in metaFields" :key="f.key" class="qo-panel">
          <h3 class="qo-h">{{ f.title }}</h3>
          <p class="qo-note">{{ f.distinct.toLocaleString() }} distinct{{ f.distinct > f.top.length ? ` · top ${f.top.length} shown` : '' }}</p>
          <StatsChart type="bar" :data="metaData(f)" :options="metaOptions" :height="Math.max(140, f.top.length * 24)" />
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
// Overview statistics for one qpx dataset. Each part is its own request, so the
// progress bar counts real completed work rather than guessing.
import { computed, reactive, watch } from 'vue'
import StatsChart from './StatsChart.vue'
import QxProgress from './QxProgress.vue'
import { qpxStats } from '../qpx.js'
import { chartColor } from '../utils/chartColors.js'

const props = defineProps({ datasetRef: { type: String, required: true } })

const PARTS = ['summary', 'per_run', 'charge', 'length', 'missed_cleavages', 'mass_error', 'rt',
  'intensity', 'pep', 'peptides_per_protein', 'metadata']
const blank = () => ({ loaded: false, error: '', data: null })
const parts = reactive(Object.fromEntries(PARTS.map((p) => [p, blank()])))
const done = computed(() => PARTS.filter((p) => parts[p].loaded || parts[p].error).length)

function load(ref) {
  for (const p of PARTS) {
    Object.assign(parts[p], blank())
    qpxStats(ref, p)
      .then((d) => { if (ref === props.datasetRef) Object.assign(parts[p], { loaded: true, data: d }) })
      .catch((e) => { if (ref === props.datasetRef) parts[p].error = e.message || 'could not compute' })
  }
}
watch(() => props.datasetRef, (r) => { if (r) load(r) }, { immediate: true })

const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 }))
const sourceLabel = computed(() => (parts.summary.data?.source === 'psm' ? 'PSMs' : 'features'))

const tiles = computed(() => {
  const s = parts.summary.data
  if (!s || !s.available) return []
  const out = [
    { label: 'Peptides', value: fmt(s.n_peptides) },
    { label: 'Peptidoforms', value: fmt(s.n_peptidoforms) },
    { label: `Median ${sourceLabel.value} per run`, value: fmt(s.median_per_run) },
  ]
  if (s.decoy_pct) out.push({ label: `Decoy ${sourceLabel.value}`, value: `${s.decoy_pct}%` })
  return out.filter((t) => t.value !== '—')
})

const H = 220
const idCharts = computed(() => {
  const src = sourceLabel.value
  return [
    { part: 'per_run', title: 'Identifications per run', note: `Target ${src} in each run, most first.`, height: H, runs: true },
    { part: 'charge', title: 'Precursor charge', note: `Target ${src} by charge state.`, height: H, label: (k) => `${k}+` },
    { part: 'length', title: 'Peptide length', note: `Target ${src} by sequence length (residues).`, height: H },
    { part: 'missed_cleavages', title: 'Missed cleavages', note: `Target ${src} by missed cleavages.`, height: H },
    { part: 'peptides_per_protein', title: 'Peptides per protein group', note: 'Protein groups by number of peptides; 20 means 20 or more.', height: H, label: (k) => (k >= 20 ? '20+' : String(k)) },
    { part: 'mass_error', title: 'Precursor mass error', note: `Target ${src} by mass error (ppm); a tight peak near 0 means good calibration.`, height: H, hist: 1 },
    { part: 'rt', title: 'Retention time', note: `Target ${src} by retention time (minutes): how the gradient was used.`, height: H, hist: 0 },
    { part: 'intensity', title: 'Feature intensity', note: 'Target features by intensity (log10, summed over channels): dynamic range.', height: H, hist: 1 },
    { part: 'pep', title: 'Posterior error probability', note: `Target ${src} by PEP (log10); further left is more confident.`, height: H, hist: 1 },
  ]
})

function rowsOf(part) {
  const d = parts[part].data
  if (!d || !d.available) return []
  if (d.bins) return d.bins.map(([lo, hi, n]) => [(lo + hi) / 2, n])
  return d.rows || []
}

// Hide a panel once its part is known to have no data, so the grid has no holes.
const visibleCharts = computed(() => idCharts.value.filter((c) => {
  const p = parts[c.part]
  return p.error || !p.loaded || rowsOf(c.part).length > 0
}))

// Columns that leave the fewest empty slots in the last row (ties prefer 3).
function gridCols(n) {
  const best = [3, 2, 4].reduce((a, c) => ((n % c ? c - (n % c) : 0) < (n % a ? a - (n % a) : 0) ? c : a), 3)
  return { '--qo-cols': Math.max(1, Math.min(n, best)) }
}

// One measure per chart, so one hue: --data for counts, or the hue of the
// metadata dimension the chart is about.
function bars(labels, values, role = 'data') {
  return {
    labels,
    datasets: [{ data: values, backgroundColor: chartColor(role), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24 }],
  }
}

// Enough decimals that neighbouring bins get different labels.
function binDecimals(part) {
  const w = parts[part].data?.bin_width
  return w > 0 ? Math.min(6, Math.max(0, Math.ceil(-Math.log10(w)))) : 1
}

function outsideNote(part) {
  const d = parts[part].data
  if (!d || !d.n_outside) return ''
  const total = d.n_outside + (d.bins || []).reduce((a, b) => a + b[2], 0)
  return ` ${d.n_outside.toLocaleString()} (${((100 * d.n_outside) / total).toFixed(1)}%) outside the range are not drawn.`
}

function barData(c) {
  const rows = rowsOf(c.part)
  const label = c.label || (c.hist != null ? (k) => Number(k).toFixed(binDecimals(c.part)) : String)
  return bars(rows.map(([k]) => label(k)), rows.map(([, n]) => n))
}

function barOptions(c) {
  const opts = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  if (c.hist != null) {
    // a histogram: bars touch
    opts.datasets = { bar: { categoryPercentage: 1, barPercentage: 1, borderRadius: 1 } }
  }
  if (c.runs) {
    // hundreds of runs: no tick labels, the tooltip names the run
    opts.scales.x = { ticks: { display: false }, grid: { display: false } }
    opts.datasets = { bar: { categoryPercentage: 1, barPercentage: 0.9, borderRadius: 1 } }
  }
  return opts
}

const META_TITLES = { organism_part: 'Organism part', disease: 'Disease', cell_line: 'Cell line', sex: 'Sex' }
const META_COLORS = { organism_part: 'tissue', disease: 'disease', cell_line: 'cellLine' }
const metaFields = computed(() => {
  const d = parts.metadata.data
  if (!d || !d.available) return []
  return Object.entries(d.fields || {})
    .filter(([, f]) => f.top && f.top.length > 1)
    .map(([key, f]) => ({ key, title: META_TITLES[key] || key, top: f.top, distinct: f.distinct }))
})
const metaData = (f) => bars(f.top.map(([v]) => v), f.top.map(([, n]) => n), META_COLORS[f.key])
const metaOptions = { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
</script>

<style scoped>
.qo { margin-top: 8px; }
.qo-progress { margin-bottom: 16px; max-width: 420px; }
.qo-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.qo-tile { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 12px 16px; }
.qo-tile-val { font-size: 20px; font-weight: 700; font-family: var(--mono); color: var(--text-primary); }
.qo-tile-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.qo-grid { display: grid; grid-template-columns: repeat(var(--qo-cols, 3), minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; align-items: start; }
@media (max-width: 1000px) { .qo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.qo-panel { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 14px 16px; min-width: 0; }
.qo-h { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-primary); }
.qo-h-section { font-size: 16px; margin: 8px 0 12px; }
.qo-note { font-size: 12px; color: var(--text-muted); margin: 2px 0 10px; }
.qo-empty { color: var(--text-muted); font-size: 13px; padding: 24px 0; text-align: center; }
.qo-skeleton { border-radius: 6px; background: linear-gradient(90deg, var(--border) 25%, var(--bg-alt) 50%, var(--border) 75%);
  background-size: 200% 100%; animation: qo-shimmer 1.4s infinite; opacity: 0.5; }
@keyframes qo-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .qo-skeleton { animation: none; } }
@media (max-width: 600px) { .qo-grid { grid-template-columns: 1fr; } }
</style>
