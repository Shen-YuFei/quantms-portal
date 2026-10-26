<template>
  <div class="section" style="padding-top: 100px">
    <div class="container">
      <div class="crumbs">
        <router-link to="/collections" class="crumb">Collections</router-link>
        <span>›</span>
        <router-link to="/applications" class="crumb">Applications</router-link>
        <span>›</span>
        <span class="crumb-current">qpx Dataset Explorer</span>
      </div>

      <h1 class="qx-title">qpx Dataset Explorer</h1>
      <p class="qx-sub">
        Open one content-addressed qpx dataset (<code>accession/phash</code>) and query it with
        DuckDB — files, runs, samples, protein groups, peptides and a curated query gallery.
        <router-link to="/docs/applications" class="qx-doc-link">Apps overview →</router-link>
      </p>

      <!-- Dataset selector -->
      <div class="qx-picker">
        <input
          v-model="refInput"
          class="qx-input"
          placeholder="e.g. MSV000085836/8e4c044b513d"
          spellcheck="false"
          @keyup.enter="loadRef"
        />
        <button class="page-btn primary" :disabled="!refInput.trim()" @click="loadRef">Explore</button>
        <span v-if="visibleRef" class="qx-picker-ref">{{ visibleRef }}</span>
      </div>

      <!-- Not loaded -->
      <div v-if="!loaded && !loading && !error" class="qx-placeholder">
        <span class="placeholder-icon">🧬</span>
        <p>Enter a dataset ref above, or open one from a dataset's page (Downloads → “Explore with DuckDB”).</p>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="loading-block">Querying dataset with DuckDB…</div>

      <!-- Error -->
      <div v-else-if="error" class="notice">
        {{ error }}
        <button class="page-btn" style="margin-left: 12px" @click="loadRef">Retry</button>
      </div>

      <!-- Loaded -->
      <template v-else-if="overview">
        <!-- Overview cards -->
        <div class="qx-cards">
          <div class="qx-card">
            <div class="qx-card-val">{{ count(overview.row_counts.feature) }}</div>
            <div class="qx-card-label">Features</div>
          </div>
          <div class="qx-card">
            <div class="qx-card-val">{{ count(overview.row_counts.pg) }}</div>
            <div class="qx-card-label">Protein groups</div>
          </div>
          <div class="qx-card">
            <div class="qx-card-val">{{ count(overview.row_counts.psm) }}</div>
            <div class="qx-card-label">PSMs</div>
          </div>
          <div class="qx-card">
            <div class="qx-card-val">{{ overview.available_views.run ? nRuns : '—' }}</div>
            <div class="qx-card-label">Runs</div>
          </div>
          <div class="qx-card">
            <div class="qx-card-val">{{ overview.available_views.sample ? nSamples : '—' }}</div>
            <div class="qx-card-label">Samples</div>
          </div>
        </div>
        <p v-if="hasMissingViews" class="qx-hint">
          Some views are missing ({{ missingViews.join(', ') }}) — the dataset is likely label-free or
          doesn't ship that qpx table; those tabs will be empty.
        </p>

        <!-- Tabs -->
        <div class="qx-tabs">
          <button
            v-for="t in tabs"
            :key="t.id"
            class="qx-tab"
            :class="{ active: tab === t.id }"
            @click="setTab(t.id)"
          >{{ t.label }}</button>
        </div>

        <!-- Overview tab -->
        <div v-if="tab === 'overview'" class="qx-tab-body">
          <div class="qx-block" v-if="filesList.length">
            <div class="qx-block-label">qpx files</div>
            <ul class="qx-file-list">
              <li v-for="f in filesList" :key="f">{{ f }}</li>
            </ul>
          </div>
          <div class="qx-block">
            <div class="qx-block-label">Organisms</div>
            <div class="qx-chips">
              <span v-for="o in overview.organisms" :key="o" class="tag tag-green">{{ o }}</span>
              <span v-if="!overview.organisms.length" class="text-muted">—</span>
            </div>
          </div>
          <div class="qx-block">
            <div class="qx-block-label">Instruments</div>
            <div class="qx-chips">
              <span v-for="i in overview.instruments" :key="i" class="tag tag-blue">{{ i }}</span>
              <span v-if="!overview.instruments.length" class="text-muted">—</span>
            </div>
          </div>
          <div class="qx-block">
            <div class="qx-block-label">Acquisition methods</div>
            <div class="qx-chips">
              <span v-for="a in overview.acquisition_methods" :key="a" class="tag">{{ a }}</span>
              <span v-if="!overview.acquisition_methods.length" class="text-muted">—</span>
            </div>
          </div>
        </div>

        <!-- Runs tab -->
        <div v-else-if="tab === 'runs'" class="qx-tab-body">
          <div v-if="runs.length" class="dataset-table-wrap">
            <table class="dataset-table">
              <thead><tr><th>Run</th></tr></thead>
              <tbody>
                <tr v-for="r in runs" :key="r.run_file_name">
                  <td class="td-title" :title="r.run_file_name">{{ r.run_file_name }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="placeholder-empty">No run table for this dataset.</div>
        </div>

        <!-- Samples tab -->
        <div v-else-if="tab === 'samples'" class="qx-tab-body">
          <div v-if="samples.length" class="dataset-table-wrap">
            <table class="dataset-table">
              <thead>
                <tr>
                  <th v-for="c in sampleColumns" :key="c">{{ colLabel(c) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, idx) in samples" :key="idx">
                  <td v-for="c in sampleColumns" :key="c">{{ val(s[c]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="placeholder-empty">No sample table for this dataset.</div>
        </div>

        <!-- Proteins tab -->
        <div v-else-if="tab === 'proteins'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="proteinQ" class="qx-input" placeholder="Filter by accession or gene…" @keyup.enter="loadProteins" />
              <button class="page-btn" :disabled="busy.proteins" @click="loadProteins">{{ busy.proteins ? 'Loading…' : 'Search' }}</button>
            </div>
            <span class="muted">{{ proteins.length }} shown</span>
            <button class="page-btn qx-sort" @click="toggleProteinSort">
              {{ proteinSort === 'qvalue' ? 'Sorted by q-value ↑' : 'Sort by q-value' }}
            </button>
          </div>
          <div v-if="proteins.length" class="dataset-table-wrap">
            <table class="dataset-table">
              <thead>
                <tr>
                  <th>Protein</th><th>Genes</th><th>q-value</th><th>Intensity</th>
                  <th>Peptides</th><th>Coverage</th><th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in sortedProteins" :key="p[0]">
                  <td class="accession-link">{{ p[0] }}</td>
                  <td>{{ p[1] || '—' }}</td>
                  <td class="td-num">{{ num(p[2]) }}</td>
                  <td class="td-num">{{ num(p[3]) }}</td>
                  <td class="td-num">{{ num(p[4]) }}</td>
                  <td class="td-num">{{ pct(p[5]) }}</td>
                  <td><button class="page-btn" @click="openProtein(p[0])">Peptides</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="placeholder-empty">No protein groups match.</div>

          <!-- Protein detail -->
          <div v-if="selectedProtein" class="qx-prot-detail">
            <div class="qx-block">
              <div class="qx-block-label">
                {{ selectedProtein }}
                <button class="page-btn" style="margin-left: 10px" @click="selectedProtein = null">Close</button>
              </div>
              <p v-if="proteinDetail.error" class="muted">{{ proteinDetail.error }}</p>
              <div v-else-if="proteinDetail.loading" class="muted">Loading peptides…</div>
              <div v-else-if="proteinDetail.expr && proteinDetail.expr.per_run && proteinDetail.expr.per_run.length" class="qx-block" style="margin-top: 10px;">
                <div class="qx-block-label">
                  Protein expression (per run, summed feature intensity)
                  <span v-if="proteinDetail.expr.group_intensity != null" class="muted" style="text-transform:none">
                    · group intensity {{ num(proteinDetail.expr.group_intensity) }}
                  </span>
                </div>
                <div class="dataset-table-wrap">
                  <table class="dataset-table">
                    <thead><tr><th>Run</th><th>Features</th><th>Summed intensity</th><th>Max feature intensity</th></tr></thead>
                    <tbody>
                      <tr v-for="(e, i) in proteinDetail.expr.per_run" :key="i">
                        <td class="td-title" :title="e.run">{{ e.run }}</td>
                        <td class="td-num">{{ num(e.n_features) }}</td>
                        <td class="td-num">{{ num(e.summed_intensity) }}</td>
                        <td class="td-num">{{ num(e.max_feature_intensity) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-else-if="proteinDetail.expr && proteinDetail.expr.per_run && !proteinDetail.expr.per_run.length" class="muted">
                No per-run feature evidence for this protein.
              </div>
              <div v-if="proteinDetail.peptides.length" class="dataset-table-wrap" style="margin-top: 10px;">
                <table class="dataset-table">
                  <thead><tr><th>Peptide</th><th>Charge</th><th>Run</th><th>RT</th><th>q-value</th></tr></thead>
                  <tbody>
                    <tr v-for="(pep, i) in proteinDetail.peptides" :key="i">
                      <td class="td-title" :title="pep.sequence">{{ pep.sequence }}</td>
                      <td class="td-num">{{ num(pep.charge) }}</td>
                      <td class="td-title" :title="pep.run_file_name">{{ pep.run_file_name }}</td>
                      <td class="td-num">{{ num(pep.rt) }}</td>
                      <td class="td-num">{{ num(pep.peptide_qvalue) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="muted">No supporting peptides found.</div>
            </div>
          </div>
        </div>

        <!-- Peptides tab -->
        <div v-else-if="tab === 'peptides'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="peptideQ" class="qx-input" placeholder="Filter by sequence…" @keyup.enter="loadPeptides" />
              <button class="page-btn" :disabled="busy.peptides" @click="loadPeptides">{{ busy.peptides ? 'Loading…' : 'Search' }}</button>
            </div>
            <span class="muted">{{ peptides.length }} shown</span>
          </div>
          <div v-if="peptides.length" class="dataset-table-wrap">
            <table class="dataset-table">
              <thead><tr><th>Peptide</th><th>PSMs</th><th>Runs</th></tr></thead>
              <tbody>
                <tr v-for="p in peptides" :key="p[0]">
                  <td class="td-title" :title="p[0]">{{ p[0] }}</td>
                  <td class="td-num">{{ num(p[1]) }}</td>
                  <td class="td-num">{{ num(p[2]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="placeholder-empty">No peptides match.</div>
        </div>

        <!-- Features tab -->
        <div v-else-if="tab === 'features'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="featureQ" class="qx-input" placeholder="Filter by sequence or peptidoform…" @keyup.enter="loadFeatures" />
              <input v-model="featureCharge" type="number" min="1" max="10" class="qx-input qx-input-sm" placeholder="charge" title="Precursor charge" />
              <input v-model="featureQmax" type="number" min="0" max="1" step="0.0001" class="qx-input qx-input-sm" placeholder="q-max" title="Max peptide q-value" />
              <input v-model="featureMod" class="qx-input qx-input-sm" placeholder="PTM (e.g. Oxidation)" title="Only features carrying this modification" @keyup.enter="loadFeatures" />
              <button class="page-btn" :disabled="busy.features" @click="loadFeatures">{{ busy.features ? 'Loading…' : 'Search' }}</button>
            </div>
            <span class="muted">{{ features.length }} shown</span>
          </div>
          <div v-if="features.length" class="dataset-table-wrap">
            <table class="dataset-table">
              <thead>
                <tr>
                  <th v-for="c in featureColumns" :key="c">{{ colLabel(c) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(f, i) in features" :key="i">
                  <td v-for="(c, j) in featureColumns" :key="c" :class="j ? 'td-num' : 'td-title'" :title="String(f[j])">{{ val(f[j]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="placeholder-empty">No features match your filters.</div>
        </div>

        <!-- PTMs tab -->
        <div v-else-if="tab === 'ptms'" class="qx-tab-body">
          <p v-if="ptmSource === 'none'" class="qx-hint">
            This dataset carries no PTM annotation (no <code>mods</code>/<code>mod_sites</code> / bracket-encoded <code>peptidoform</code>).
          </p>
          <div v-else-if="ptms.length" class="dataset-table-wrap">
            <table class="dataset-table">
              <thead>
                <tr>
                  <th>Modification</th><th>Features</th>
                  <th v-if="ptmColumns.includes('n_peptides')">Peptides</th>
                  <th v-if="ptmColumns.includes('n_peptidoforms')">Peptidoforms</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, i) in ptms" :key="i">
                  <td class="td-title">{{ m[0] }}</td>
                  <td class="td-num">{{ num(m[1]) }}</td>
                  <td v-if="ptmColumns.includes('n_peptides')" class="td-num">{{ num(m[2]) }}</td>
                  <td v-if="ptmColumns.includes('n_peptidoforms')" class="td-num">{{ num(m[3]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="placeholder-empty">No PTMs detected in this dataset.</div>
        </div>

        <!-- Spectra tab -->
        <div v-else-if="tab === 'spectra'" class="qx-tab-body">
          <div class="filter-bar">
            <div class="filter-group">
              <input v-model="psmQ" class="qx-input" placeholder="Filter spectral evidence by peptide…" @keyup.enter="loadPsms" />
              <button class="page-btn" :disabled="busy.psms" @click="loadPsms">{{ busy.psms ? 'Loading…' : 'Search' }}</button>
            </div>
            <span class="muted">{{ psms.length }} shown</span>
          </div>
          <p class="qx-hint">
            Scan-level spectral assignments from the PSM table — raw peak lists aren't stored in the
            parquet, so this surfaces the <code>scan</code>/precursor metadata that is available.
          </p>
          <div v-if="psms.length" class="dataset-table-wrap">
            <table class="dataset-table">
              <thead>
                <tr><th v-for="c in psmColumns" :key="c">{{ colLabel(c) }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in psms" :key="i">
                  <td v-for="(c, j) in psmColumns" :key="c" :class="j ? 'td-num' : 'td-title'" :title="String(s[j])">{{ val(s[j]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else-if="psmAbsent" class="placeholder-empty">No PSM table for this dataset.</div>
          <div v-else class="placeholder-empty">No spectral evidence matches.</div>
        </div>

        <!-- Queries tab: SQL editor + LLM -->
        <div v-else-if="tab === 'queries'" class="qx-tab-body">
          <div v-if="!nlEnabled" class="qx-hint qx-nl-off">
            “Ask in English” is unavailable — the LLM isn't configured on this deployment. Use the SQL editor below.
          </div>

          <div class="qx-nl-box">
            <div class="qx-block-label">Ask in English</div>
            <div class="filter-group">
              <input
                v-model="nlQuestion"
                class="qx-input qx-nl-input"
                placeholder='e.g. "top 10 proteins by intensity"'
                :disabled="!nlEnabled || nlRunning"
                @keyup.enter="askNl"
              />
              <button class="page-btn primary" :disabled="!nlEnabled || nlRunning || !nlQuestion.trim()" @click="askNl">
                {{ nlRunning ? 'Thinking…' : 'Ask' }}
              </button>
            </div>
            <p v-if="nlError" class="notice">{{ nlError }}</p>
          </div>

          <div class="qx-sql-box">
            <div class="qx-block-label">SQL editor (DuckDB · read-only SELECT)</div>
            <textarea
              v-model="sqlText"
              rows="7"
              class="qx-sql"
              spellcheck="false"
              placeholder="SELECT sequence, charge, peptide_qvalue FROM feature WHERE NOT is_decoy ORDER BY peptide_qvalue ASC LIMIT 10"
            ></textarea>
            <div class="filter-group" style="margin-top: 8px">
              <label class="muted">limit</label>
              <input v-model.number="sqlLimit" type="number" min="1" :max="sqlMaxRows" class="qx-input qx-input-sm" />
              <button class="page-btn primary" :disabled="sqlRunning || !sqlText.trim()" @click="runSql">
                {{ sqlRunning ? 'Running…' : 'Run' }}
              </button>
              <button class="page-btn" :disabled="schemaLoading" @click="loadSchema">
                {{ schemaLoading ? 'Loading…' : 'Show columns' }}
              </button>
              <span class="muted qx-sql-hint">SELECT-only · confined to this dataset · max {{ sqlMaxRows }} rows</span>
            </div>
            <p v-if="sqlInfo" class="qx-hint" style="margin-top: 6px">{{ sqlInfo }}</p>
            <p v-if="sqlError" class="notice">{{ sqlError }}</p>
          </div>

          <!-- Result -->
          <div v-if="sqlResult" class="qx-sql-result">
            <div class="qx-block-label" style="margin-top: 18px">
              Result
              <span v-if="sqlResult.truncated" class="muted" style="text-transform: none">· truncated at {{ sqlResult.limit }} rows</span>
            </div>
            <div v-if="sqlResult.error" class="notice">{{ sqlResult.error }}</div>
            <div v-else-if="sqlResult.available === false" class="placeholder-empty">No qpx views are available in this dataset.</div>
            <template v-else-if="sqlResult.columns && sqlResult.columns.length">
              <div class="dataset-table-wrap">
                <table class="dataset-table">
                  <thead><tr><th v-for="c in sqlResult.columns" :key="c">{{ colLabel(c) }}</th></tr></thead>
                  <tbody>
                    <tr v-for="(row, i) in sqlResult.rows" :key="i">
                      <td v-for="(cell, j) in row" :key="j" :class="j ? 'td-num' : ''">{{ val(cell) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
            <div v-else class="placeholder-empty">No rows.</div>
          </div>

          <!-- Column schema -->
          <div v-if="schemaViews.length" class="qx-schema">
            <div class="qx-block-label" style="margin-top: 18px">Available views</div>
            <div v-for="v in schemaViews" :key="v.name" class="qx-schema-view">
              <strong class="qx-schema-name">{{ v.name }}</strong>
              <span class="qx-schema-cols">{{ (v.columns || []).map(c => c.name).join(', ') }}</span>
            </div>
          </div>

          <!-- Examples (curated queries become editable starting points) -->
          <div class="qx-examples">
            <div class="qx-block-label" style="margin-top: 18px">Examples</div>
            <div class="qx-query-list">
              <button
                v-for="ex in examples"
                :key="ex.id"
                class="qx-query-item"
                :class="{ active: exampleBusy === ex.id }"
                :disabled="exampleBusy !== '' && exampleBusy !== ex.id"
                @click="loadExample(ex)"
              >
                <strong>{{ ex.title }}</strong>
                <span class="muted">{{ ex.description }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  qpxOverview, qpxRuns, qpxSamples, qpxSearchProteins,
  qpxSearchPeptides, qpxProtein, qpxProteinExpression,
  qpxSearchFeatures, qpxPtms, qpxPsms, qpxSchema, qpxRunSql, qpxFromNl,
} from '../qpx.js'

const route = useRoute()
const router = useRouter()

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'runs', label: 'Runs' },
  { id: 'samples', label: 'Samples' },
  { id: 'proteins', label: 'Proteins' },
  { id: 'peptides', label: 'Peptides' },
  { id: 'features', label: 'Features' },
  { id: 'ptms', label: 'PTMs' },
  { id: 'spectra', label: 'Spectra' },
  { id: 'queries', label: 'Query' },
]

//: Curated queries, surfaced as clickable, editable examples for the SQL editor.
//: These are representative DuckDB SELECT statements over the qpx views — the
//: SQL editor (and the LLM path) are the primary interface, per "predefined
//: queries are only interesting as examples".
const examples = [
  {
    id: 'top_proteins',
    title: 'Protein groups by intensity',
    description: 'Top protein groups, strongest first.',
    sql: "SELECT anchor_protein, global_qvalue, intensity FROM pg WHERE NOT is_decoy ORDER BY intensity DESC NULLS LAST LIMIT 20",
  },
  {
    id: 'psms_per_run',
    title: 'PSMs and peptides per run',
    description: 'Count PSMs and distinct peptides per run file.',
    sql: "SELECT run_file_name AS run, count(*) AS n_psms, count(DISTINCT sequence) AS n_peptides FROM psm WHERE NOT is_decoy GROUP BY run_file_name ORDER BY n_psms DESC LIMIT 20",
  },
  {
    id: 'features_per_run',
    title: 'Feature evidence per run',
    description: 'Count peptide features (and distinct sequences) per run file.',
    sql: "SELECT run_file_name AS run, count(*) AS n_features, count(DISTINCT sequence) AS n_peptides FROM feature WHERE NOT is_decoy GROUP BY run_file_name ORDER BY n_features DESC LIMIT 20",
  },
  {
    id: 'top_peptides',
    title: 'Most observed peptides',
    description: 'Rank peptides by how many PSMs support them.',
    sql: "SELECT sequence, count(*) AS n_psms, count(DISTINCT run_file_name) AS n_runs FROM psm WHERE NOT is_decoy GROUP BY sequence ORDER BY n_psms DESC LIMIT 20",
  },
  {
    id: 'charge_distribution',
    title: 'Precursor charge distribution',
    description: 'How many features carry each precursor charge state.',
    sql: "SELECT charge, count(*) AS n FROM feature WHERE NOT is_decoy GROUP BY charge ORDER BY n DESC LIMIT 20",
  },
  {
    id: 'peptide_lengths',
    title: 'Peptide length distribution',
    description: 'Number of features by peptide length (residues).',
    sql: "SELECT length(sequence) AS n_residues, count(*) AS n FROM feature WHERE NOT is_decoy GROUP BY length(sequence) ORDER BY n_residues LIMIT 60",
  },
  {
    id: 'decoy_rate',
    title: 'Decoy rate',
    description: 'Share of target-decoy decoy features in the feature table.',
    sql: "SELECT sum(CASE WHEN is_decoy THEN 1 ELSE 0 END) AS n_decoys, count(*) AS n_total, round(100.0 * sum(CASE WHEN is_decoy THEN 1.0 ELSE 0.0 END) / nullif(count(*), 0), 3) AS decoy_pct FROM feature",
  },
]

const refInput = ref('')
const visibleRef = ref('')
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const tab = ref('overview')

const overview = ref(null)
const filesList = ref([])
const runs = ref([])
const samples = ref([])
const sampleColumns = ref([])

const proteinQ = ref('')
const proteins = ref([])
const selectedProtein = ref('')
const proteinDetail = ref({ loading: false, error: '', peptides: [] })
const proteinSort = ref('intensity')
const sortedProteins = computed(() => {
  const arr = proteins.value.slice()
  if (proteinSort.value === 'qvalue') {
    arr.sort((a, b) => {
      const qa = Number(a[2])
      const qb = Number(b[2])
      if (Number.isNaN(qa)) return 1
      if (Number.isNaN(qb)) return -1
      return qa - qb
    })
  }
  return arr
})

const peptideQ = ref('')
const peptides = ref([])

const featureQ = ref('')
const featureCharge = ref('')
const featureQmax = ref('')
const featureMod = ref('')
const features = ref([])
const featureColumns = ref([])

//: Per-tab "loading" flags for the Search/Run buttons (scoped to a dataset open).
const busy = ref({ proteins: false, peptides: false, features: false, psms: false, ptms: false })

const ptms = ref([])
const ptmColumns = ref([])
const ptmSource = ref('')

const psmQ = ref('')
const psms = ref([])
const psmColumns = ref([])
const psmAbsent = ref(false)

//: SQL editor + LLM "Ask in English".
const sqlMaxRows = 2000
const nlEnabled = true
const nlQuestion = ref('')
const nlRunning = ref(false)
const nlError = ref('')
const sqlText = ref('')
const sqlLimit = ref(200)
const sqlRunning = ref(false)
const sqlResult = ref(null)
const sqlError = ref('')
const sqlInfo = ref('')
const schemaLoading = ref(false)
const schemaViews = ref([])
const exampleBusy = ref('')

const nRuns = computed(() => runs.value.length)
const nSamples = computed(() => samples.value.length)

const missingViews = computed(() => {
  if (!overview.value) return []
  return ['feature', 'pg', 'psm', 'sample', 'run'].filter((v) => overview.value.available_views[v] === false)
})
const hasMissingViews = computed(() => missingViews.value.length > 0)

function count(v) {
  return v == null ? '—' : Number(v).toLocaleString()
}
function num(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return v
  if (Math.abs(n) >= 1000 && Number.isInteger(n)) return n.toLocaleString()
  return Number.isInteger(n) ? String(n) : n.toFixed(3)
}
function pct(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return (Math.round(n * 1000) / 10) + '%'
}
function val(v) {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'object') {
    // peptide_counts: { unique_sequences: 74, total_sequences: 89 } -> "74 / 89"
    if ('unique_sequences' in v || 'total_sequences' in v) {
      const u = v.unique_sequences == null ? '—' : Number(v.unique_sequences).toLocaleString()
      const t = v.total_sequences == null ? '—' : Number(v.total_sequences).toLocaleString()
      return `${u} / ${t}`
    }
    return JSON.stringify(v)
  }
  return String(v)
}
function colLabel(c) {
  return String(c).replace(/_/g, ' ')
}

function setRef(ref) {
  visibleRef.value = ref
  refInput.value = ref || ''
  tab.value = 'overview'
  resetDerived()
}

function resetDerived() {
  overview.value = null
  filesList.value = []
  runs.value = []
  samples.value = []
  sampleColumns.value = []
  proteins.value = []
  peptides.value = []
  features.value = []
  featureColumns.value = []
  ptms.value = []
  ptmColumns.value = []
  ptmSource.value = ''
  psms.value = []
  psmColumns.value = []
  psmAbsent.value = false
  selectedProtein.value = ''
  proteinDetail.value = { loading: false, error: '', peptides: [] }
  nlError.value = ''
  sqlText.value = ''
  sqlResult.value = null
  sqlError.value = ''
  sqlInfo.value = ''
  schemaViews.value = []
  exampleBusy.value = ''
}

// Bumped on every dataset open; a response for an older open is dropped.
let loadGen = 0

async function loadRef() {
  const ref = refInput.value.trim()
  if (!ref) return
  const parts = ref.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    error.value = 'Dataset ref must look like "accession/phash", e.g. MSV000085836/8e4c044b513d.'
    loaded.value = false
    return
  }
  setRef(ref)
  const gen = ++loadGen
  loading.value = true
  error.value = ''
  try {
    const ov = await qpxOverview(ref)
    if (gen !== loadGen) return
    overview.value = ov
    filesList.value = Object.values(ov.files || {}).flat()
    loaded.value = true
    // load the rest in parallel (best-effort)
    loadRuns()
    loadSamples()
    loadProteins()
    loadPeptides()
    loadFeatures()
    loadPtms()
    loadPsms()
    loadSchema()
    // honour a deep-link tab (?ref=…&tab=features)
    const qtab = tabFromQuery(route.query)
    if (qtab) tab.value = qtab
  } catch (e) {
    if (gen !== loadGen) return
    loaded.value = false
    error.value = `Could not open dataset ${ref}: ${e.message || e}`
  } finally {
    if (gen === loadGen) loading.value = false
  }
}

async function loadRuns() {
  const ref = visibleRef.value
  if (!ref) return
  try {
    const { runs: r } = await qpxRuns(ref, { limit: 500 })
    if (ref !== visibleRef.value) return
    runs.value = r || []
  } catch {
    if (ref !== visibleRef.value) return
    runs.value = []
  }
}

async function loadSamples() {
  const ref = visibleRef.value
  if (!ref) return
  try {
    const { samples: s } = await qpxSamples(ref, { limit: 500 })
    if (ref !== visibleRef.value) return
    samples.value = s || []
    sampleColumns.value = s && s.length ? Object.keys(s[0]) : []
  } catch {
    if (ref !== visibleRef.value) return
    samples.value = []
  }
}

function toggleProteinSort() {
  proteinSort.value = proteinSort.value === 'qvalue' ? 'intensity' : 'qvalue'
}

async function loadProteins() {
  const ref = visibleRef.value
  if (!ref) return
  busy.value.proteins = true
  try {
    const res = await qpxSearchProteins(ref, { q: proteinQ.value, limit: 200 })
    if (ref !== visibleRef.value) return
    proteins.value = res.rows || []
  } catch {
    if (ref !== visibleRef.value) return
    proteins.value = []
  } finally {
    busy.value.proteins = false
  }
}

async function loadPeptides() {
  const ref = visibleRef.value
  if (!ref) return
  busy.value.peptides = true
  try {
    const res = await qpxSearchPeptides(ref, { q: peptideQ.value, limit: 200 })
    if (ref !== visibleRef.value) return
    peptides.value = res.rows || []
  } catch {
    if (ref !== visibleRef.value) return
    peptides.value = []
  } finally {
    busy.value.peptides = false
  }
}

async function loadFeatures() {
  const ref = visibleRef.value
  if (!ref) return
  busy.value.features = true
  const params = { q: featureQ.value, limit: 200 }
  if (featureCharge.value !== '' && featureCharge.value != null) params.charge = featureCharge.value
  if (featureQmax.value !== '' && featureQmax.value != null) params.qvalue_max = featureQmax.value
  if (featureMod.value.trim()) params.mod = featureMod.value.trim()
  try {
    const res = await qpxSearchFeatures(ref, params)
    if (ref !== visibleRef.value) return
    features.value = res.rows || []
    featureColumns.value = res.columns || []
  } catch {
    if (ref !== visibleRef.value) return
    features.value = []
  } finally {
    busy.value.features = false
  }
}

async function loadPtms() {
  const ref = visibleRef.value
  if (!ref) return
  try {
    const res = await qpxPtms(ref, { limit: 200 })
    if (ref !== visibleRef.value) return
    ptms.value = res.rows || []
    ptmColumns.value = res.columns || []
    ptmSource.value = res.source || ''
  } catch {
    if (ref !== visibleRef.value) return
    ptms.value = []
  }
}

async function loadPsms() {
  const ref = visibleRef.value
  if (!ref) return
  busy.value.psms = true
  try {
    const res = await qpxPsms(ref, { q: psmQ.value, limit: 200 })
    if (ref !== visibleRef.value) return
    psms.value = res.rows || []
    psmColumns.value = res.columns || []
    psmAbsent.value = res.available === false
  } catch {
    if (ref !== visibleRef.value) return
    psms.value = []; psmAbsent.value = true
  } finally {
    busy.value.psms = false
  }
}

async function loadSchema() {
  const ref = visibleRef.value
  if (!ref) return
  schemaLoading.value = true
  sqlError.value = ''
  try {
    const res = await qpxSchema(ref)
    if (ref !== visibleRef.value) return
    schemaViews.value = res.views || []
  } catch {
    if (ref !== visibleRef.value) return
    schemaViews.value = []
  } finally {
    if (ref === visibleRef.value) schemaLoading.value = false
  }
}

async function loadExample(ex) {
  if (!ex || exampleBusy.value) return
  exampleBusy.value = ex.id
  sqlText.value = ex.sql
  sqlResult.value = null
  sqlError.value = ''
  sqlInfo.value = `Loaded "${ex.title}" — edit and run, or ask a question above.`
  await runSql()
  exampleBusy.value = ''
}

async function runSql() {
  const ref = visibleRef.value
  const sql = sqlText.value
  if (!ref || !sql.trim()) return
  const gen = ++loadGen // re-use the dataset-open generation guard to drop stale runs
  sqlRunning.value = true
  sqlError.value = ''
  sqlInfo.value = ''
  try {
    const res = await qpxRunSql(ref, { sql, limit: sqlLimit.value || undefined })
    if (gen !== loadGen) return
    sqlResult.value = res
  } catch (e) {
    if (gen !== loadGen) return
    sqlResult.value = { error: e.message || 'query failed' }
  } finally {
    if (gen === loadGen) sqlRunning.value = false
  }
}

async function askNl() {
  const ref = visibleRef.value
  const q = nlQuestion.value
  if (!ref || !q.trim()) return
  const gen = ++loadGen
  nlRunning.value = true
  nlError.value = ''
  sqlResult.value = null
  sqlError.value = ''
  try {
    const res = await qpxFromNl(ref, { question: q, limit: sqlLimit.value || undefined })
    if (gen !== loadGen) return
    if (res.sql) {
      sqlText.value = res.sql
      sqlInfo.value = 'Generated SQL — edit and re-run if you like.'
    }
    sqlResult.value = res.result || {}
  } catch (e) {
    if (gen !== loadGen) return
    nlError.value = e.message || 'the "Ask in English" request failed'
  } finally {
    if (gen === loadGen) nlRunning.value = false
  }
}

async function openProtein(acc) {
  const ref = visibleRef.value
  const current = () => ref === visibleRef.value && acc === selectedProtein.value
  selectedProtein.value = acc
  proteinDetail.value = { loading: true, error: '', peptides: [] }
  try {
    const [d, expr] = await Promise.all([
      qpxProtein(ref, acc),
      qpxProteinExpression(ref, acc),
    ])
    if (!current()) return
    proteinDetail.value = {
      loading: false,
      error: '',
      peptides: d.peptides || [],
      expr: expr || null,
    }
  } catch (e) {
    if (!current()) return
    proteinDetail.value = { loading: false, error: e.message || 'failed', peptides: [] }
  }
}

// Switch tab AND keep the URL shareable: ?ref=…&tab=<id> (deep-linkable).
function setTab(id) {
  tab.value = id
  const qtab = tabFromQuery(route.query)
  if (qtab !== id) {
    router.replace({ query: { ...route.query, tab: id } })
  }
}

// Deep-link helpers: ?ref=accession/phash (or ?dataset_ref=…) and ?tab=<id>.
function refFromQuery(q) {
  return (q && (q.ref || q.dataset_ref)) || ''
}

function tabFromQuery(q) {
  const t = (q && q.tab) || ''
  return tabs.some((tb) => tb.id === t) ? t : ''
}

onMounted(() => {
  const r = refFromQuery(route.query)
  if (r) {
    refInput.value = r
    loadRef()
  }
})

watch(() => route.query, (q) => {
  const r = refFromQuery(q)
  if (r && r !== visibleRef.value) {
    refInput.value = r
    loadRef()
  }
})
</script>

<style>
.qx-title { font-size: 28px; font-weight: 700; margin: 8px 0 4px; }
.qx-sub { color: var(--text-secondary); margin-bottom: 22px; }
.qx-doc-link { margin-left: 8px; font-size: 13px; }

.qx-picker { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
.qx-input {
  font-family: var(--mono);
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
  min-width: 320px;
}
.qx-input-sm { min-width: 60px; font-family: var(--mono); }
.qx-picker-ref { color: var(--text-muted); font-family: var(--mono); font-size: 13px; }

.qx-placeholder { text-align: center; padding: 60px 20px; color: var(--text-muted); }
.qx-placeholder .placeholder-icon { font-size: 42px; display: block; margin-bottom: 12px; }
.placeholder-empty { text-align: center; padding: 40px 12px; color: var(--text-muted); }

.qx-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.qx-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 14px 16px;
}
.qx-card-val { font-size: 22px; font-weight: 700; font-family: var(--mono); }
.qx-card-label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); margin-top: 2px; }
.qx-hint { color: var(--text-muted); font-size: 13px; margin-bottom: 14px; }

.qx-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border); margin-bottom: 18px; flex-wrap: wrap; }
.qx-tab {
  padding: 8px 14px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
}
.qx-tab.active { color: var(--indigo); border-bottom-color: var(--indigo); }

.qx-tab-body { margin-top: 4px; }
.qx-block { margin-bottom: 22px; }
.qx-block-label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; }
.qx-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.qx-file-list { margin: 0; padding-left: 18px; color: var(--text-secondary); font-family: var(--mono); font-size: 13px; }

.qx-prot-detail { margin-top: 24px; border-top: 1px solid var(--border); padding-top: 16px; }

.qx-query-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; align-items: start; }
.qx-query-list { display: flex; flex-direction: column; gap: 8px; }
.qx-query-item {
  display: flex; flex-direction: column; gap: 2px; text-align: left;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface); cursor: pointer; font-size: 13px;
}
.qx-query-item.active { border-color: var(--indigo); background: rgba(99,102,241,0.04); }
.qx-query-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.qx-query-head p { margin: 2px 0 0; }

/* SQL editor + "Ask in English" */
.qx-nl-box { margin-bottom: 18px; }
.qx-nl-input { flex: 1; min-width: 220px; }
.qx-nl-off { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); }
.qx-sql {
  width: 100%; font-family: var(--mono); font-size: 13px; line-height: 1.5;
  padding: 12px; border: 1px solid var(--border); border-radius: 8px;
  background: #0b0e17; color: #d7e0ff; resize: vertical; box-sizing: border-box;
}
.qx-sql:focus { outline: none; border-color: var(--indigo); }
.qx-sql-hint { font-size: 12px; }
.qx-schema { display: flex; flex-direction: column; gap: 6px; }
.qx-schema-view { display: flex; gap: 10px; align-items: baseline; font-size: 13px; }
.qx-schema-name { color: var(--indigo); text-transform: none; font-family: var(--mono); min-width: 80px; }
.qx-schema-cols { color: var(--text-secondary); font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
.qx-sql-result { margin-top: 4px; }
.qx-sort { margin-left: auto; }

@media (max-width: 820px) {
  .qx-query-grid { grid-template-columns: 1fr; }
  .qx-input { min-width: 100%; }
}
</style>
