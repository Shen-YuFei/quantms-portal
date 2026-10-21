<template>
  <div>
    <div class="cl-lmap-scroll">
      <div class="cl-lmap" :style="{ '--cl-lmap-cols': lineages.length }" aria-label="Lineage specificity map" data-test="heatmap">
        <div class="cl-lmap-row cl-lmap-head">
          <span class="cl-lmap-corner">protein</span>
          <span v-for="l in lineages" :key="l.lineage" class="cl-lmap-col"
                :style="{ color: colors[l.lineage].fg }" :title="`${l.lineage} · ${l.lines} cell lines`">
            {{ short(l.lineage) }} <span class="cl-muted">{{ l.lines }}</span>
          </span>
        </div>
        <button v-for="r in rows" :key="r.gene" type="button" class="cl-lmap-row cl-lmap-body" :class="{ 'cl-lmap-first': r.first }"
                :data-gene="r.gene" @click="$emit('pick', { gene: r.gene, lineage: r.lineage })">
          <span class="cl-lmap-label">
            <span class="cl-lmap-dot" :style="{ background: colors[r.lineage]?.dot }"></span>{{ r.gene }}
          </span>
          <span v-for="(v, i) in r.enrichment" :key="i" class="cl-lmap-cell"
                :class="{ own: lineages[i].lineage === r.lineage }" :style="{ background: cellColor(v) }"
                :title="`${r.gene} in ${lineages[i].lineage}: ${Number.isFinite(v) ? signed(v) : 'no within-study comparison'}`"></span>
        </button>
      </div>
    </div>
    <div class="cl-lmap-legend">
      <span>lower in this lineage</span><span class="cl-lmap-ramp"></span><span>higher</span>
      <span class="cl-muted">· within-study enrichment vs the other cell lines of the same studies · number = cell lines in the lineage</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { enrichmentColor, heatmapRows, lineageColors, signed } from '../../cellLines.js'

const props = defineProps({
  heatmap: { type: Array, default: () => [] },
  lineages: { type: Array, default: () => [] },
})
defineEmits(['pick'])

const rows = computed(() => heatmapRows(props.heatmap))
const colors = computed(() => lineageColors(props.lineages.map((l) => l.lineage)))
const cellColor = (v) => (Number.isFinite(v) ? enrichmentColor(v) : 'var(--bg-alt, #f1f5f9)')
const short = (s) => (s.length > 16 ? `${s.slice(0, 15)}…` : s)
</script>
