<template>
  <div>
    <div class="cl-legend" data-test="dot-legend">
      <span class="cl-legend-item">Size: detected among lines with a presence call
        <span v-for="f in SIZE_KEYS" :key="f" class="cl-legend-item"><span class="cl-gdot" :style="dotStyle(f, 0)"></span>{{ pct(f) }}</span>
      </span>
      <span class="cl-legend-item">Colour: higher/lower than other lines measured in the same studies
        <span class="cl-ramp-end">lower</span><span class="cl-ramp cl-ramp-div"></span><span class="cl-ramp-end">higher</span>
      </span>
    </div>
    <div v-if="!rows.length" class="cl-empty">No group summary for this gene.</div>
    <div v-for="r in shown" :key="r.value" class="cl-gdot-group" data-test="dot-row">
      <button type="button" class="cl-gdot-row" :aria-expanded="!!open[r.value]" @click="toggle(r.value)">
        <span class="cl-presence-label" :title="r.value">{{ r.value }}</span>
        <span class="cl-gdot-cell">
          <span class="cl-gdot" :class="{ 'cl-gdot-none': r.enrichment === null }" :style="dotStyle(r.frac, r.enrichment)"
                :title="`${r.value}: ${dotTitle(r)}`"></span>
        </span>
        <span class="cl-gdot-mean" data-test="dot-enrichment">{{ r.enrichment === null ? '—' : `${signed(r.enrichment)} vs other lines` }}</span>
        <span class="cl-gdot-count" data-test="dot-count">{{ r.n_called ? `${r.n_detected} of ${r.n_called} detected` : 'no presence call' }}</span>
      </button>
      <div v-if="open[r.value]" class="cl-gdot-detail" data-test="dot-strip">
        <div v-if="!r.rows.length" class="cl-empty">No line-level values.</div>
        <template v-else>
          <div class="cl-strip-head">
            <span class="cl-axis-ticks">
              <span v-for="t in TICKS" :key="t" class="cl-tick" :style="{ left: `${t * 100}%` }">{{ t }}</span>
            </span>
          </div>
          <div class="cl-hstrip" role="img" :aria-label="`${r.value}: ${r.rows.length} lines on ${L4_AXIS.toLowerCase()}`">
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
        </template>
      </div>
    </div>
    <button v-if="hidden" type="button" class="cl-linkbtn" data-test="dot-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide' : 'Show' }} {{ hidden }} group{{ hidden === 1 ? '' : 's' }} with fewer than {{ MIN_GROUP_LINES }} lines or no within-study comparison
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  L4_AXIS, MIN_GROUP_LINES, PRESENCE_STATES, groupDots, presenceTooltip, enrichmentColor, signed, fmt, pct,
} from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
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
const dotStyle = (frac, enrichment) => {
  const d = `${(4 + 18 * Math.sqrt(clamp(frac))).toFixed(1)}px`
  return { width: d, height: d, background: enrichmentColor(enrichment) }
}
const dotTitle = (r) => [
  r.enrichment === null ? 'no within-study comparison' : `${signed(r.enrichment)} vs other lines in the same studies`,
  r.n_called ? `${r.n_detected} of ${r.n_called} detected` : 'no presence call',
  `${r.n_lines} lines${r.n_studies != null ? `, ${r.n_studies} studies` : ''}`,
].join(' · ')
const toggle = (v) => { open.value = { ...open.value, [v]: !open.value[v] } }

const rows = computed(() => groupDots(props.lines, props.groups, props.kind))
const shown = computed(() => (showAll.value ? rows.value : rows.value.filter((r) => !r.small)))
const hidden = computed(() => rows.value.filter((r) => r.small).length)
</script>
