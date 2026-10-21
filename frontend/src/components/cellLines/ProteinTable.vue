<template>
  <div>
    <div class="cl-ptable-controls">
      <label class="cl-ctl">Search
        <input v-model="query" class="cl-input" type="search" data-test="table-search"
               placeholder="Gene, UniProt accession or protein name, e.g. ERBB2, P04637, keratin" />
      </label>
      <label class="cl-ctl">Sort by enrichment in lineage
        <select :value="filters.lineage || ''" class="cl-input" data-test="table-lineage" @change="update({ lineage: $event.target.value, sort: '' })">
          <option value="">none (sort by specificity)</option>
          <option v-for="l in lineages" :key="l.lineage" :value="l.lineage">{{ l.lineage }} ({{ l.lines }} lines)</option>
        </select>
      </label>
      <label class="cl-ctl-inline cl-ptable-hide">
        <input type="checkbox" :checked="!!filters.hide" @change="update({ hide: $event.target.checked })" />
        hide contaminant-prone and family rows
      </label>
      <a class="cl-csv" :href="csvUrl" data-test="table-csv">Download CSV</a>
    </div>

    <div class="cl-chips">
      <span class="cl-chips-label">Specificity</span>
      <button v-for="c in specChips" :key="c.key" type="button" class="cl-chip" :class="{ on: c.on }" :style="c.style"
              :aria-pressed="c.on" data-test="spec-chip" @click="toggle('cats', c.key)">{{ c.key }} <b>{{ fmtInt(c.n) }}</b></button>
      <span class="cl-chips-label">Between labs</span>
      <button v-for="c in relChips" :key="c.key" type="button" class="cl-chip" :class="{ on: c.on }" :style="c.style"
              :aria-pressed="c.on" data-test="rel-chip" @click="toggle('rels', c.key)">{{ c.key }} <b>{{ fmtInt(c.n) }}</b></button>
      <button v-if="anyFilter" type="button" class="cl-linkbtn" @click="$emit('update:filters', {})">clear filters</button>
    </div>

    <StatusBlock :loading="req.loading.value && !page" :error="req.error.value" what="The protein table" :retry="load" />
    <div v-if="page" class="cl-table-wrap cl-ptable-wrap">
      <table class="cl-table cl-ptable" data-test="protein-table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :class="c.cls">
              <button v-if="c.sort" type="button" class="cl-sortbtn" :class="{ active: sortKey === c.sort }"
                      :aria-sort="sortKey === c.sort ? (page.descending ? 'descending' : 'ascending') : 'none'"
                      @click="sortBy(c.sort)">{{ c.label }}<span v-if="sortKey === c.sort"> {{ page.descending ? '▾' : '▴' }}</span></button>
              <template v-else>{{ c.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.gene" data-test="protein-row">
            <td class="cl-pt-protein">
              <div class="cl-pt-name">
                <button type="button" class="cl-linkish cl-pt-gene" @click="$emit('select-gene', r.gene)">{{ r.gene }}</button>
                <a v-if="r.accession" class="cl-pt-acc" :href="`https://www.uniprot.org/uniprotkb/${r.accession}`" target="_blank" rel="noopener">{{ r.accession }}</a>
                <span v-if="r.contamination_prone" class="cl-pt-flag cl-pt-flag-contam">contaminant-prone</span>
                <span v-if="r.is_family" class="cl-pt-flag cl-pt-flag-family">family</span>
              </div>
              <div class="cl-muted cl-pt-sub">{{ r.protein_name || '—' }}</div>
            </td>
            <td>
              <div class="cl-pt-det"><b :style="{ color: r.detColor }">{{ pct(r.detected_fraction) }}</b>
                <span class="cl-muted">{{ fmtInt(r.n_lines_present) }} / {{ fmtInt(r.n_lines_measured) }} lines</span></div>
              <div class="cl-pt-bar"><span :style="{ width: r.detWidth, background: r.detColor }"></span></div>
              <div class="cl-muted cl-pt-sub">{{ fmtInt(r.n_lines_present_high) }} with ≥2 peptides</div>
            </td>
            <td class="num"><span class="cl-pt-studies" :style="r.studyStyle">{{ r.n_studies }}</span></td>
            <td>
              <span class="cl-pill" :style="r.relStyle">{{ r.reliability_class }}</span>
              <div class="cl-pt-icc"><span>{{ Number.isFinite(r.icc) ? fmt(r.icc) : '—' }}</span>
                <span class="cl-pt-bar"><span :style="{ width: r.iccWidth, background: r.relBar }"></span></span></div>
            </td>
            <td>
              <div class="cl-pt-spec">
                <span class="cl-pill cl-pill-outline" :style="r.specStyle">{{ r.spec_cat3 }}</span>
                <span v-if="r.spec_robust" class="cl-pt-tag" title="The specificity call agrees between the two views">robust</span>
                <span v-if="r.spec_lab_reproducible" class="cl-pt-tag cl-pt-tag-labs" title="Reproduced by more than one lab">2+ labs</span>
              </div>
              <div class="cl-pt-lineages">
                <span v-for="t in r.tops" :key="t.name" class="cl-lin-chip" :style="t.style">{{ t.name }}</span>
              </div>
            </td>
            <td v-if="filters.lineage" class="cl-pt-lin">
              <span class="cl-pt-heat" :style="r.linStyle">{{ Number.isFinite(r.lineage_enrichment) ? signed(r.lineage_enrichment) : 'no comparison' }}</span>
              <div v-if="r.lineage_called" class="cl-muted cl-pt-sub">detected in {{ r.lineage_detected }} of {{ r.lineage_called }} lines</div>
            </td>
            <td>
              <div v-if="Number.isFinite(r.rna_detect_auc) || Number.isFinite(r.rna_amount_rho)" class="cl-pt-rna">
                <span class="cl-strength" :class="`cl-strength-${r.aucStrength}`" title="How well RNA predicts whether the protein is detected (AUC)">detect {{ Number.isFinite(r.rna_detect_auc) ? fmt(r.rna_detect_auc) : 'n/a' }}</span>
                <span class="cl-strength" :class="`cl-strength-${r.rhoStrength}`" title="Spearman of RNA vs amount in lines where the protein is detected">amount ρ {{ Number.isFinite(r.rna_amount_rho) ? fmt(r.rna_amount_rho) : 'n/a' }}</span>
              </div>
              <span v-else class="cl-muted">too few detections</span>
            </td>
            <td>
              <div class="cl-pt-cx"><b :class="{ 'cl-muted': !r.coexpression_partners }">{{ r.coexpression_partners }}</b>
                <span class="cl-pt-bar"><span :style="{ width: r.cxWidth }" class="cl-pt-cxbar"></span></span></div>
              <div class="cl-pt-partners">
                <button v-for="p in r.coexpression_top" :key="p" type="button" class="cl-partner" @click="$emit('select-gene', p)">{{ p }}</button>
              </div>
            </td>
            <td>
              <template v-if="r.n_complexes">
                <span class="cl-pt-cm">{{ r.n_complexes }}</span>
                <div class="cl-muted cl-pt-sub">{{ r.complex_name }}</div>
              </template>
              <span v-else class="cl-muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="page" class="cl-pager">
      <span class="page-info" data-test="table-count">{{ fmtInt(offset + 1) }}–{{ fmtInt(Math.min(offset + PAGE, page.total)) }} of {{ fmtInt(page.total) }} proteins</span>
      <button type="button" class="page-btn" :disabled="offset === 0" @click="offset = Math.max(0, offset - PAGE)">Previous</button>
      <button type="button" class="page-btn" :disabled="offset + PAGE >= page.total" @click="offset += PAGE">Next</button>
    </div>
    <p class="cl-caption">
      RNA agreement: detect = how well RNA predicts whether the protein is detected (AUC; strong ≥ {{ RNA_AUC_CUTS[0] }}, moderate ≥ {{ RNA_AUC_CUTS[1] }});
      amount ρ = Spearman of RNA vs amount where detected (strong ≥ {{ RNA_RHO_CUTS[0] }}, moderate ≥ {{ RNA_RHO_CUTS[1] }}). Cut-offs are display choices.
      Lineage enrichment compares a lineage's cell lines with the other cell lines of the same studies.
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  getTable, tableCsvUrl, fmt, pct, signed, mixHex, enrichmentColor, specStyle, reliabilityStyle, lineageColors,
  rnaStrength, RNA_AUC_CUTS, RNA_RHO_CUTS, SPEC_KEYS, RELIABILITY_KEYS,
} from '../../cellLines.js'
import { useRequest } from './useRequest.js'
import StatusBlock from './StatusBlock.vue'

const props = defineProps({
  filters: { type: Object, default: () => ({}) },
  lineages: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:filters', 'select-gene'])

const PAGE = 50
const req = useRequest(getTable)
const page = computed(() => req.data.value)
const offset = ref(0)
const query = ref(props.filters.q || '')
let timer = null

const update = (patch) => emit('update:filters', { ...props.filters, ...patch })
const toggle = (field, key) => {
  const cur = props.filters[field] || []
  update({ [field]: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] })
}
const sortKey = computed(() => page.value?.sort || 'specificity')
const sortBy = (key) => update({ sort: key, lineage: key === 'lineage' ? props.filters.lineage : '',
  descending: sortKey.value === key ? !page.value?.descending : undefined })

watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(() => { if (q !== (props.filters.q || '')) update({ q }) }, 250)
})
watch(() => props.filters.q, (q) => { if ((q || '') !== query.value) query.value = q || '' })
onBeforeUnmount(() => clearTimeout(timer))

const load = () => req.run({ ...props.filters, offset: offset.value, limit: PAGE })
watch(() => props.filters, () => { offset.value = 0; load() }, { deep: true, immediate: true })
watch(offset, load)

const csvUrl = computed(() => tableCsvUrl(props.filters))
const anyFilter = computed(() => Object.values(props.filters).some((v) => (Array.isArray(v) ? v.length : !!v)))
const fmtInt = (n) => (Number.isFinite(n) ? Number(n).toLocaleString('en-US') : '—')

const chip = (on, s) => ({ color: s.fg, background: on ? s.bg : 'transparent', borderColor: on ? s.fg : 'var(--border, #e2e8f0)' })
const specChips = computed(() => SPEC_KEYS.map((key) => {
  const on = (props.filters.cats || []).includes(key)
  return { key, on, n: page.value?.facets?.spec_cat3?.[key] ?? 0, style: chip(on, specStyle(key)) }
}))
const relChips = computed(() => RELIABILITY_KEYS.map((key) => {
  const on = (props.filters.rels || []).includes(key)
  return { key, on, n: page.value?.facets?.reliability_class?.[key] ?? 0, style: chip(on, reliabilityStyle(key)) }
}))

const columns = computed(() => [
  { key: 'protein', label: 'Protein', sort: 'gene' },
  { key: 'det', label: 'Detected in', sort: 'detected' },
  { key: 'studies', label: 'Studies', sort: 'studies', cls: 'num' },
  { key: 'rel', label: 'Between labs', sort: 'reliability' },
  { key: 'spec', label: 'Lineage specificity', sort: 'specificity' },
  ...(props.filters.lineage ? [{ key: 'lin', label: `In ${props.filters.lineage}`, sort: 'lineage', cls: 'cl-pt-lin' }] : []),
  { key: 'rna', label: 'RNA agreement', sort: 'rna' },
  { key: 'cx', label: 'Co-expression', sort: 'coexpression' },
  { key: 'cm', label: 'Complexes', sort: 'complexes' },
])

const linColors = computed(() => lineageColors(props.lineages.map((l) => l.lineage)))
const rows = computed(() => (page.value?.rows || []).map((r) => {
  const frac = Number.isFinite(r.detected_fraction) ? r.detected_fraction : 0
  const rel = reliabilityStyle(r.reliability_class)
  const spec = specStyle(r.spec_cat3)
  const e = r.lineage_enrichment
  return {
    ...r,
    detColor: mixHex('#5eead4', '#0f766e', frac),
    detWidth: `${(frac * 100).toFixed(1)}%`,
    studyStyle: { background: mixHex('#dbeafe', '#1e40af', Math.min(1, (r.n_studies || 0) / 14)), color: (r.n_studies || 0) >= 8 ? '#ffffff' : '#1e3a8a' },
    relStyle: { color: rel.fg, background: rel.bg },
    relBar: rel.bar,
    iccWidth: `${Math.max(0, Number.isFinite(r.icc) ? r.icc : 0) * 100}%`,
    specStyle: { color: spec.fg, background: spec.bg, borderColor: spec.dot },
    tops: (r.spec_top || []).slice(0, 3).map((name) => {
      const c = linColors.value[name]
      return { name, style: c ? { color: c.fg, background: c.bg } : {} }
    }),
    linStyle: { background: Number.isFinite(e) ? enrichmentColor(e) : 'var(--bg-alt, #f1f5f9)', color: Number.isFinite(e) && Math.abs(e) > 0.3 ? '#ffffff' : 'inherit' },
    aucStrength: rnaStrength(r.rna_detect_auc, RNA_AUC_CUTS),
    rhoStrength: rnaStrength(r.rna_amount_rho, RNA_RHO_CUTS),
    cxWidth: `${Math.min(100, ((r.coexpression_partners || 0) / 25) * 100)}%`,
  }
}))
</script>
