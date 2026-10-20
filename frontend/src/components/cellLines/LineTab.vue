<template>
  <div>
    <div v-if="!line" class="cl-notice">Search for a cell line by name, Cellosaurus accession (CVCL_…) or DepMap ID.</div>
    <StatusBlock v-else :loading="req.loading.value" :error="req.error.value" :what="`Cell line ${line}`"
                 :loading-text="`Loading ${line}…`" :retry="load" />

    <template v-if="line && d">
      <section class="cl-card" data-test="line-header">
        <div class="cl-card-head">
          <h2 class="cl-title">{{ m.name }}</h2>
          <span v-if="m.flagged_samples > 0" class="tag tag-warning" :title="`${m.flagged_samples} sample(s) carry a QC flag; shown, not excluded`">{{ m.flagged_samples }}{{ m.samples ? ` of ${m.samples}` : '' }} sample{{ (m.samples || m.flagged_samples) === 1 ? '' : 's' }} flagged</span>
          <span v-if="m.sex_flag" class="tag tag-warning" title="Y-chromosome proteins detected; check the annotated sex">sex flag</span>
          <span v-if="m.identity_verdict" class="tag tag-indigo" title="Proteome identity check verdict">identity: {{ m.identity_verdict }}</span>
        </div>
        <div class="cl-facts">
          <div class="cl-fact">
            <div class="cl-fact-label">Cellosaurus</div>
            <div class="cl-fact-value"><a :href="`https://www.cellosaurus.org/${m.line}`" target="_blank" rel="noopener">{{ m.line }} ↗</a></div>
          </div>
          <div class="cl-fact">
            <div class="cl-fact-label">DepMap</div>
            <div class="cl-fact-value">
              <a v-if="m.depmap_id" :href="`https://depmap.org/portal/cell_line/${m.depmap_id}`" target="_blank" rel="noopener">{{ m.depmap_id }} ↗</a>
              <span v-else>—</span>
            </div>
          </div>
          <div class="cl-fact"><div class="cl-fact-label">Lineage</div><div class="cl-fact-value">{{ m.lineage || '—' }}</div></div>
          <div class="cl-fact"><div class="cl-fact-label">Primary disease</div><div class="cl-fact-value">{{ m.primary_disease || '—' }}</div></div>
          <div class="cl-fact"><div class="cl-fact-label">Subtype</div><div class="cl-fact-value">{{ m.subtype || '—' }}</div></div>
          <div class="cl-fact"><div class="cl-fact-label">Sex</div><div class="cl-fact-value">{{ m.sex || '—' }}</div></div>
        </div>
        <p class="cl-caption">QC flags are shown as information only; the frozen atlas does not re-filter on them.</p>
      </section>

      <section class="cl-card">
        <div class="cl-card-head"><h3>Studies</h3></div>
        <div v-if="!d.studies?.length" class="cl-empty">No studies listed for this line.</div>
        <div v-else class="cl-table-wrap">
          <table class="cl-table" data-test="studies-table">
            <thead><tr><th>Study</th><th>Acquisition</th><th class="num">Lines</th><th>Accessions</th></tr></thead>
            <tbody>
              <tr v-for="st in d.studies" :key="st.study">
                <td>{{ st.study }}</td>
                <td>{{ asList(st.acq).join(', ') || '—' }}</td>
                <td class="num">{{ st.n_lines ?? '—' }}</td>
                <td>
                  <template v-for="(acc, i) in asList(st.accessions)" :key="acc">
                    <span v-if="i">, </span>
                    <a v-if="accessionUrl(acc)" :href="accessionUrl(acc)" target="_blank" rel="noopener">{{ acc }}</a>
                    <span v-else>{{ acc }}</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="cl-grid-2">
        <section v-for="t in distinctive" :key="t.key" class="cl-card">
          <div class="cl-card-head"><h3>{{ t.title }}</h3></div>
          <div v-if="!t.rows.length" class="cl-empty">No genes pass the filters (≥3 lineage lines, ≥2 studies).</div>
          <div v-else class="cl-table-wrap">
            <table class="cl-table">
              <thead><tr><th>Gene</th><th class="num">Line</th><th class="num">Lineage mean</th><th class="num">Δ</th><th class="num">Lineage lines</th><th class="num">Studies</th></tr></thead>
              <tbody>
                <tr v-for="r in t.rows" :key="r.gene">
                  <td><button type="button" class="cl-linkish" @click="$emit('select-gene', r.gene)">{{ r.gene }}</button></td>
                  <td class="num">{{ fmt(r.l4_mean) }}</td>
                  <td class="num">{{ fmt(r.lineage_mean_l4) }}</td>
                  <td class="num" :class="r.delta >= 0 ? 'cl-pos' : 'cl-neg'">{{ fmt(r.delta) }}</td>
                  <td class="num">{{ r.lineage_lines ?? '—' }}</td>
                  <td class="num">{{ r.n_studies ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <p class="cl-caption">Descriptive: the line's within-study rank (level 4) minus its lineage mean, for genes measured in ≥3 lines of the lineage and ≥2 studies; contaminant-prone and family rows excluded.</p>

      <section class="cl-card">
        <div class="cl-card-head"><h3>Lineage-enriched proteins detected in this line</h3></div>
        <div v-if="!d.lineage_enriched_present?.length" class="cl-empty">None of the {{ m.lineage }}-enriched proteins are detected in this line.</div>
        <div v-else class="cl-table-wrap">
          <table class="cl-table">
            <thead><tr><th>Gene</th><th>Specificity</th><th>Top lineages</th><th>Reliability</th><th class="num">Level 4</th></tr></thead>
            <tbody>
              <tr v-for="r in d.lineage_enriched_present" :key="r.gene">
                <td><button type="button" class="cl-linkish" @click="$emit('select-gene', r.gene)">{{ r.gene }}</button></td>
                <td>{{ r.spec_cat3 || '—' }}</td>
                <td>{{ r.spec_top3 || '—' }}</td>
                <td>{{ r.reliability_class || '—' }}</td>
                <td class="num">{{ fmt(r.l4_mean) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { getLine, fmt, accessionUrl } from '../../cellLines.js'
import { useRequest } from './useRequest.js'
import StatusBlock from './StatusBlock.vue'

const props = defineProps({
  line: { type: String, default: '' },
})
defineEmits(['select-gene'])

const req = useRequest(getLine)
const d = computed(() => req.data.value)
const m = computed(() => d.value?.line || {})
const distinctive = computed(() => [
  { key: 'higher', title: 'Higher than its lineage', rows: d.value?.higher_than_lineage || [] },
  { key: 'lower', title: 'Lower than its lineage', rows: d.value?.lower_than_lineage || [] },
])
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : [])

function load() {
  if (props.line) req.run(props.line)
  else req.reset()
}
watch(() => props.line, load, { immediate: true })
</script>
