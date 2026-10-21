<template>
  <div>
    <div class="cl-toolbar cl-box-controls">
      <label class="cl-ctl-inline">Highlight lineage
        <select v-model="hiLineage" aria-label="Highlight lineage" data-test="hi-lineage">
          <option value="">None</option>
          <option v-for="l in lineages" :key="l" :value="l">{{ l }}</option>
        </select>
      </label>
      <label class="cl-ctl-inline">or line
        <input v-model="hiQuery" class="cl-input cl-input-sm" type="search" list="cl-box-lines" placeholder="Line name"
               aria-label="Highlight a line" data-test="hi-line" />
        <datalist id="cl-box-lines"><option v-for="n in lineNames" :key="n" :value="n" /></datalist>
      </label>
      <span v-if="hiQuery && !hiLines.size" class="cl-muted">no line of this gene matches</span>
      <span class="cl-legend">
        <span class="cl-legend-item"><span class="cl-pt-key cl-pt-on"></span>detected</span>
        <span class="cl-legend-item"><span class="cl-pt-key"></span>not detected</span>
      </span>
    </div>
    <div v-if="!shown.length" class="cl-empty">No line has a position and a presence call for this gene.</div>
    <div v-else class="cl-box-scroll">
      <div class="cl-box-wrap" :style="{ width: `${W}px` }" @mouseleave="tip = null">
        <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="cl-boxplot" role="img"
             :aria-label="`Position among lines of the same studies, by ${kind === 'lineage' ? 'lineage' : 'primary disease'}`" data-test="boxplot">
          <g class="cl-box-axis">
            <template v-for="t in TICKS" :key="t">
              <line :x1="PAD_L" :x2="W - 4" :y1="y(t)" :y2="y(t)" class="cl-box-grid" />
              <text :x="PAD_L - 6" :y="y(t) + 4" text-anchor="end">{{ t }}</text>
            </template>
          </g>
          <g v-for="(g, i) in shown" :key="g.value" class="cl-box-group" :class="{ dim: hasHi && !g.points.some(isHi) }" data-test="box-group">
            <rect :x="cx(i) - SLOT / 2" :y="TOP" :width="SLOT" :height="PLOT_H" class="cl-box-hit"
                  @mouseenter="showTip(cx(i), y(g.median ?? 0.5), boxTip(g))" />
            <template v-if="g.box">
              <line :x1="cx(i)" :x2="cx(i)" :y1="y(g.box.hi)" :y2="y(g.box.q3)" class="cl-box-whisker" />
              <line :x1="cx(i)" :x2="cx(i)" :y1="y(g.box.q1)" :y2="y(g.box.lo)" class="cl-box-whisker" />
              <rect :x="cx(i) - BOX_W / 2" :y="y(g.box.q3)" :width="BOX_W" :height="Math.max(1, y(g.box.q1) - y(g.box.q3))"
                    class="cl-box-iqr" @mouseenter="showTip(cx(i), y(g.box.q3), boxTip(g))" />
            </template>
            <line v-if="g.median != null" :x1="cx(i) - BOX_W / 2" :x2="cx(i) + BOX_W / 2" :y1="y(g.median)" :y2="y(g.median)" class="cl-box-median" />
            <circle v-for="(p, j) in g.points" :key="p.line" :cx="cx(i) + jitter(j)" :cy="y(p.l4_mean)" r="2.6"
                    class="cl-box-pt" :class="{ 'cl-pt-on': p.detected, 'cl-pt-ring': isHi(p) }" :data-line="p.line"
                    @mouseenter="showTip(cx(i) + jitter(j), y(p.l4_mean), `${p.name} · more than ${pct(p.l4_mean)} of the cell lines in its studies${p.detected ? '' : ' · not detected'}`)"
                    @click="$emit('select-line', p.line)" />
            <text :transform="`translate(${cx(i) + 4}, ${TOP + PLOT_H + 8}) rotate(-90)`" text-anchor="end" class="cl-box-label">
              <title>{{ g.value }}</title>{{ short(g.value) }}
            </text>
          </g>
        </svg>
        <div v-if="tip" class="cl-box-tip" :class="{ below: tip.below }" role="tooltip" data-test="box-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">{{ tip.text }}</div>
      </div>
    </div>
    <button v-if="hidden" type="button" class="cl-linkbtn" data-test="box-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide' : 'Show all groups:' }} {{ hidden }} with fewer than {{ MIN_GROUP_LINES }} plotted lines or no within-study comparison
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { MIN_GROUP_LINES, groupBoxes, pct, signed } from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
defineEmits(['select-line'])

const TICKS = [0, 0.25, 0.5, 0.75, 1]
const SLOT = 28
const BOX_W = 16
const PAD_L = 34
const TOP = 10
const PLOT_H = 240
const H = TOP + PLOT_H + 120
const showAll = ref(false)
const hiLineage = ref('')
const hiQuery = ref('')
const tip = ref(null)
watch(() => props.kind, () => { showAll.value = false; tip.value = null })

const rows = computed(() => groupBoxes(props.lines, props.groups, props.kind))
const shown = computed(() => (showAll.value ? rows.value : rows.value.filter((g) => !g.small)))
const hidden = computed(() => rows.value.filter((g) => g.small).length)
const W = computed(() => PAD_L + shown.value.length * SLOT + 8)
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
const y = (v) => TOP + (1 - Math.min(1, Math.max(0, v))) * PLOT_H
const jitter = (j) => (((j * 37) % 13) - 6) * 0.9
const short = (s) => (s.length > 20 ? `${s.slice(0, 19)}…` : s)
// Keep the tooltip inside the scroll box: clamp horizontally, flip below near the top.
const showTip = (x, yy, text) => {
  const half = Math.min(150, W.value / 2)
  tip.value = { x: Math.min(W.value - half, Math.max(half, x)), y: yy, below: yy < 80, text }
}
const boxTip = (g) => [
  `${g.value} · ${g.points.length} lines`,
  g.median != null ? `median ${pct(g.median)}` : '',
  g.box ? `middle half ${pct(g.box.q1)}–${pct(g.box.q3)}` : '',
  g.enrichment != null ? `${signed(g.enrichment)} vs other cell lines in the same studies` : 'no within-study comparison',
  g.nocall ? `+${g.nocall} line${g.nocall === 1 ? '' : 's'} without a presence call, not shown` : '',
].filter(Boolean).join(' · ')
</script>
