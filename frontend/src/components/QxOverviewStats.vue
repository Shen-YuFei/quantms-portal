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
    <div class="qo-grid">
      <section v-for="c in idCharts" :key="c.part" class="qo-panel">
        <h3 class="qo-h">{{ c.title }}</h3>
        <p class="qo-note">{{ c.note }}</p>
        <div v-if="parts[c.part].error" class="qo-empty">{{ parts[c.part].error }}</div>
        <div v-else-if="!parts[c.part].loaded" class="qo-skeleton" :style="{ height: `${c.height}px` }"></div>
        <div v-else-if="!rowsOf(c.part).length" class="qo-empty">Not recorded in this dataset.</div>
        <StatsChart v-else type="bar" :data="barData(c)" :options="barOptions(c)" :height="c.height" />
      </section>
    </div>

    <!-- Sample annotations -->
    <template v-if="metaFields.length">
      <h3 class="qo-h qo-h-section">Samples</h3>
      <div class="qo-grid">
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

const props = defineProps({ datasetRef: { type: String, required: true } })

const PARTS = ['summary', 'per_run', 'charge', 'length', 'missed_cleavages', 'metadata']
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

const idCharts = computed(() => [
  { part: 'per_run', title: 'Identifications per run', note: `Target ${sourceLabel.value} in each run, most first.`, height: 220, runs: true },
  { part: 'charge', title: 'Precursor charge', note: `Target ${sourceLabel.value} by charge state.`, height: 220, label: (k) => `${k}+` },
  { part: 'length', title: 'Peptide length', note: `Target ${sourceLabel.value} by sequence length (residues).`, height: 220 },
  { part: 'missed_cleavages', title: 'Missed cleavages', note: `Target ${sourceLabel.value} by missed cleavages.`, height: 220 },
])

function rowsOf(part) {
  const d = parts[part].data
  return (d && d.available && d.rows) || []
}

function cssVar(name, fallback) {
  const v = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name) : ''
  return (v && v.trim()) || fallback
}

// One measure per chart, so one hue: the portal accent.
function bars(labels, values) {
  return {
    labels,
    datasets: [{ data: values, backgroundColor: cssVar('--indigo', '#6366f1'), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28 }],
  }
}

function barData(c) {
  const rows = rowsOf(c.part)
  return bars(rows.map(([k]) => (c.label ? c.label(k) : String(k))), rows.map(([, n]) => n))
}

function barOptions(c) {
  const opts = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  if (c.runs) {
    // hundreds of runs: no tick labels, the tooltip names the run
    opts.scales.x = { ticks: { display: false }, grid: { display: false } }
    opts.datasets = { bar: { categoryPercentage: 1, barPercentage: 0.9, borderRadius: 1 } }
  }
  return opts
}

const META_TITLES = { organism_part: 'Organism part', disease: 'Disease', cell_line: 'Cell line', sex: 'Sex' }
const metaFields = computed(() => {
  const d = parts.metadata.data
  if (!d || !d.available) return []
  return Object.entries(d.fields || {})
    .filter(([, f]) => f.top && f.top.length > 1)
    .map(([key, f]) => ({ key, title: META_TITLES[key] || key, top: f.top, distinct: f.distinct }))
})
const metaData = (f) => bars(f.top.map(([v]) => v), f.top.map(([, n]) => n))
const metaOptions = { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
</script>

<style scoped>
.qo { margin-top: 8px; }
.qo-progress { margin-bottom: 16px; max-width: 420px; }
.qo-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.qo-tile { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 12px 16px; }
.qo-tile-val { font-size: 20px; font-weight: 700; font-family: var(--mono); color: var(--text-primary); }
.qo-tile-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.qo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 20px; align-items: start; }
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
