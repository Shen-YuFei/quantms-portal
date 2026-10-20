<template>
  <div>
    <div class="cl-axis-head">
      <span class="cl-axis-ticks">
        <span v-for="t in TICKS" :key="t" class="cl-tick" :style="{ left: `${t * 100}%` }">{{ t }}</span>
      </span>
      <span class="cl-axis-name">{{ L4_AXIS }}</span>
    </div>
    <div v-if="!shown.length" class="cl-empty">No level 4 values for this gene.</div>
    <div v-for="r in shown" :key="r.value" class="cl-abund-row" data-test="abund-row">
      <div class="cl-presence-label" :title="r.value">{{ r.value }}</div>
      <div class="cl-hstrip" role="img" :aria-label="`${r.value}: mean rank ${fmt(r.mean_l4)} over ${r.n_lines} lines`">
        <span v-for="t in TICKS" :key="t" class="cl-hgrid" :style="{ left: `${t * 100}%` }"></span>
        <span v-if="r.box" class="cl-hbox" :style="{ left: pos(r.box.q1), width: span(r.box.q1, r.box.q3) }"
              :title="`IQR ${fmt(r.box.q1)}–${fmt(r.box.q3)}`"></span>
        <span v-for="(p, i) in r.rows" :key="p.line" class="cl-hpt"
              :style="{ left: pos(p.l4_mean), top: `${50 + jitter(i)}%` }" :title="`${p.name || p.line}: ${fmt(p.l4_mean)}`"></span>
        <span v-if="r.box" class="cl-hmed" :style="{ left: pos(r.box.median) }" :title="`median ${fmt(r.box.median)}`"></span>
      </div>
      <div class="cl-abund-stats">mean {{ fmt(r.mean_l4) }} · {{ r.n_lines }} lines · {{ pct(r.frac_present) }} detected</div>
    </div>
    <button v-if="hidden" type="button" class="cl-linkbtn" data-test="abund-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide' : 'Show' }} {{ hidden }} group{{ hidden === 1 ? '' : 's' }} with fewer than {{ MIN_GROUP_LINES }} lines
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { L4_AXIS, MIN_GROUP_LINES, abundanceByGroup, fmt, pct } from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
const TICKS = [0, 0.25, 0.5, 0.75, 1]
const showAll = ref(false)
watch(() => props.kind, () => { showAll.value = false })
const clamp = (v) => Math.min(1, Math.max(0, v))
const pos = (v) => `${clamp(v) * 100}%`
const span = (a, b) => `${Math.max(0.4, (clamp(b) - clamp(a)) * 100)}%`
const jitter = (i) => (((i * 37) % 11) - 5) * 6
const rows = computed(() => abundanceByGroup(props.lines, props.groups, props.kind))
const shown = computed(() => (showAll.value ? rows.value : rows.value.filter((r) => !r.small)))
const hidden = computed(() => rows.value.filter((r) => r.small).length)
</script>
