<template>
  <div>
    <div class="cl-toolbar cl-gs-tools">
      <label class="cl-ctl-inline">Highlight a cell line
        <input v-model="hiQuery" class="cl-input cl-input-sm" type="search" list="cl-gs-lines" placeholder="Cell line name"
               aria-label="Highlight a cell line" data-test="hi-line" />
        <datalist id="cl-gs-lines"><option v-for="n in lineNames" :key="n" :value="n" /></datalist>
      </label>
      <span v-if="hiQuery && !hiLines.size" class="cl-muted">no cell line of this gene matches</span>
      <span class="cl-legend">
        <span class="cl-legend-item"><span class="cl-pt-key cl-pt-on"></span>detected</span>
        <span class="cl-legend-item"><span class="cl-pt-key"></span>value without a detection</span>
      </span>
    </div>
    <div v-if="!anyAmount" class="cl-empty" data-test="gs-empty">
      No cell line has a per-line amount for {{ gene }}<template v-if="nocall"> ({{ nocall }} cell lines were measured only in pooled samples)</template>.
      Detection by {{ kindLabel }} is still listed below.
    </div>
    <div class="cl-gs-scroll">
      <div class="cl-gs" data-test="group-summary">
        <div class="cl-gs-row cl-gs-head">
          <span>{{ kindLabel }}</span>
          <span>detected</span>
          <span title="Mean within-study rank of this group's cell lines minus the other cell lines of the same studies (A49)">vs other cell lines</span>
          <span class="cl-gs-axis">
            <span class="cl-strip-nd" title="cell lines measured where the protein was not detected">n.d.</span>
            <span class="cl-gs-ticks">
              <span v-for="t in innerTicks" :key="t" :style="{ left: tickPos(t) }">{{ t > 0 ? `+${t}` : t }}</span>
            </span>
          </span>
        </div>
        <div v-for="g in shown" :key="g.value" class="cl-gs-row" :class="{ dim: hasHi && !g.points.some((p) => hiLines.has(p.line)) }"
             data-test="gs-row">
          <span class="cl-gs-name" :title="g.value">{{ g.value }} <span class="cl-muted">{{ g.n_lines }}</span></span>
          <span class="cl-gs-det" data-test="gs-det">
            <span class="cl-gs-bubble" :style="bubble(g)"></span>
            <template v-if="g.n_called">{{ g.n_detected }} of {{ g.n_called }}<span v-if="g.n_weak" class="cl-muted" title="identified with 1 peptide only"> · {{ g.n_weak }} weak</span></template>
            <span v-else-if="g.n_plex_only" class="cl-muted" title="Only TMT studies measured these lines; TMT identifies a protein per plex, not per cell line">TMT only · {{ g.n_plex_only }} lines</span>
            <span v-else class="cl-muted">no per-line call</span>
          </span>
          <span class="cl-gs-enr">
            <template v-if="Number.isFinite(g.enrichment)">
              <span class="cl-gs-enr-bar"><span :style="enrBar(g.enrichment)"></span></span>
              <span class="cl-gs-enr-val">{{ signed(g.enrichment) }}</span>
            </template>
            <span v-else class="cl-muted">—</span>
          </span>
          <AmountStrip :points="g.points" :absent="g.absent" :box="g.box" :median="g.median" :axis="axis" :highlight="hiLines"
                       @select-line="(l) => $emit('select-line', l)" />
        </div>
      </div>
    </div>
    <button v-if="hidden" type="button" class="cl-linkbtn" data-test="gs-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide' : 'Show' }} {{ hidden }} {{ hidden === 1 ? 'group' : 'groups' }} with fewer than {{ MIN_GROUP_LINES }} cell lines or no within-study comparison
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { MIN_GROUP_LINES, GROUP_KINDS, groupSummary, profileAxis, enrichmentColor, signed } from '../../cellLines.js'
import AmountStrip from './AmountStrip.vue'

const props = defineProps({
  gene: { type: String, default: '' },
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
defineEmits(['select-line'])

const showAll = ref(false)
const hiQuery = ref('')
watch(() => props.kind, () => { showAll.value = false })

const kindLabel = computed(() => GROUP_KINDS.find((k) => k.id === props.kind)?.label.toLowerCase() || props.kind)
const rows = computed(() => groupSummary(props.lines, props.groups, props.kind))
const shown = computed(() => (showAll.value ? rows.value : rows.value.filter((g) => !g.small)))
const hidden = computed(() => rows.value.filter((g) => g.small).length)
const anyAmount = computed(() => rows.value.some((g) => g.points.length))
const nocall = computed(() => rows.value.reduce((n, g) => n + g.nocall, 0))
const axis = computed(() => profileAxis(shown.value))
const innerTicks = computed(() => axis.value.ticks.filter((t) => t > axis.value.min && t < axis.value.max))
const tickPos = (t) => `${(((t - axis.value.min) / (axis.value.max - axis.value.min)) * 100).toFixed(2)}%`

const lineNames = computed(() => [...new Set((props.lines || []).map((l) => l.name || l.line))].sort())
const hiLines = computed(() => {
  const q = hiQuery.value.trim().toUpperCase()
  if (!q) return new Set()
  return new Set((props.lines || []).filter((l) => String(l.name || '').toUpperCase() === q || String(l.line).toUpperCase() === q).map((l) => l.line))
})
const hasHi = computed(() => hiLines.value.size > 0)

const bubble = (g) => {
  const f = Number.isFinite(g.frac) ? g.frac : 0
  const size = g.n_called ? 6 + f * 12 : 4
  return { width: `${size}px`, height: `${size}px`, background: g.n_called ? `rgba(15, 118, 110, ${0.25 + f * 0.75})` : 'var(--border)' }
}
const enrBar = (e) => {
  const w = Math.min(50, (Math.abs(e) / 0.5) * 50)
  return { left: e >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: enrichmentColor(e) }
}
</script>
