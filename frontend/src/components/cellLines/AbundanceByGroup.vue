<template>
  <div>
    <div class="cl-axis-head">
      <span class="cl-axis-name">{{ L4_AXIS }}</span>
      <span class="cl-axis-ticks"><span>0</span><span>0.5</span><span>1</span></span>
    </div>
    <div v-if="!rows.length" class="cl-empty">No level 4 values for this gene.</div>
    <div v-for="r in rows" :key="r.value" class="cl-abund-row">
      <div class="cl-presence-label" :title="r.value">{{ r.value }}</div>
      <svg class="cl-strip" :viewBox="`0 0 ${W} 22`" preserveAspectRatio="none" role="img"
           :aria-label="`${r.value}: mean rank ${fmt(r.mean_l4)} over ${r.n_lines} lines`">
        <line x1="0" :x2="W" y1="11" y2="11" class="cl-strip-base" />
        <rect v-if="r.box" :x="x(r.box.q1)" y="4" :width="Math.max(1, x(r.box.q3) - x(r.box.q1))" height="14" class="cl-box" />
        <line v-if="r.box" :x1="x(r.box.median)" :x2="x(r.box.median)" y1="2" y2="20" class="cl-median" />
        <circle v-for="(p, i) in r.rows" :key="p.line" :cx="x(p.l4_mean)" :cy="11 + jitter(i)" r="2.2" class="cl-pt">
          <title>{{ p.name || p.line }}: {{ fmt(p.l4_mean) }}</title>
        </circle>
      </svg>
      <div class="cl-abund-stats">
        mean {{ fmt(r.mean_l4) }} · {{ r.n_lines }} lines · {{ pct(r.frac_present) }} detected
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { L4_AXIS, abundanceByGroup, fmt, pct } from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
const W = 300
const x = (v) => Math.min(1, Math.max(0, v)) * W
const jitter = (i) => ((i * 37) % 11) - 5
const rows = computed(() => abundanceByGroup(props.lines, props.groups, props.kind))
</script>
