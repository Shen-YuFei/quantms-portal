<template>
  <div>
    <div class="cl-toolbar cl-box-controls">
      <label class="cl-ctl-inline">Highlight lineage
        <select v-model="hiLineage" aria-label="Highlight lineage" data-test="hi-lineage">
          <option value="">None</option>
          <option v-for="l in lineages" :key="l" :value="l">{{ l }}</option>
        </select>
      </label>
      <label class="cl-ctl-inline">or cell line
        <input v-model="hiQuery" class="cl-input cl-input-sm" type="search" list="cl-box-lines" placeholder="Cell line name"
               aria-label="Highlight a cell line" data-test="hi-line" />
        <datalist id="cl-box-lines"><option v-for="n in lineNames" :key="n" :value="n" /></datalist>
      </label>
      <span v-if="hiQuery && !hiLines.size" class="cl-muted">no cell line of this gene matches</span>
      <span class="cl-legend">
        <span class="cl-legend-item"><span class="cl-pt-key cl-pt-on"></span>detected</span>
        <span class="cl-legend-item"><span class="cl-pt-key"></span>value without a detection</span>
        <span class="cl-legend-item"><span class="cl-pt-key cl-pt-absent"></span>n.d. = measured, not detected</span>
      </span>
    </div>
    <div v-if="!shown.length" class="cl-empty">No cell line has a value and a presence call for this gene.</div>
    <div v-else class="cl-box-scroll">
      <div class="cl-box-wrap" :style="{ width: `${W}px` }" @mouseleave="tip = null">
        <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="cl-boxplot" role="img"
             :aria-label="`Difference from the study average, by ${kind === 'lineage' ? 'lineage' : 'primary disease'}`" data-test="boxplot">
          <g class="cl-box-axis">
            <template v-for="t in axis.ticks" :key="t">
              <line :x1="PAD_L" :x2="W - 4" :y1="y(t)" :y2="y(t)" class="cl-box-grid" :class="{ 'cl-box-zero': t === 0 }" />
              <text :x="PAD_L - 6" :y="y(t) + 4" text-anchor="end">{{ t > 0 ? `+${t}` : t }}</text>
            </template>
            <text :x="PAD_L - 6" :y="ABSENT_Y + 4" text-anchor="end">n.d.</text>
          </g>
          <g v-for="(g, i) in shown" :key="g.value" class="cl-box-group" :class="{ dim: hasHi && !g.points.some(isHi) }" data-test="box-group">
            <rect :x="cx(i) - SLOT / 2" :y="TOP" :width="SLOT" :height="PLOT_H" class="cl-box-hit"
                  @mouseenter="showTip(cx(i), y(g.median ?? 0), boxTip(g))" />
            <template v-if="g.box">
              <line :x1="cx(i)" :x2="cx(i)" :y1="y(g.box.hi)" :y2="y(g.box.q3)" class="cl-box-whisker" />
              <line :x1="cx(i)" :x2="cx(i)" :y1="y(g.box.q1)" :y2="y(g.box.lo)" class="cl-box-whisker" />
              <rect :x="cx(i) - BOX_W / 2" :y="y(g.box.q3)" :width="BOX_W" :height="Math.max(1, y(g.box.q1) - y(g.box.q3))"
                    class="cl-box-iqr" @mouseenter="showTip(cx(i), y(g.box.q3), boxTip(g))" />
            </template>
            <line v-if="g.median != null" :x1="cx(i) - BOX_W / 2" :x2="cx(i) + BOX_W / 2" :y1="y(g.median)" :y2="y(g.median)" class="cl-box-median" />
            <circle v-for="(p, j) in g.points" :key="p.line" :cx="cx(i) + jitter(j)" :cy="y(p.value)" r="2.6"
                    class="cl-box-pt" :class="{ 'cl-pt-on': p.detected, 'cl-pt-ring': isHi(p) }" :data-line="p.line"
                    @mouseenter="showTip(cx(i) + jitter(j), y(p.value), `${p.name} · ${signed(p.value)} log2 · ${foldText(p.value)}${p.detected ? '' : ' · no detection'}`)"
                    @click="$emit('select-line', p.line)" />
            <circle v-for="(p, j) in g.absent" :key="`nd-${p.line}`" :cx="cx(i) + jitter(j)" :cy="ABSENT_Y" r="2.2"
                    class="cl-box-pt cl-pt-absent" :class="{ 'cl-pt-ring': isHi(p) }" :data-line="p.line"
                    @mouseenter="showTip(cx(i) + jitter(j), ABSENT_Y, `${p.name} · measured, not detected`)"
                    @click="$emit('select-line', p.line)" />
            <text :transform="`translate(${cx(i) + 4}, ${ABSENT_Y + 12}) rotate(-90)`" text-anchor="end" class="cl-box-label">
              <title>{{ g.value }}</title>{{ short(g.value) }}
            </text>
          </g>
        </svg>
        <div v-if="tip" class="cl-box-tip" :class="{ below: tip.below }" role="tooltip" data-test="box-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">{{ tip.text }}</div>
      </div>
    </div>
    <button v-if="hidden" type="button" class="cl-linkbtn" data-test="box-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide' : 'Show all groups:' }} {{ hidden }} with fewer than {{ MIN_GROUP_LINES }} cell lines or no within-study comparison
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { MIN_GROUP_LINES, groupBoxes, profileAxis, foldText, signed } from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
defineEmits(['select-line'])

const SLOT = 28
const BOX_W = 16
const PAD_L = 34
const TOP = 10
const PLOT_H = 240
const ABSENT_Y = TOP + PLOT_H + 18
const H = ABSENT_Y + 130
const showAll = ref(false)
const hiLineage = ref('')
const hiQuery = ref('')
const tip = ref(null)
watch(() => props.kind, () => { showAll.value = false; tip.value = null })

const rows = computed(() => groupBoxes(props.lines, props.groups, props.kind))
const shown = computed(() => (showAll.value ? rows.value : rows.value.filter((g) => !g.small)))
const hidden = computed(() => rows.value.filter((g) => g.small).length)
const W = computed(() => PAD_L + shown.value.length * SLOT + 8)
const axis = computed(() => profileAxis(shown.value))
const lineages = computed(() => [...new Set((props.lines || []).map((l) => l.lineage).filter(Boolean))].sort())
const lineNames = computed(() => [...new Set((props.lines || []).map((l) => l.name || l.line))].sort())
const hiLines = computed(() => {
  const q = hiQuery.value.trim().toUpperCase()
  if (!q) return new Set()
  return new Set((props.lines || []).filter((l) => String(l.name || '').toUpperCase() === q || String(l.line).toUpperCase() === q).map((l) => l.line))
})
const isHi = (p) => (!!hiLineage.value && p.lineage === hiLineage.value) || hiLines.value.has(p.line)
const hasHi = computed(() => !!hiLineage.value || hiLines.value.size > 0)

const cx = (i) => PAD_L + SLOT * i + SLOT / 2
const y = (v) => TOP + (1 - (Math.min(axis.value.max, Math.max(axis.value.min, v)) - axis.value.min) / (axis.value.max - axis.value.min)) * PLOT_H
const jitter = (j) => (((j * 37) % 13) - 6) * 0.9
const short = (s) => (s.length > 20 ? `${s.slice(0, 19)}…` : s)
// Keep the tooltip inside the scroll box: clamp horizontally, flip below near the top.
const showTip = (x, yy, text) => {
  const half = Math.min(150, W.value / 2)
  tip.value = { x: Math.min(W.value - half, Math.max(half, x)), y: yy, below: yy < 80, text }
}
const boxTip = (g) => [
  `${g.value} · ${g.points.length} cell line${g.points.length === 1 ? '' : 's'} with a value`,
  g.median != null ? `median ${signed(g.median)} log2 (${foldText(g.median)})` : '',
  g.box ? `middle half ${signed(g.box.q1)} to ${signed(g.box.q3)}` : '',
  g.absent.length ? `${g.absent.length} measured, not detected` : '',
  g.enrichment != null ? `${signed(g.enrichment)} vs other cell lines in the same studies` : 'no within-study comparison',
  g.nocall ? `+${g.nocall} cell line${g.nocall === 1 ? '' : 's'} measured only in pooled samples, not shown` : '',
].filter(Boolean).join(' · ')
</script>
