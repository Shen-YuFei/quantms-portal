<template>
  <div class="section cl-page">
    <div class="container">
      <div class="section-header cl-header">
        <h2>Cancer Cell Line Proteome</h2>
        <p>
          The frozen cancer cell-line proteome atlas: where each protein is detected, how much there is by
          lineage and cancer type, how lines differ, and what each protein moves with. External RNA
          references are shown beside the protein values, never mixed into them.
        </p>
      </div>

      <nav class="cl-tabs" role="tablist" aria-label="Cell-line atlas views">
        <button v-for="t in TABS" :key="t.id" type="button" role="tab" class="cl-tab" :class="{ active: tab === t.id }"
                :aria-selected="tab === t.id" :data-tab="t.id" @click="selectTab(t.id)">{{ t.label }}</button>
      </nav>

      <section v-if="tab === 'protein'" class="cl-card cl-pick-card">
        <AtlasPicker id="cl-gene" kind="gene" label="Gene" placeholder="Gene symbol, e.g. VIM" @select="selectGene" />
      </section>
      <section v-if="tab === 'line'" class="cl-card cl-pick-card">
        <AtlasPicker id="cl-line" kind="line" label="Cell line" placeholder="Name, CVCL_ accession or DepMap ID, e.g. MCF7" @select="selectLine" />
      </section>

      <ProteinTab v-if="tab === 'protein'" :gene="gene" :by="String(route.query.by || '')"
                  @update-by="(b) => setQuery({ by: b })"
                  @select-gene="selectGene" @open-coexpression="(g) => setQuery({ tab: 'coexpression', gene: g })" />
      <LineTab v-else-if="tab === 'line'" :line="line" @select-gene="selectGene" />
      <CompareTab v-else-if="tab === 'compare'" v-bind="compareSel" :groups="groups.data.value || []"
                  @update="updateCompare" @select-gene="selectGene" />
      <CoexpressionTab v-else-if="tab === 'coexpression'" :gene="gene"
                       @select-gene="(g) => setQuery({ gene: g })" @open-protein="selectGene" />
      <DatasetsTab v-else-if="tab === 'datasets'" :studies="datasets.data.value" :loading="datasets.loading.value"
                   :error="datasets.error.value" :retry="datasets.run" />

      <footer class="cl-provenance" data-test="provenance">
        <template v-if="manifest.data.value">
          Updated {{ manifest.data.value.built ? String(manifest.data.value.built).slice(0, 10) : '—' }}
          <template v-if="manifest.data.value.atlas"> · atlas {{ manifest.data.value.atlas }}</template>
          <template v-if="manifest.data.value.level4"> · level 4: {{ manifest.data.value.level4 }}</template>
          <template v-if="amendments"> · amendments {{ amendments }}</template>
        </template>
        <template v-else-if="manifest.error.value">{{ errorMessage(manifest.error.value, 'The manifest') }}</template>
        <template v-else>Loading atlas provenance…</template>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  TABS, tabFromQuery, listFromQuery, errorMessage, getManifest, getGroups, getDatasets,
} from '../cellLines.js'
import { useRequest } from '../components/cellLines/useRequest.js'
import AtlasPicker from '../components/cellLines/AtlasPicker.vue'
import ProteinTab from '../components/cellLines/ProteinTab.vue'
import LineTab from '../components/cellLines/LineTab.vue'
import CompareTab from '../components/cellLines/CompareTab.vue'
import CoexpressionTab from '../components/cellLines/CoexpressionTab.vue'
import DatasetsTab from '../components/cellLines/DatasetsTab.vue'
import '../components/cellLines/cellLines.css'

const route = useRoute()
const router = useRouter()

const manifest = useRequest(getManifest)
const groups = useRequest(getGroups)
const datasets = useRequest(getDatasets)

const tab = computed(() => tabFromQuery(route.query))
const gene = computed(() => String(route.query.gene || ''))
const line = computed(() => String(route.query.line || ''))
const compareSel = computed(() => ({
  mode: route.query.mode === 'groups' ? 'groups' : 'lines',
  lines: listFromQuery(route.query.lines),
  group: route.query.group === 'primary_disease' ? 'primary_disease' : 'lineage',
  a: String(route.query.a || ''),
  b: String(route.query.b || ''),
}))
const amendments = computed(() => (manifest.data.value?.amendments || []).join(', '))

function setQuery(patch) {
  const q = { ...route.query, ...patch }
  for (const [k, v] of Object.entries(q)) {
    if (Array.isArray(v)) q[k] = v.join(',')
    if (q[k] === '' || q[k] === null || q[k] === undefined) delete q[k]
  }
  router.push({ path: route.path, query: q })
}

const selectTab = (id) => setQuery({ tab: id })
const selectGene = (g) => setQuery({ tab: 'protein', gene: g })
const selectLine = (l) => setQuery({ tab: 'line', line: l })
const updateCompare = (patch) => setQuery({ tab: 'compare', ...patch, ...(patch.mode === 'lines' ? { group: '', a: '', b: '' } : {}) })

watch(tab, (t) => {
  if (t === 'datasets' && !datasets.data.value && !datasets.loading.value) datasets.run()
}, { immediate: true })

onMounted(() => {
  manifest.run()
  groups.run()
})
</script>
