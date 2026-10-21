<template>
  <div>
    <StatusBlock :loading="req.loading.value" :error="req.error.value" what="The cell-line list" loading-text="Loading the cell lines…" :retry="req.run" />
    <template v-if="all">
      <div class="cl-ptable-controls">
        <label class="cl-ctl">Search
          <input v-model="q" class="cl-input" type="search" data-test="lines-search"
                 placeholder="Name, CVCL accession, DepMap ID or cancer type, e.g. MCF7, CVCL_0023, melanoma" />
        </label>
        <label class="cl-ctl">Lineage
          <select v-model="lineage" class="cl-input" data-test="lines-lineage">
            <option value="">all lineages</option>
            <option v-for="l in lineageOptions" :key="l.name" :value="l.name">{{ l.name }} ({{ l.n }})</option>
          </select>
        </label>
        <label class="cl-ctl">Acquisition
          <select v-model="acq" class="cl-input" data-test="lines-acq">
            <option value="">any</option>
            <option v-for="a in ['DIA', 'DDA', 'TMT']" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
        <label class="cl-ctl-inline cl-ptable-hide">
          <input v-model="multiOnly" type="checkbox" /> measured in 2+ studies
        </label>
        <label class="cl-ctl-inline cl-ptable-hide">
          <input v-model="hideProblematic" type="checkbox" /> hide problematic lines
        </label>
      </div>
      <p v-if="selectable" class="cl-muted cl-lines-pick" data-test="lines-pick-note">
        Tick up to {{ max }} cell lines to compare ({{ selected.length }} / {{ max }} selected).
      </p>
      <div class="cl-table-wrap cl-ptable-wrap cl-lines-wrap">
        <table class="cl-table cl-ptable cl-lines-table" data-test="lines-table">
          <thead>
            <tr>
              <th v-if="selectable"><span class="cl-sr">Select</span></th>
              <th v-for="c in COLUMNS" :key="c.key" :class="c.cls">
                <button type="button" class="cl-sortbtn" :class="{ active: sort === c.key }" @click="sortBy(c.key)">
                  {{ c.label }}<span v-if="sort === c.key"> {{ desc ? '▾' : '▴' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in shown" :key="r.line" data-test="line-row" :class="{ 'cl-row-picked': isPicked(r.line) }">
              <td v-if="selectable">
                <input type="checkbox" :checked="isPicked(r.line)" :disabled="!isPicked(r.line) && selected.length >= max"
                       :aria-label="`Compare ${r.name}`" @change="$emit('toggle', r.line, r)" />
              </td>
              <td class="cl-pt-protein">
                <div class="cl-pt-name">
                  <button type="button" class="cl-linkish cl-pt-gene" @click="$emit('open', r.line)">{{ r.name }}</button>
                  <a class="cl-pt-acc" :href="`https://www.cellosaurus.org/${r.line}`" target="_blank" rel="noopener">{{ r.line }}</a>
                </div>
                <div class="cl-muted cl-pt-sub">{{ r.depmap_id || 'no DepMap ID' }}<template v-if="r.subtype"> · {{ r.subtype }}</template></div>
              </td>
              <td><span class="cl-lin-chip" :style="r.linStyle">{{ r.lineage }}</span></td>
              <td>{{ r.primary_disease }}</td>
              <td>{{ r.sex || '—' }}</td>
              <td class="num"><span class="cl-pt-studies" :style="r.studyStyle" :title="(r.studies || []).join(', ')">{{ r.n_studies }}</span></td>
              <td><span v-for="a in r.acq" :key="a" class="cl-acq" :style="acqStyle(a)">{{ a }}</span></td>
              <td class="num">{{ r.samples }}</td>
              <td class="cl-lines-flags">
                <span v-if="r.non_cancerous" class="cl-pt-flag cl-flag-normal" title="Cellosaurus: not a cancer cell line">non-cancerous</span>
                <span v-if="r.problematic" class="cl-pt-flag cl-pt-flag-contam" :title="r.problematic">problematic</span>
                <span v-if="r.sex_flag" class="cl-pt-flag cl-pt-flag-family" title="Y-chromosome proteins disagree with the annotated sex">sex check</span>
                <span v-if="r.flagged_samples" class="cl-pt-flag cl-flag-qc" :title="`${r.flagged_samples} of ${r.samples} samples flagged by QC`">{{ r.flagged_samples }} QC-flagged</span>
                <span v-if="r.identity_verdict" class="cl-pt-flag cl-flag-qc" :title="r.identity_verdict">identity note</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="cl-pager">
        <span class="page-info" data-test="lines-count">{{ filtered.length.toLocaleString('en-US') }} of {{ all.length.toLocaleString('en-US') }} cell lines</span>
        <button v-if="filtered.length > limit" type="button" class="page-btn" @click="limit += PAGE">Show {{ Math.min(PAGE, filtered.length - limit) }} more</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getAllLines, lineageColor, mixHex, ACQ_STYLES } from '../../cellLines.js'
import { useRequest } from './useRequest.js'
import StatusBlock from './StatusBlock.vue'

const props = defineProps({
  selectable: { type: Boolean, default: false },
  selected: { type: Array, default: () => [] },
  max: { type: Number, default: 5 },
  initialLineage: { type: String, default: '' },
})
defineEmits(['open', 'toggle'])

const PAGE = 100
const COLUMNS = [
  { key: 'name', label: 'Cell line' },
  { key: 'lineage', label: 'Lineage' },
  { key: 'primary_disease', label: 'Cancer type' },
  { key: 'sex', label: 'Sex' },
  { key: 'n_studies', label: 'Studies', cls: 'num' },
  { key: 'acq', label: 'Acquisition' },
  { key: 'samples', label: 'Samples', cls: 'num' },
  { key: 'flags', label: 'Badges' },
]

const req = useRequest(getAllLines)
onMounted(() => req.run())
const all = computed(() => req.data.value)
const q = ref('')
const lineage = ref(props.initialLineage)
const acq = ref('')
const multiOnly = ref(false)
const hideProblematic = ref(false)
const sort = ref('n_studies')
const desc = ref(true)
const limit = ref(PAGE)
watch([q, lineage, acq, multiOnly, hideProblematic, sort, desc], () => { limit.value = PAGE })

const lineageOptions = computed(() => {
  const n = {}
  for (const r of all.value || []) n[r.lineage] = (n[r.lineage] || 0) + 1
  return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, k]) => ({ name, n: k }))
})
const flagCount = (r) => [r.non_cancerous, r.problematic, r.sex_flag, r.flagged_samples, r.identity_verdict].filter(Boolean).length
const value = (r, key) => (key === 'acq' ? (r.acq || []).join(',') : key === 'flags' ? flagCount(r) : r[key])
const filtered = computed(() => {
  const term = q.value.trim().toUpperCase()
  const rows = (all.value || []).filter((r) => {
    if (lineage.value && r.lineage !== lineage.value) return false
    if (acq.value && !(r.acq || []).includes(acq.value)) return false
    if (multiOnly.value && !(r.n_studies >= 2)) return false
    if (hideProblematic.value && r.problematic) return false
    if (!term) return true
    return [r.name, r.line, r.depmap_id, r.primary_disease, r.subtype, r.lineage]
      .some((x) => String(x || '').toUpperCase().includes(term))
  })
  const dir = desc.value ? -1 : 1
  return rows.sort((a, b) => {
    const x = value(a, sort.value)
    const y = value(b, sort.value)
    if (x === y) return String(a.name).localeCompare(String(b.name))
    if (x === null || x === undefined) return 1
    if (y === null || y === undefined) return -1
    return (x < y ? -1 : 1) * dir
  })
})
const shown = computed(() => filtered.value.slice(0, limit.value).map((r) => {
  const c = lineageColor(r.lineage)
  return {
    ...r,
    linStyle: { color: c.fg, background: c.bg },
    studyStyle: { background: mixHex('#dbeafe', '#1e40af', Math.min(1, (r.n_studies || 0) / 8)), color: (r.n_studies || 0) >= 5 ? '#ffffff' : '#1e3a8a' },
  }
}))
const sortBy = (key) => {
  if (sort.value === key) desc.value = !desc.value
  else { sort.value = key; desc.value = ['n_studies', 'samples', 'flags'].includes(key) }
}
const isPicked = (line) => props.selected.includes(line)
const acqStyle = (a) => {
  const s = ACQ_STYLES[a] || { fg: '#334155', bg: '#f1f5f9' }
  return { color: s.fg, background: s.bg }
}
</script>
