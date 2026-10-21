<template>
  <div>
    <div v-if="!gene" class="cl-notice">
      Search for a gene or protein (symbol, UniProt accession or name) to see where it is detected, how much there is by lineage and cancer type,
      and what it moves with. Try
      <button v-for="g in examples" :key="g" type="button" class="cl-linkish cl-example" @click="$emit('select-gene', g)">{{ g }}</button>
    </div>
    <StatusBlock v-else :loading="detail.loading.value" :error="detail.error.value" :what="`Gene ${gene}`"
                 :loading-text="`Loading ${gene}…`" :retry="load" />

    <template v-if="gene && d">
      <section class="cl-card" data-test="gene-header">
        <div class="cl-card-head">
          <h2 class="cl-title">{{ s.gene }}</h2>
          <span v-if="s.is_family" class="tag tag-violet" title="Protein-family row: shown on its own, never merged into a member gene">family</span>
          <span v-if="s.contamination_prone" class="tag tag-warning" title="Common contaminant-prone protein; interpret with care">contamination-prone</span>
        </div>
        <p v-if="s.protein_name || s.accessions?.length" class="cl-muted" data-test="gene-protein">
          {{ s.protein_name }}
          <template v-for="acc in s.accessions || []" :key="acc">
            · <a :href="`https://www.uniprot.org/uniprotkb/${acc}`" target="_blank" rel="noopener">{{ acc }}</a>
          </template>
        </p>
        <div class="cl-facts">
          <div class="cl-fact">
            <div class="cl-fact-label">Reliability (level 5)</div>
            <div class="cl-fact-value">{{ s.reliability_class || 'not classified' }}
              <span v-if="s.icc != null" class="cl-muted">ICC {{ fmt(s.icc) }}<template v-if="s.icc_lo != null"> ({{ fmt(s.icc_lo) }}–{{ fmt(s.icc_hi) }})</template></span>
            </div>
          </div>
          <div class="cl-fact">
            <div class="cl-fact-label">Specificity</div>
            <div class="cl-fact-value">{{ s.spec_cat3 || 'no call' }}
              <span v-if="s.spec_top3" class="cl-muted">· {{ s.spec_top3 }}</span>
            </div>
            <div class="cl-fact-sub">
              <span v-if="s.spec_agreement != null">agreement {{ typeof s.spec_agreement === 'number' ? fmt(s.spec_agreement) : s.spec_agreement }}</span>
              <span v-if="s.spec_lab_reproducible != null"> · {{ s.spec_lab_reproducible ? 'reproduced across labs' : 'not reproduced across labs' }}</span>
            </div>
          </div>
          <div class="cl-fact">
            <div class="cl-fact-label">Lines</div>
            <div class="cl-fact-value">{{ s.n_lines_present ?? '—' }} / {{ s.n_lines_measured ?? '—' }}</div>
            <div class="cl-fact-sub">detected / measured<template v-if="s.n_lines_present_high != null"> · {{ s.n_lines_present_high }} with ≥2 peptides</template></div>
          </div>
          <div class="cl-fact">
            <div class="cl-fact-label">Studies</div>
            <div class="cl-fact-value">{{ s.n_studies ?? '—' }}</div>
          </div>
        </div>
        <div class="cl-links">
          <a v-for="l in linkList" :key="l.key" :href="l.href" target="_blank" rel="noopener">{{ l.label }} ↗</a>
        </div>
      </section>

      <details class="cl-howto" data-test="howto">
        <summary>How to read this page</summary>
        <dl>
          <dt>Detected</dt>
          <dd>The protein was identified in that line. TMT studies identify proteins per plex (a pool of 10–16 samples), not per line, so they never count as a line detection.</dd>
          <dt>Profile within each study</dt>
          <dd>How the protein varies across the lines of one study, as log2 difference from that study's average. DIA and label-free DDA use directLFQ; TMT uses piBAQ with IRS on the reference channel. Each study has its own scale.</dd>
          <dt>Across studies</dt>
          <dd>Where a line sits among the lines measured in the same studies, from 0 (lowest) to 1 (highest), averaged over studies. Measured lines where the protein was not detected count as lowest. This is the only view that combines studies.</dd>
          <dt>Abundance in sample</dt>
          <dd>log2 piBAQ: how abundant the protein is compared with other proteins in the same sample. Its scale differs between studies, so compare it only within a study.</dd>
        </dl>
      </details>

      <section class="cl-card">
        <div class="cl-card-head">
          <h3>Detection and abundance by {{ kindLabel }}</h3>
          <GroupToggle v-model="kind" />
        </div>
        <GroupDotPlot :lines="d.lines" :groups="d.groups" :kind="kind" />
        <p class="cl-caption">One row per {{ kindLabel }}, sorted by how much higher its lines rank than the other lines measured in the same studies (A49). Click a row for its lines. Detection uses lines with a presence call; some studies provide abundance but no per-line presence call.</p>
      </section>

      <section class="cl-card">
        <div class="cl-card-head">
          <h3>Profile within each study</h3>
          <GroupToggle v-model="kind" />
        </div>
        <StudyProfile :gene="gene" :values="d.values" :lines="d.lines" :studies="d.studies || []" :kind="kind"
                      @select-line="(l) => $emit('select-line', l)" />
      </section>

      <section class="cl-card">
        <div class="cl-card-head">
          <h3>Across studies: where each line sits</h3>
          <GroupToggle v-model="kind" />
        </div>
        <GroupBoxPlot :lines="d.lines" :groups="d.groups" :kind="kind" @select-line="(l) => $emit('select-line', l)" />
        <p class="cl-caption" data-test="box-caption">Each point is a line: the share of lines measured in the same studies that it is above (0 = lowest, 1 = highest), averaged over its studies. Measured lines where the protein was not detected count as lowest. Boxes summarise each group. Points are lines (filled = detected). Lines without a presence call are not shown. <template v-if="noCallLines">{{ noCallLines }} such line{{ noCallLines === 1 ? '' : 's' }} for this gene. </template>Hover a box or point for details; click a point to open the line.</p>
      </section>

      <section class="cl-card">
        <div class="cl-card-head">
          <h3>Values per study</h3>
          <input v-model="valueFilter" class="cl-input cl-input-sm" type="search" placeholder="Filter by study or line" aria-label="Filter per-study values" />
        </div>
        <p class="cl-caption cl-warn">Each study has its own scale: compare values only between lines under the same study heading.</p>
        <div class="cl-table-wrap">
          <table class="cl-table" data-test="values-table">
            <thead>
              <tr>
                <th>Line</th>
                <th class="num" title="log2 piBAQ: abundance compared with other proteins in the same sample">Abundance in sample (log2 piBAQ)</th>
                <th class="num" title="log2 difference from the study average (TMT: plex average); from directLFQ, or piBAQ + IRS for TMT">Difference from study average (log2)</th>
                <th>Detected</th><th class="num">Peptides</th><th>Comparable</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="v in pagedValues" :key="`${v.study}|${v.line}`">
                <tr v-if="v.firstOfStudy" class="cl-study-row" data-test="study-row">
                  <td colspan="6">{{ v.study }} <span class="cl-muted">· {{ v.acq || '—' }} · {{ methodLabel(studyMeta[v.study]) }}<template v-if="studyMeta[v.study]"> · {{ studyMeta[v.study].n_lines }} lines</template></span></td>
                </tr>
                <tr>
                  <td>{{ lineName[v.line] || v.line }}</td>
                  <td class="num">{{ fmt(v.l1) }}</td>
                  <td class="num">{{ fmt(v.l3) }}</td>
                  <td><span v-if="v.present && v.presence_scope === 'plex'" class="cl-badge cl-p-plex" title="TMT identifies proteins per plex (a pool of samples), not per line">in TMT plex, not per line</span><span v-else class="cl-badge" :class="`cl-p-${v.present_high ? 'high' : v.present ? 'detected' : 'absent'}`">{{ v.present_high ? 'yes, ≥2 peptides' : v.present ? 'yes' : 'no' }}</span></td>
                  <td class="num">{{ v.n_pep ?? '—' }}</td>
                  <td><span v-if="v.comparability" class="cl-badge cl-badge-plain" :title="COMPARABLE[v.comparability]?.title || v.comparability">{{ COMPARABLE[v.comparability]?.label || v.comparability }}</span><span v-else>—</span></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="filteredValues.length > PAGE" class="cl-pager">
          <button type="button" class="page-btn" :class="{ disabled: page === 0 }" :disabled="page === 0" @click="page--">Previous</button>
          <span class="page-info">{{ page * PAGE + 1 }}–{{ Math.min((page + 1) * PAGE, filteredValues.length) }} of {{ filteredValues.length }}</span>
          <button type="button" class="page-btn" :class="{ disabled: (page + 1) * PAGE >= filteredValues.length }" :disabled="(page + 1) * PAGE >= filteredValues.length" @click="page++">Next</button>
        </div>
      </section>

      <section class="cl-card">
        <div class="cl-card-head"><h3>RNA and protein across lines</h3></div>
        <StatusBlock :loading="rna.loading.value" :error="rna.error.value" what="RNA reference" :retry="() => rna.run(gene)" />
        <RnaPanel v-if="rna.data.value" :rna="rna.data.value" :lines="d.lines" :gene="gene" />
      </section>

      <section class="cl-card">
        <div class="cl-card-head">
          <h3>Co-expression neighbours</h3>
          <button type="button" class="cl-linkish" @click="$emit('open-coexpression', gene)">Open network →</button>
        </div>
        <StatusBlock :loading="coexp.loading.value" :error="coexp.error.value" what="Co-expression" :retry="() => coexp.run(gene)" />
        <NeighboursTable v-if="coexp.data.value" :gene="gene" :partners="coexp.data.value.partners || []"
                         :threshold="coexp.data.value.threshold || ''" :min-z="coexp.data.value.display_min_z ?? 4" @select-gene="(g) => $emit('select-gene', g)" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getGene, getGeneRna, getGeneCoexpression, fmt, GROUP_KINDS, kindFromQuery, byParam, presenceState, methodLabel } from '../../cellLines.js'
import { useRequest } from './useRequest.js'
import StatusBlock from './StatusBlock.vue'
import GroupToggle from './GroupToggle.vue'
import GroupDotPlot from './GroupDotPlot.vue'
import GroupBoxPlot from './GroupBoxPlot.vue'
import StudyProfile from './StudyProfile.vue'
import RnaPanel from './RnaPanel.vue'
import NeighboursTable from './NeighboursTable.vue'

const props = defineProps({
  gene: { type: String, default: '' },
  by: { type: String, default: 'lineage' },
})
const emit = defineEmits(['select-gene', 'select-line', 'open-coexpression', 'update-by'])

const examples = ['VIM', 'EPCAM', 'PSMA1']
const PAGE = 50
const COMPARABLE = {
  full: { label: 'across studies', title: 'This study covers several lineages; its lines can be compared with other studies' },
  'within-lineage only': { label: 'within lineage only', title: 'Most lines in this study come from one lineage; compare them with other studies only within that lineage' },
}
const LINK_LABELS = { hpa_cell_line: 'HPA cell line', hpa_tissue: 'HPA tissue', uniprot: 'UniProt', depmap: 'DepMap', string: 'STRING' }

const detail = useRequest(getGene)
const rna = useRequest(getGeneRna)
const coexp = useRequest(getGeneCoexpression)
const valueFilter = ref('')
const page = ref(0)

const kind = computed({
  get: () => kindFromQuery(props.by),
  set: (k) => emit('update-by', byParam(k)),
})
const d = computed(() => detail.data.value)
const noCallLines = computed(() => (d.value?.lines || []).filter((l) => presenceState(l) === 'nocall').length)
const s = computed(() => d.value?.gene || {})
const kindLabel = computed(() => GROUP_KINDS.find((k) => k.id === kind.value).label.toLowerCase())
const linkList = computed(() => Object.keys(LINK_LABELS)
  .filter((k) => d.value?.links?.[k])
  .map((k) => ({ key: k, label: LINK_LABELS[k], href: d.value.links[k] })))
const lineName = computed(() => Object.fromEntries((d.value?.lines || []).map((l) => [l.line, l.name])))
const filteredValues = computed(() => {
  const q = valueFilter.value.trim().toUpperCase()
  const rows = d.value?.values || []
  if (!q) return rows
  return rows.filter((v) => String(v.study).toUpperCase().includes(q) || String(v.line).toUpperCase().includes(q) ||
    String(lineName.value[v.line] || '').toUpperCase().includes(q))
})
const studyMeta = computed(() => Object.fromEntries((d.value?.studies || []).map((x) => [x.study, x])))
const pagedValues = computed(() => filteredValues.value.slice(page.value * PAGE, (page.value + 1) * PAGE)
  .map((v, i, rows) => ({ ...v, firstOfStudy: i === 0 || rows[i - 1].study !== v.study })))
watch(valueFilter, () => { page.value = 0 })

function load() {
  page.value = 0
  if (!props.gene) { detail.reset(); rna.reset(); coexp.reset(); return }
  detail.run(props.gene)
  rna.run(props.gene)
  coexp.run(props.gene)
}
watch(() => props.gene, load, { immediate: true })
</script>
