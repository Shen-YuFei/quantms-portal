<template>
  <div>
    <div class="cl-toolbar">
      <div class="cl-toggle" role="group" aria-label="RNA reference">
        <button type="button" :class="{ active: source === 'depmap' }" :aria-pressed="source === 'depmap'" @click="source = 'depmap'">DepMap</button>
        <button type="button" :class="{ active: source === 'hpa' }" :aria-pressed="source === 'hpa'" @click="source = 'hpa'">HPA cell lines</button>
      </div>
      <span v-if="source === 'depmap'" class="cl-muted" data-test="rna-agreement">
        Spearman ρ {{ fmt(rna?.agreement?.rna_protein_spearman) }}
        over {{ rna?.agreement?.rna_protein_lines ?? '—' }} lines
        <template v-if="rna?.agreement?.rna_protein_spearman == null">(needs ≥20 lines with both values)</template>
      </span>
      <span v-else class="cl-muted">{{ scatter.n }} lines with both values</span>
    </div>
    <div v-if="!scatter.n" class="cl-empty">No lines with both an RNA value and a protein level 4 value.</div>
    <ScatterChart v-else :data="scatter.data" :options="options" :height="360" />
    <p class="cl-caption">
      RNA is shown as an external reference ({{ source === 'depmap' ? depmapLabel : hpaLabel }});
      it is not used to compute any protein value.
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ScatterChart from '../ScatterChart.vue'
import { L4_AXIS, fmt, rnaScatter } from '../../cellLines.js'

const props = defineProps({ rna: { type: Object, default: null } })
const source = ref('depmap')

const depmapLabel = computed(() => {
  const s = props.rna?.sources?.depmap
  return `DepMap ${s?.release || '24Q4'}, ${s?.licence || 'CC BY 4.0'}`
})
const hpaLabel = computed(() => `Human Protein Atlas cell-line RNA, ${props.rna?.sources?.hpa_rna_celline?.licence || 'CC BY-SA 4.0'}`)

const scatter = computed(() => (source.value === 'depmap'
  ? rnaScatter(props.rna?.depmap, 'log2_tpm')
  : rnaScatter(props.rna?.hpa, 'ntpm', (v) => Math.log2(v + 1))))

const options = computed(() => ({
  plugins: {
    legend: { position: 'bottom' },
    tooltip: { callbacks: { label: (ctx) => `${ctx.raw.label}: RNA ${fmt(ctx.raw.x)}, rank ${fmt(ctx.raw.y)}` } },
  },
  scales: {
    x: { title: { display: true, text: source.value === 'depmap' ? 'DepMap RNA, log2(TPM+1)' : 'HPA RNA, log2(nTPM+1)' } },
    y: { min: 0, max: 1, title: { display: true, text: L4_AXIS } },
  },
}))
</script>
