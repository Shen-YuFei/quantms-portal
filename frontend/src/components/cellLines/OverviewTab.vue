<template>
  <div class="cl-overview">
    <StatusBlock :loading="ov.loading.value" :error="ov.error.value" what="The atlas overview" loading-text="Loading the atlas overview…" :retry="ov.run" />
    <template v-if="d">
      <div class="cl-tiles" data-test="tiles">
        <button v-for="t in tiles" :key="t.label" type="button" class="cl-tile" @click="t.pick">
          <span class="cl-tile-num" :style="{ color: t.color }">{{ t.value }}</span>
          <span class="cl-tile-label">{{ t.label }}</span>
          <span class="cl-tile-sub">{{ t.sub }}</span>
        </button>
      </div>

      <div class="cl-ov-row">
        <section class="cl-card cl-ov-heat">
          <div class="cl-card-head">
            <h3>Lineage specificity map</h3>
            <span class="cl-muted">{{ d.heatmap.length }} robust lineage markers, the strongest per lineage · click a row to list it below</span>
          </div>
          <LineageHeatmap :heatmap="d.heatmap" :lineages="d.lineages" @pick="pickMarker" />
        </section>
        <section class="cl-card cl-ov-land">
          <div class="cl-card-head">
            <h3>Protein landscape</h3>
            <span class="cl-muted">{{ fmtInt(d.landscape.rows.length) }} proteins · colour = specificity · size = co-expression partners · click a dot to list it below</span>
          </div>
          <ProteinLandscape :landscape="d.landscape" @pick="(g) => pickGene(g)" />
        </section>
      </div>

      <section ref="tableCard" class="cl-card">
        <div class="cl-card-head"><h3>All proteins</h3></div>
        <ProteinTable :filters="filters" :lineages="d.lineages" @update:filters="(f) => (filters = f)"
                      @select-gene="(g) => $emit('select-gene', g)" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { getOverview } from '../../cellLines.js'
import { useRequest } from './useRequest.js'
import StatusBlock from './StatusBlock.vue'
import LineageHeatmap from './LineageHeatmap.vue'
import ProteinLandscape from './ProteinLandscape.vue'
import ProteinTable from './ProteinTable.vue'

defineEmits(['select-gene'])

const ov = useRequest(getOverview)
const d = computed(() => ov.data.value)
const filters = ref({})
const tableCard = ref(null)
onMounted(() => ov.run())

const fmtInt = (n) => (Number.isFinite(n) ? Number(n).toLocaleString('en-US') : '—')
const showTable = async (f) => {
  filters.value = f
  await nextTick()
  tableCard.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}
const pickGene = (gene) => showTable({ q: gene })
const pickMarker = ({ gene, lineage }) => showTable({ q: gene, lineage })

const tiles = computed(() => {
  const t = d.value?.tiles || {}
  const tile = (value, label, sub, color, f) => ({ value: fmtInt(value), label, sub, color, pick: () => showTable(f) })
  return [
    tile(t.proteins, 'proteins', 'quantified in at least one cell line', 'var(--text-primary, #0f172a)', {}),
    tile(t.lines, 'cell lines', `${fmtInt(t.lineages)} lineages · ${fmtInt(t.diseases)} cancer types`, 'var(--text-primary, #0f172a)', {}),
    tile(t.studies, 'studies', 'reanalysed public datasets', 'var(--text-primary, #0f172a)', {}),
    tile(t.reproducible, 'reproducible between labs', 'the same cell line agrees across labs', '#15803d', { rels: ['reproducible'] }),
    tile(t.enriched, 'lineage / group enriched', `${fmtInt(t.enhanced)} more enhanced · ${fmtInt(t.robust)} robust calls`, '#6d28d9',
      { cats: ['lineage enriched', 'group enriched'] }),
    tile(t.coexpression_links, 'co-expression links', `validated (|Z| ≥ 5) among ${fmtInt(t.coexpression_proteins)} proteins`, '#0369a1',
      { sort: 'coexpression' }),
    tile(t.complexes, 'protein complexes', 'Complex Portal, with members in the atlas', '#7c3aed', { sort: 'complexes' }),
  ]
})
</script>
