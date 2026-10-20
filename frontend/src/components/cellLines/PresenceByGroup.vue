<template>
  <div>
    <div class="cl-legend">
      <span v-for="s in PRESENCE_STATES" :key="s.id" class="cl-legend-item">
        <span class="cl-swatch" :class="`cl-p-${s.id}`"></span>{{ s.label }}
      </span>
    </div>
    <div v-if="!rows.length" class="cl-empty">No lines in this grouping.</div>
    <div v-for="r in rows" :key="r.value" class="cl-presence-row" data-test="presence-row">
      <div class="cl-presence-label" :title="r.value">{{ r.value }}</div>
      <div class="cl-presence-bar" role="img"
           :aria-label="`${r.value}: ${r.counts.high} detected with ≥2 peptides, ${r.counts.detected} detected, ${r.counts.plex} identified in TMT plex only, ${r.counts.absent} not detected, ${r.counts.unmeasured} not measured`">
        <span v-for="s in PRESENCE_STATES" v-show="r.counts[s.id]" :key="s.id" class="cl-seg" :class="`cl-p-${s.id}`"
              :style="{ width: `${(100 * r.counts[s.id]) / (r.total || 1)}%` }"
              :title="`${s.label}: ${r.counts[s.id]} of ${r.total} lines`"></span>
      </div>
      <div class="cl-presence-count">{{ r.counts.high + r.counts.detected }} / {{ r.total }}</div>
      <div class="cl-dots">
        <span v-for="l in r.lines" :key="l.line" class="cl-dot" :class="`cl-p-${l.state}`" :title="presenceTooltip(l)"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { PRESENCE_STATES, presenceByGroup, presenceTooltip } from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
const rows = computed(() => presenceByGroup(props.lines, props.groups, props.kind))
</script>
