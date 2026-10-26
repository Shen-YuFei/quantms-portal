<template>
  <section class="si">
    <QxProgress v-if="loading" label="Computing per-sample intensity…" class="si-progress" />
    <p v-else-if="error" class="notice">{{ error }}</p>
    <p v-else-if="data && !data.available" class="qx-hint">
      Per-sample intensity needs protein-group intensities mapped to samples (pg, run and sample tables).
    </p>
    <template v-else-if="data">
      <div class="si-head">
        <p class="si-summary">
          Protein-group intensity (log10) per sample: box 25–75 %, line median, whiskers 5–95 %.
          <template v-if="labelFree">{{ data.rows.length.toLocaleString() }} samples, label-free (one sample per run). </template>
          <template v-else>
            {{ data.rows.length.toLocaleString() }} samples in {{ data.n_plexes.toLocaleString() }} plex{{ data.n_plexes === 1 ? '' : 'es' }}
            (alternating bands).
          </template>
          <span v-if="nReference">Pooled references in grey are not judged. </span>
          <strong :class="{ 'si-warn': data.n_flagged }">{{ data.n_flagged ? `⚠ ${data.n_flagged} flagged` : 'No sample flagged' }}</strong>
          (robust z &gt; {{ data.robust_z }} {{ labelFree ? 'against all samples' : 'within its plex' }}, and a meaningful difference).
        </p>
        <label class="si-toggle"><input v-model="asTable" type="checkbox" /> Show as table</label>
      </div>

      <QxTable v-if="asTable" :columns="tableColumns" :rows="tableRows" empty-text="No samples." />
      <div v-else class="si-plot" @mouseleave="hover = -1">
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="si-svg" role="img"
             :aria-label="`Protein intensity distribution for ${data.rows.length} samples`">
          <rect v-for="b in bands" :key="b.plex" :x="b.x" y="0" :width="b.w" :height="PLOT_B" class="si-band" />
          <g v-for="t in ticks" :key="t.v">
            <line :x1="0" :x2="W" :y1="t.y" :y2="t.y" class="si-grid" />
          </g>
          <g v-for="(r, i) in data.rows" :key="r.sample">
            <line :x1="cx(i)" :x2="cx(i)" :y1="y(r.q95)" :y2="y(r.q05)" class="si-whisker" :class="{ ref: r.reference }" />
            <rect :x="cx(i) - bw / 2" :y="y(r.q75)" :width="bw" :height="Math.max(1, y(r.q25) - y(r.q75))"
                  class="si-box" :class="{ ref: r.reference, hot: hover === i }" />
            <line :x1="cx(i) - bw / 2" :x2="cx(i) + bw / 2" :y1="y(r.median)" :y2="y(r.median)" class="si-median" />
            <path v-if="r.flags && r.flags.length" :d="marker(i, r)" class="si-flag" />
            <rect :x="i * step" y="0" :width="step" :height="PLOT_B" class="si-hit" @mouseenter="hover = i" />
          </g>
        </svg>
        <div class="si-axis">
          <span v-for="t in ticks" :key="t.v" :style="{ top: `${(t.y / H) * 100}%` }">10<sup>{{ t.v }}</sup></span>
        </div>
        <div v-if="hovered" class="si-tip" :style="tipStyle">
          <strong>{{ hovered.sample }}</strong>
          <span v-if="!labelFree">Plex {{ hovered.plex }} · {{ hovered.label }}{{ hovered.reference ? ' · pooled reference' : '' }}</span>
          <span>Median {{ hovered.median.toFixed(2) }} · IQR {{ hovered.q25.toFixed(2) }}–{{ hovered.q75.toFixed(2) }}</span>
          <span>{{ hovered.n_proteins.toLocaleString() }} protein groups</span>
          <span v-for="f in hovered.flags || []" :key="f.metric" class="si-warn">⚠ {{ flagLabel(f) }}</span>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
// Per-sample protein intensity box plot with plex bands and outlier flags (GET /qc/samples).
import { computed, ref, watch } from 'vue'
import QxTable from './QxTable.vue'
import QxProgress from './QxProgress.vue'
import { qpxQc } from '../qpx.js'

const props = defineProps({ datasetRef: { type: String, required: true } })

const W = 1000
const H = 280
const PLOT_T = 14
const PLOT_B = H - 6

const data = ref(null)
const loading = ref(false)
const error = ref('')
const asTable = ref(false)
const hover = ref(-1)

async function load(r) {
  loading.value = true
  error.value = ''
  data.value = null
  try {
    const d = await qpxQc(r, 'samples')
    if (r === props.datasetRef) data.value = d
  } catch (e) {
    if (r === props.datasetRef) error.value = e.message || 'could not compute sample intensity'
  } finally {
    if (r === props.datasetRef) loading.value = false
  }
}
watch(() => props.datasetRef, (r) => { if (r) load(r) }, { immediate: true })

const rows = computed(() => data.value?.rows || [])
const nReference = computed(() => rows.value.filter((r) => r.reference).length)
// every "plex" a single sample: label-free, so plex bands would only stripe every sample
const labelFree = computed(() => (data.value?.n_plexes || 0) === rows.value.length)
const step = computed(() => W / Math.max(1, rows.value.length))
const bw = computed(() => Math.max(1, Math.min(14, step.value * 0.7)))
const cx = (i) => (i + 0.5) * step.value

const range = computed(() => {
  const lo = Math.min(...rows.value.map((r) => r.q05))
  const hi = Math.max(...rows.value.map((r) => r.q95))
  const pad = (hi - lo) * 0.05 || 0.5
  return [lo - pad, hi + pad]
})
const y = (v) => {
  const [lo, hi] = range.value
  return PLOT_B - ((v - lo) / (hi - lo)) * (PLOT_B - PLOT_T)
}
const ticks = computed(() => {
  const [lo, hi] = range.value
  const out = []
  for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) out.push({ v, y: y(v) })
  return out
})

const bands = computed(() => {
  if (labelFree.value) return []
  const out = []
  rows.value.forEach((r, i) => {
    const last = out[out.length - 1]
    if (last && last.plex === r.plex) last.w += step.value
    else out.push({ plex: r.plex, x: i * step.value, w: step.value })
  })
  return out.filter((_, i) => i % 2 === 1)
})

function marker(i, r) {
  const x = cx(i)
  const top = Math.max(PLOT_T, y(r.q95) - 4)
  return `M${x - 4},${top - 7} L${x + 4},${top - 7} L${x},${top} Z`
}

const hovered = computed(() => (hover.value >= 0 ? rows.value[hover.value] : null))
const tipStyle = computed(() => {
  const frac = (cx(hover.value) / W) * 100
  return frac > 70 ? { right: `${100 - frac}%` } : { left: `${frac}%` }
})

const FLAG_LABELS = { median: 'median intensity', n_proteins: 'protein groups' }
const flagLabel = (f) => `${FLAG_LABELS[f.metric] || f.metric} ${f.direction} (robust z ${f.z})`

const tableColumns = ['sample', 'plex', 'label', 'n_proteins', 'q05', 'q25', 'median', 'q75', 'q95', 'reference', 'flags']
const tableRows = computed(() => rows.value.map((r) => ({
  ...r,
  flags: (r.flags || []).map(flagLabel).join(', ') || '—',
})))
</script>

<style scoped>
.si-progress { max-width: 420px; margin: 24px 0; }
.si-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
.si-summary { margin: 0; font-size: 13px; color: var(--text-secondary); max-width: 860px; }
.si-toggle { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.si-warn { color: var(--qual-medium); font-weight: 600; }
.si-plot { position: relative; padding-left: 38px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.si-svg { display: block; width: 100%; height: 280px; }
.si-band { fill: var(--bg-alt); }
.si-grid { stroke: var(--border); stroke-width: 1; vector-effect: non-scaling-stroke; }
.si-whisker { stroke: var(--indigo); stroke-width: 1; vector-effect: non-scaling-stroke; opacity: 0.6; }
.si-box { fill: var(--indigo); }
.si-box.hot { fill: var(--violet); }
.si-whisker.ref { stroke: var(--reg-ns); }
.si-box.ref { fill: var(--reg-ns); }
.si-median { stroke: var(--surface); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.si-flag { fill: var(--qual-medium); }
.si-hit { fill: transparent; }
.si-axis { position: absolute; left: 0; top: 0; bottom: 0; width: 36px; font-size: 11px; color: var(--text-muted); }
.si-axis span { position: absolute; right: 4px; transform: translateY(-50%); font-family: var(--mono); }
.si-tip { position: absolute; top: 8px; z-index: 3; display: flex; flex-direction: column; gap: 2px; min-width: 200px;
  padding: 8px 10px; border-radius: 8px; background: var(--text-primary); color: var(--surface); font-size: 12px; pointer-events: none; }
.si-tip .si-warn { color: #fbbf24; }
</style>
