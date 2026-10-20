<template>
  <div>
    <StatusBlock :loading="loading" :error="error" what="The atlas studies" loading-text="Loading the atlas studies…" :retry="retry" />
    <section v-if="studies && !loading && !error" class="cl-card">
      <div class="cl-card-head">
        <h3 data-test="studies-heading">Studies in this atlas ({{ studies.length }})</h3>
        <input v-model="filter" class="cl-input cl-input-sm" type="search" placeholder="Filter study, accession, acquisition…" aria-label="Filter studies" />
      </div>
      <div v-if="!studies.length" class="cl-empty">No studies are listed for this atlas.</div>
      <div v-else class="cl-table-wrap">
        <table class="cl-table" data-test="datasets-table">
          <thead>
            <tr>
              <th v-for="c in COLUMNS" :key="c.key" :class="{ num: c.num, 'cl-sortable': true }" tabindex="0"
                  :aria-sort="sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'"
                  @click="sortBy(c.key)" @keyup.enter="sortBy(c.key)">{{ c.label }}<span v-if="sortKey === c.key"> {{ sortDir === 'asc' ? '▲' : '▼' }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in shown" :key="r.study">
              <td>{{ r.study }}</td>
              <td>
                <template v-for="(acc, i) in asList(r.accessions)" :key="acc">
                  <span v-if="i">, </span>
                  <a v-if="accessionUrl(acc)" :href="accessionUrl(acc)" target="_blank" rel="noopener">{{ acc }}</a>
                  <span v-else>{{ acc }}</span>
                </template>
              </td>
              <td>{{ asList(r.acq).join(', ') || '—' }}</td>
              <td class="num">{{ r.n_lines ?? '—' }}</td>
              <td class="num">{{ r.n_batches ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="cl-caption">The studies whose cell-line samples make up this atlas. Batches are TMT plexes or other acquisition batches within a study.</p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import StatusBlock from './StatusBlock.vue'
import { accessionUrl, sortRows } from '../../cellLines.js'

const props = defineProps({
  studies: { type: Array, default: null },
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
  retry: { type: Function, default: null },
})

const COLUMNS = [
  { key: 'study', label: 'Study' },
  { key: 'accessions', label: 'Accessions' },
  { key: 'acq', label: 'Acquisition' },
  { key: 'n_lines', label: 'Cell lines', num: true },
  { key: 'n_batches', label: 'Batches / plexes', num: true },
]

const filter = ref('')
const sortKey = ref('n_lines')
const sortDir = ref('desc')
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : [])

const shown = computed(() => {
  const q = filter.value.trim().toUpperCase()
  const rows = (props.studies || []).map((r) => ({ ...r, accessions: asList(r.accessions), acq: asList(r.acq) }))
  const picked = q ? rows.filter((r) => [r.study, ...r.accessions, ...r.acq].some((v) => String(v || '').toUpperCase().includes(q))) : rows
  return sortRows(picked.map((r) => ({ ...r, _sort: Array.isArray(r[sortKey.value]) ? r[sortKey.value].join(',') : r[sortKey.value] })), '_sort', sortDir.value)
})

function sortBy(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = COLUMNS.find((c) => c.key === key)?.num ? 'desc' : 'asc' }
}
</script>
