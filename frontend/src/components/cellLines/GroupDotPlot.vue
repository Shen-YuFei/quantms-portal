<template>
  <div>
    <div class="cl-legend" data-test="dot-legend">
      <span class="cl-legend-item">Size: detected among lines that measured it
        <span v-for="f in SIZE_KEYS" :key="f" class="cl-legend-item"><span class="cl-gdot" :style="dotStyle(f, 0.5)"></span>{{ pct(f) }}</span>
      </span>
      <span class="cl-legend-item">Colour: mean level 4 <span class="cl-ramp-end">0</span><span class="cl-ramp"></span><span class="cl-ramp-end">1</span></span>
    </div>
    <div v-if="!rows.length" class="cl-empty">No line in this grouping measured this gene.</div>
    <div v-for="r in shown" :key="r.value" class="cl-gdot-group" data-test="dot-row">
      <button type="button" class="cl-gdot-row" :aria-expanded="!!open[r.value]" @click="toggle(r.value)">
        <span class="cl-presence-label" :title="r.value">{{ r.value }}</span>
        <span class="cl-gdot-cell">
          <span class="cl-gdot" :style="dotStyle(r.frac, r.mean_l4)"
                :title="`${r.value}: ${pct(r.frac)} detected, mean level 4 ${fmt(r.mean_l4)}`"></span>
        </span>
        <span class="cl-gdot-mean">{{ fmt(r.mean_l4) }}</span>
        <span class="cl-gdot-count" data-test="dot-count">{{ r.detected }} of {{ r.measured }} detected<template v-if="r.plex"> · {{ r.plex }} TMT plex only</template></span>
      </button>
      <div v-if="open[r.value]" class="cl-gdot-detail" data-test="dot-strip">
        <div class="cl-strip-head">
          <span class="cl-axis-ticks">
            <span v-for="t in TICKS" :key="t" class="cl-tick" :style="{ left: `${t * 100}%` }">{{ t }}</span>
          </span>
        </div>
        <div class="cl-hstrip" role="img" :aria-label="`${r.value}: ${r.measured} lines on ${L4_AXIS.toLowerCase()}`">
          <span v-for="t in TICKS" :key="t" class="cl-hgrid" :style="{ left: `${t * 100}%` }"></span>
          <span v-if="r.box" class="cl-hbox" :style="{ left: pos(r.box.q1), width: span(r.box.q1, r.box.q3) }"
                :title="`IQR ${fmt(r.box.q1)}–${fmt(r.box.q3)}`"></span>
          <span v-for="(p, i) in r.rows" :key="p.line" class="cl-hpt" :class="`cl-p-${p.state}`"
                :style="{ left: pos(p.l4_mean), top: `${50 + jitter(i)}%` }"
                :title="`${presenceTooltip(p)} · level 4 ${fmt(p.l4_mean)}`"></span>
          <span v-if="r.box" class="cl-hmed" :style="{ left: pos(r.box.median) }" :title="`median ${fmt(r.box.median)}`"></span>
        </div>
        <div class="cl-legend">
          <span v-for="s in STRIP_STATES" :key="s.id" class="cl-legend-item"><span class="cl-swatch" :class="`cl-p-${s.id}`"></span>{{ s.label }}</span>
          <span class="cl-legend-item">x: {{ L4_AXIS.toLowerCase() }}</span>
        </div>
      </div>
    </div>
    <button v-if="hidden" type="button" class="cl-linkbtn" data-test="dot-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide' : 'Show' }} {{ hidden }} group{{ hidden === 1 ? '' : 's' }} with fewer than {{ MIN_GROUP_LINES }} lines
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  L4_AXIS, MIN_GROUP_LINES, PRESENCE_STATES, groupDots, presenceTooltip, indigoScale, fmt, pct,
} from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
const TICKS = [0, 0.25, 0.5, 0.75, 1]
const SIZE_KEYS = [0.25, 0.5, 1]
const STRIP_STATES = PRESENCE_STATES.filter((s) => s.id !== 'unmeasured')
const showAll = ref(false)
const open = ref({})
watch(() => props.kind, () => { showAll.value = false; open.value = {} })

const clamp = (v) => Math.min(1, Math.max(0, v || 0))
const pos = (v) => `${clamp(v) * 100}%`
const span = (a, b) => `${Math.max(0.4, (clamp(b) - clamp(a)) * 100)}%`
const jitter = (i) => (((i * 37) % 11) - 5) * 6
// Area grows with the detected fraction.
const dotStyle = (frac, mean) => {
  const d = `${(4 + 18 * Math.sqrt(clamp(frac))).toFixed(1)}px`
  return { width: d, height: d, background: indigoScale(mean) }
}
const toggle = (v) => { open.value = { ...open.value, [v]: !open.value[v] } }

const rows = computed(() => groupDots(props.lines, props.kind))
const shown = computed(() => (showAll.value ? rows.value : rows.value.filter((r) => !r.small)))
const hidden = computed(() => rows.value.filter((r) => r.small).length)
</script>
