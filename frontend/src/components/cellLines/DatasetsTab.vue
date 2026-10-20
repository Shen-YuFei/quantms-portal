<template>
  <div>
    <StatusBlock :loading="loading" :error="error" what="The dataset catalogue" loading-text="Loading the dataset catalogue…" :retry="retry" />
    <template v-if="catalogue && !loading && !error">
      <div class="cl-facts cl-facts-inline">
        <div class="cl-fact"><div class="cl-fact-label">Datasets</div><div class="cl-fact-value">{{ catalogue.n_datasets ?? rows.length }}</div></div>
        <div class="cl-fact"><div class="cl-fact-label">Live on the portal</div><div class="cl-fact-value">{{ catalogue.live_status?.n_live ?? counts.live }}</div></div>
        <div class="cl-fact"><div class="cl-fact-label">Pending reanalysis</div><div class="cl-fact-value">{{ catalogue.live_status?.n_pending ?? counts.pending }}</div></div>
        <div v-if="catalogue.n_baseline_atlas != null" class="cl-fact"><div class="cl-fact-label">In the baseline atlas</div><div class="cl-fact-value">{{ catalogue.n_baseline_atlas }}</div></div>
      </div>
      <section class="cl-card">
        <div class="cl-card-head">
          <h3>Catalogue</h3>
          <div class="cl-toolbar">
            <input v-model="filter" class="cl-input cl-input-sm" type="search" placeholder="Filter accession, acquisition…" aria-label="Filter datasets" />
            <select v-model="status" aria-label="Status filter">
              <option value="">All</option>
              <option value="live">Live</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        <div v-if="!rows.length" class="cl-empty">The catalogue is empty.</div>
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
              <tr v-for="r in shown" :key="r.accession">
                <td>
                  <router-link v-if="r.status === 'live' && r.portal_collection" :to="`/collections/${r.portal_collection}/${r.accession}`">{{ r.accession }}</router-link>
                  <span v-else>{{ r.accession }}</span>
                </td>
                <td><span class="cl-badge" :class="r.status === 'live' ? 'cl-p-high' : 'cl-badge-plain'">{{ r.status }}</span></td>
                <td>{{ r.kind || '—' }}</td>
                <td>{{ r.atlas_role || '—' }}</td>
                <td>{{ r.acquisition || '—' }}</td>
                <td>{{ r.quant || '—' }}</td>
                <td class="num">{{ r.n_cell_lines ?? '—' }}</td>
                <td class="num">{{ r.n_baseline_samples ?? '—' }}</td>
                <td>{{ r.flags || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import StatusBlock from './StatusBlock.vue'
import { catalogueRows, sortRows } from '../../cellLines.js'

const props = defineProps({
  catalogue: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
  retry: { type: Function, default: null },
})

const COLUMNS = [
  { key: 'accession', label: 'Accession' },
  { key: 'status', label: 'Status' },
  { key: 'kind', label: 'Kind' },
  { key: 'atlas_role', label: 'Atlas role' },
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'quant', label: 'Quantification' },
  { key: 'n_cell_lines', label: 'Cell lines', num: true },
  { key: 'n_baseline_samples', label: 'Baseline samples', num: true },
  { key: 'flags', label: 'Flags' },
]

const filter = ref('')
const status = ref('')
const sortKey = ref('n_cell_lines')
const sortDir = ref('desc')

const rows = computed(() => catalogueRows(props.catalogue))
const counts = computed(() => ({
  live: rows.value.filter((r) => r.status === 'live').length,
  pending: rows.value.filter((r) => r.status === 'pending').length,
}))
const shown = computed(() => {
  const q = filter.value.trim().toUpperCase()
  const picked = rows.value.filter((r) => (!status.value || r.status === status.value) &&
    (!q || [r.accession, r.kind, r.acquisition, r.quant, r.atlas_role, r.flags].some((v) => String(v || '').toUpperCase().includes(q))))
  return sortRows(picked, sortKey.value, sortDir.value)
})

function sortBy(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = COLUMNS.find((c) => c.key === key)?.num ? 'desc' : 'asc' }
}
</script>
