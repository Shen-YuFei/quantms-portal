<template>
  <div>
    <p v-if="verdict" class="cl-verdict" :class="`cl-verdict-${verdict.key}`" data-test="rna-verdict">{{ verdict.text }}</p>

    <h4 class="cl-subhead">Detection vs RNA</h4>
    <div class="cl-rna-axis">
      <span class="cl-axis-ticks">
        <span v-for="t in rnaTicks" :key="t" class="cl-tick" :style="{ left: xPos(t) }">{{ t }}</span>
      </span>
    </div>
    <div v-for="g in detection.groups" :key="g.id" class="cl-rna-row" data-test="rna-detection-row">
      <div class="cl-presence-label">{{ g.label }} <span class="cl-muted">n={{ g.n }}</span></div>
      <div class="cl-hstrip" role="img" :aria-label="`${g.label}: ${g.n} lines, median log2(TPM+1) ${fmt(g.box?.median)}`">
        <span v-for="t in rnaTicks" :key="t" class="cl-hgrid" :style="{ left: xPos(t) }"></span>
        <span v-if="g.n >= BOX_MIN_LINES" class="cl-hbox" :style="{ left: xPos(g.box.q1), width: xSpan(g.box.q1, g.box.q3) }"
              :title="`IQR ${fmt(g.box.q1)}–${fmt(g.box.q3)}`"></span>
        <span v-for="(v, i) in g.values" :key="i" class="cl-hpt" :class="`cl-p-${g.id}`"
              :style="{ left: xPos(v), top: `${50 + jitter(i)}%` }"></span>
        <span v-if="g.n >= BOX_MIN_LINES" class="cl-hmed" :style="{ left: xPos(g.box.median) }" :title="`median ${fmt(g.box.median)}`"></span>
      </div>
    </div>
    <p class="cl-caption">DepMap RNA, log2(TPM+1), for lines grouped by whether the protein was detected. <template v-if="detection.nocall">{{ detection.nocall }} line{{ detection.nocall === 1 ? '' : 's' }} without a presence call {{ detection.nocall === 1 ? 'is' : 'are' }} not shown. </template><template v-if="detection.unmeasured">{{ detection.unmeasured }} line{{ detection.unmeasured === 1 ? '' : 's' }} with RNA but no protein measurement {{ detection.unmeasured === 1 ? 'is' : 'are' }} not shown.</template></p>

    <div class="cl-card-head cl-subhead-row">
      <h4 class="cl-subhead">RNA and protein in detected lines</h4>
      <div class="cl-toolbar">
        <div class="cl-toggle" role="group" aria-label="RNA reference">
          <button type="button" :class="{ active: source === 'depmap' }" :aria-pressed="source === 'depmap'" @click="source = 'depmap'">DepMap</button>
          <button type="button" :class="{ active: source === 'hpa' }" :aria-pressed="source === 'hpa'" @click="source = 'hpa'">HPA cell lines</button>
        </div>
        <select v-model="highlight" aria-label="Highlight a lineage">
          <option value="">Highlight a lineage…</option>
          <option v-for="l in lineages" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
    </div>
    <div v-if="source === 'depmap' && a?.flat_rna" class="cl-empty" data-test="rna-flat">RNA barely varies across lines, so the scatter is not shown.</div>
    <template v-else>
      <div v-if="!scatter.n" class="cl-empty">No detected line has both an RNA value and a protein amount.</div>
      <ScatterChart v-else :data="scatter.data" :options="options" :height="340" />
      <p class="cl-caption" data-test="rna-scatter-note">
        {{ scatter.n }} detected lines<template v-if="highlight"> ({{ scatter.highlighted }} {{ highlight }})</template>.
        <template v-if="scatter.excluded">{{ scatter.excluded }} line{{ scatter.excluded === 1 ? '' : 's' }} where the protein was not detected {{ scatter.excluded === 1 ? 'is' : 'are' }} left out (see "Detection vs RNA" above).</template>
      </p>
    </template>

    <template v-if="a">
      <h4 class="cl-subhead">Context</h4>
      <div class="cl-rna-context">
        <div v-for="h in hists" :key="h.id" class="cl-rho-hist" :data-test="`rna-hist-${h.id}`">
          <div class="cl-fact-label">{{ h.label }}</div>
          <div class="cl-rho-bars" role="img" :aria-label="`${h.label} across the atlas; this gene ${fmt(h.value)}`">
            <span v-for="b in h.bars" :key="b.lo" class="cl-rho-bar" :class="{ mine: b.mine }"
                  :style="{ left: `${b.left}%`, width: `${b.width}%`, height: `${b.height}%` }" :title="`${fmt(b.lo)} to ${fmt(b.lo + bin)}: ${b.n} genes`"></span>
            <span v-if="Number.isFinite(h.value)" class="cl-rho-mark" :style="{ left: `${h.pos(h.value)}%` }"></span>
          </div>
          <div class="cl-rho-ticks"><span>{{ h.lo }}</span><span>{{ h.mid }}</span><span>{{ h.hi }}</span></div>
          <div class="cl-fact-sub">
            <template v-if="Number.isFinite(h.value)">{{ gene }} {{ fmt(h.value) }} over {{ h.lines ?? '—' }} lines, {{ pct(h.percentile) }} percentile</template>
            <template v-else>{{ h.missing }}</template>
            <template v-if="h.median != null"> · atlas median {{ fmt(h.median) }} over {{ h.genes }} genes</template>
          </div>
        </div>
        <div class="cl-facts">
          <div class="cl-fact"><div class="cl-fact-label">RNA SD across lines</div><div class="cl-fact-value">{{ fmt(a.rna_sd) }}</div></div>
          <div class="cl-fact"><div class="cl-fact-label">Protein reliability</div><div class="cl-fact-value">{{ a.reliability_class || 'not classified' }} <span v-if="a.reliability_class" class="cl-muted">ICC {{ fmt(a.icc) }}</span></div></div>
          <div class="cl-fact">
            <div class="cl-fact-label">Detected / measured</div>
            <div class="cl-fact-value">{{ a.n_lines_present ?? '—' }} / {{ a.n_lines_measured ?? '—' }}</div>
          </div>
        </div>
      </div>
    </template>

    <p class="cl-caption">
      Detection AUC: how well RNA separates lines where the protein is detected from lines where it is not (0.5 = chance,
      1 = perfect; only lines with a per-line detection call). Amount ρ: Spearman, across detected lines, between RNA and the protein amount
      (log2 difference from the study average). Both are within-gene, across lines.
      RNA is an external reference ({{ source === 'depmap' ? depmapLabel : hpaLabel }}) and never used to compute protein values.
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ScatterChart from '../ScatterChart.vue'
import {
  BOX_MIN_LINES, fmt, pct, signed, presenceState, rnaByDetection, rnaVerdict, detectedScatter,
} from '../../cellLines.js'

const props = defineProps({
  rna: { type: Object, default: null },
  lines: { type: Array, default: () => [] },
  gene: { type: String, default: '' },
})
const source = ref('depmap')
const highlight = ref('')

const a = computed(() => props.rna?.agreement || null)
const atlas = computed(() => props.rna?.atlas || null)
const verdict = computed(() => rnaVerdict(a.value, atlas.value?.flat_rna_sd ?? 0.5))

const depmapLabel = computed(() => {
  const s = props.rna?.sources?.depmap
  return `DepMap ${s?.release || '24Q4'}, ${s?.licence || 'CC BY 4.0'}`
})
const hpaLabel = computed(() => `Human Protein Atlas cell-line RNA, ${props.rna?.sources?.hpa_rna_celline?.licence || 'CC BY-SA 4.0'}`)

const detection = computed(() => rnaByDetection(props.rna?.depmap))
// Data range plus 4% padding each side so edge points stay inside the strip.
const rnaDomain = computed(() => {
  const { min, max } = detection.value
  const pad = Math.max(0.2, (max - min) * 0.04)
  return [min - pad, Math.max(max, min + 1) + pad]
})
const rnaTicks = computed(() => {
  const [lo, hi] = rnaDomain.value
  const step = Math.max(1, Math.ceil((hi - lo) / 6))
  const out = []
  for (let t = Math.ceil(lo); t <= hi; t += step) out.push(t)
  return out
})
const xFrac = (v) => {
  const [lo, hi] = rnaDomain.value
  return (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)
}
const xPos = (v) => `${xFrac(v) * 100}%`
const xSpan = (lo, hi) => `${Math.max(0.4, (xFrac(hi) - xFrac(lo)) * 100)}%`
const jitter = (i) => (((i * 37) % 11) - 5) * 6

// HPA rows carry no protein state, so detection comes from the gene's line rows.
const detectedLines = computed(() => new Set((props.lines || [])
  .filter((l) => ['high', 'detected'].includes(presenceState(l))).map((l) => l.line)))
const scatter = computed(() => (source.value === 'depmap'
  ? detectedScatter(props.rna?.depmap, 'log2_tpm', { highlight: highlight.value })
  : detectedScatter(props.rna?.hpa, 'ntpm', {
    transform: (v) => Math.log2(v + 1), isDetected: (r) => detectedLines.value.has(r.line), highlight: highlight.value,
  })))
const lineages = computed(() => {
  const rows = source.value === 'depmap' ? props.rna?.depmap : props.rna?.hpa
  return [...new Set((rows || []).map((r) => r.lineage).filter(Boolean))].sort()
})
watch(source, () => { if (!lineages.value.includes(highlight.value)) highlight.value = '' })

const options = computed(() => ({
  plugins: {
    legend: { display: !!highlight.value, position: 'bottom' },
    tooltip: { callbacks: { label: (ctx) => `${ctx.raw.label} (${ctx.raw.lineage}): RNA ${fmt(ctx.raw.x)}, amount ${signed(ctx.raw.y)} log2` } },
  },
  scales: {
    x: { min: scatter.value.xMin, max: scatter.value.xMax, ticks: { includeBounds: false },
      title: { display: true, text: source.value === 'depmap' ? 'DepMap RNA, log2(TPM+1)' : 'HPA RNA, log2(nTPM+1)' } },
    y: { title: { display: true, text: 'Difference from study average (log2)' } },
  },
}))

const bin = computed(() => atlas.value?.bin || 0.05)
const histogram = (dist, value, lo, hi) => {
  const hist = dist?.hist || []
  const top = Math.max(1, ...hist.map((h) => h[1]))
  const pos = (v) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100
  return {
    pos, median: dist?.median ?? null, genes: dist?.genes ?? null,
    bars: hist.map(([b, n]) => ({
      lo: b, n, left: pos(b), width: (bin.value / (hi - lo)) * 100, height: Math.max(2, (n / top) * 100),
      mine: Number.isFinite(value) && value >= b && value < b + bin.value + 1e-9,
    })),
  }
}
const hists = computed(() => {
  const ag = a.value || {}
  return [
    { id: 'auc', label: 'RNA predicts detection (AUC)', value: ag.rna_detect_auc, lines: (ag.rna_detect_lines ?? 0) + (ag.rna_undetected_lines ?? 0),
      percentile: ag.auc_percentile, lo: 0, mid: 0.5, hi: 1, missing: 'No AUC (needs ≥10 detected and ≥10 not-detected lines)',
      ...histogram(atlas.value?.auc, ag.rna_detect_auc, 0, 1) },
    { id: 'rho', label: 'Amount follows RNA (ρ)', value: ag.rna_amount_rho, lines: ag.rna_amount_lines,
      percentile: ag.rho_percentile, lo: '−1', mid: 0, hi: 1, missing: 'No ρ (needs ≥20 detected lines with RNA)',
      ...histogram(atlas.value?.rho, ag.rna_amount_rho, -1, 1) },
  ]
})
</script>
