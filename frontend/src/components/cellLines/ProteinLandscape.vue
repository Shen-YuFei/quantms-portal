<template>
  <div data-test="landscape">
    <ScatterChart :data="chartData" :options="options" :height="380" @point-click="(p) => $emit('pick', p.gene)" />
    <div class="cl-landscape-zones">
      <span class="cl-zone cl-zone-markers">top left: restricted and reproducible (markers)</span>
      <span class="cl-zone cl-zone-house">top right: everywhere and reproducible (housekeeping)</span>
      <span class="cl-zone cl-zone-care">bottom: weakly reproducible, read with care</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ScatterChart from '../ScatterChart.vue'
import { LANDSCAPE_NOSCORE_Y, fmt, landscapeDatasets, pct } from '../../cellLines.js'

const props = defineProps({
  landscape: { type: Object, default: null },
})
defineEmits(['pick'])

const chartData = computed(() => ({ datasets: landscapeDatasets(props.landscape) }))
const options = {
  animation: false,
  plugins: {
    legend: { position: 'bottom' },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const p = ctx.raw
          return `${p.gene} · detected in ${pct(p.x)} · ICC ${Number.isFinite(p.icc) ? fmt(p.icc) : 'not scored'} · ${p.cat}` +
            (p.cx ? ` · ${p.cx} co-expression partners` : '')
        },
      },
    },
  },
  scales: {
    x: { min: 0, max: 1, title: { display: true, text: 'Share of cell lines where the protein is detected' },
      ticks: { callback: (v) => pct(v) } },
    y: {
      min: -0.5, max: 1.02, title: { display: true, text: 'Reproducible between labs (ICC)' },
      afterBuildTicks: (axis) => { axis.ticks = [LANDSCAPE_NOSCORE_Y, 0, 0.25, 0.5, 0.75, 1].map((value) => ({ value })) },
      ticks: { callback: (v) => (v === LANDSCAPE_NOSCORE_Y ? 'no score' : v) },
    },
  },
}
</script>
