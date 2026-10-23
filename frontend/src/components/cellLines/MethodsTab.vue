<template>
  <div class="cl-methods" data-test="methods">
    <section class="cl-card">
      <h3>What this app is</h3>
      <p>
        A harmonised browser over public cancer cell-line proteomes. Every study was reanalysed from its raw files with
        <a href="https://github.com/bigbio/quantms" target="_blank" rel="noopener">quantms</a> against one protein database, the cell
        lines were mapped to Cellosaurus accessions, and the results were frozen as atlas
        <b>{{ m.atlas || '—' }}</b> (built {{ built }}). Nothing is recomputed in the browser. The value of the app is the query
        layer: one place to ask whether a protein is detected in a line, whether its direction repeats in a second study, and
        whether its amount is stable enough across labs to interpret.
      </p>
      <p class="cl-muted">
        It is descriptive. It does not test hypotheses, and its specificity categories, reliability classes and co-expression
        links are summaries of measurements, not biological validation.
      </p>
    </section>

    <section class="cl-card">
      <h3>From raw files to values</h3>
      <ol class="cl-methods-list">
        <li><b>Identification and quantification.</b> Each study is searched with quantms (DDA and TMT) or quantms-diann (DIA)
          and exported to QPX. Decoys, bovine serum and non-human contaminant proteins are removed; human proteins prone to
          contamination are kept and flagged. Protein groups shared by a gene family are kept as family rows and never shown
          as a single gene.</li>
        <li><b>Per-sample abundance (level 1–2).</b> Label-free and DIA studies use directLFQ; TMT studies use piBAQ with
          internal reference scaling (IRS) across plexes. These values are comparable inside a study, never across studies.</li>
        <li><b>Within-study profile (level 3).</b> Each protein is centred per study (and per TMT plex): a line's value is its
          log2 difference from the average of the study. This removes the scale of each lab and acquisition.</li>
        <li><b>Relative abundance (level 4).</b> Inside each study a line is ranked from 0 to 1 for the protein; a line that was
          measured but did not detect the protein is ranked 0. Ranks are averaged over studies, preferring studies with a
          per-line detection call. This is the number used to compare lines.</li>
        <li><b>Reliability (level 5).</b> For lines measured in two or more studies, the cross-lab intraclass correlation (ICC)
          asks whether the same line gets the same value in different labs. <i>reproducible</i>: lower 95% bound ≥ 0.5;
          <i>partial</i>: ≥ 0.2; <i>not reproducible</i>: upper bound &lt; 0.2; <i>uncertain</i>: otherwise; no class with fewer than
          30 multi-study lines.</li>
      </ol>
      <p class="cl-caption">
        Studies with fewer than {{ r.min_study_lines ?? 3 }} cell lines are left out
        <template v-if="excluded.length">({{ excluded.join(', ') }})</template>. The full list of studies is in the
        Datasets tab.
      </p>
    </section>

    <section class="cl-card">
      <h3>Detected, weak, TMT only</h3>
      <ul class="cl-methods-list">
        <li><b>Detected</b>: identified in that line's own run with at least 2 peptides (DIA and label-free studies).</li>
        <li><b>Weak</b>: identified with a single peptide; shown, never counted as detected.</li>
        <li><b>TMT only</b>: TMT identifies a protein per plex, a pool of 10–16 samples, not per cell line. Lines measured only by
          TMT have no detection call; their values still enter levels 3–4.</li>
        <li><b>Not measured</b> is different from <b>not detected</b>: a line counts as measured for a protein only in a study
          where that protein was detected in some line.</li>
        <li>Culture-serum and common contaminant proteins
          (<span class="cl-muted">{{ (r.serum_genes || []).join(', ') }}</span> and the curated contaminant list) are flagged and
          kept out of group detection counts and specificity.</li>
      </ul>
    </section>

    <section id="specificity" class="cl-card">
      <h3>Lineage specificity</h3>
      <p>
        The categories follow the Human Protein Atlas: <i>lineage enriched</i> (one lineage ≥ 4× every other),
        <i>group enriched</i> (2–5 lineages ≥ 4× the rest), <i>enhanced</i> (≥ 4× the mean of all lineages) and
        <i>low specificity</i>. They are computed on two views (level-3 means, and level-4 ranks with a 40-point gap).
      </p>
      <p>A lineage of a call is shown only when all three hold:</p>
      <ul class="cl-methods-list">
        <li>the lineage has at least <b>{{ r.spec_min_lineage_lines ?? 10 }}</b> cell lines in the app (the rule Gonçalves et
          al., 2022 used for ProCan);</li>
        <li>its within-study enrichment was computed in at least <b>{{ r.spec_min_studies ?? 2 }}</b> studies;</li>
        <li>at least <b>{{ r.spec_min_detected ?? 3 }}</b> of its lines detect the protein.</li>
      </ul>
      <p>
        A call with no lineage left is shown as <i>insufficient</i>; the protein page lists the dropped lineages and why.
        <i>robust</i> means both views agree and at least {{ r.spec_min_studies ?? 2 }} studies give the same top lineage;
        <i>2+ labs</i> means the top lineage was reproduced by more than one lab on its own lines.
      </p>
      <p class="cl-muted">
        Known limitation: the 4× bar was set by HPA for absolute RNA levels. On centred, partly TMT-compressed protein values it
        is hard to reach, so established markers such as CDX2, VIL1 and MITF stay <i>low specificity</i> even though they are
        higher in their lineage. Read the lineage plot on the protein page, not only the category.
      </p>
    </section>

    <section class="cl-card">
      <h3>RNA beside protein</h3>
      <p>
        DepMap ({{ m.sources?.depmap?.release || '—' }}) and Human Protein Atlas cell-line RNA are shown next to the protein and
        never used to fill, rank or correct a protein value. They come from other cultures of the same models.
      </p>
      <ul class="cl-methods-list">
        <li><b>Detection</b>: how well RNA separates lines that detect the protein from lines that do not (AUC; needs ≥
          {{ r.rna_detect_min_lines_each ?? 10 }} lines on each side).</li>
        <li><b>Amount</b>: Spearman of RNA against protein amount in lines that detect it (needs ≥
          {{ r.rna_amount_min_lines ?? 20 }} lines). DIA and label-free studies only.</li>
      </ul>
      <p class="cl-muted">
        A median per-gene RNA–protein correlation near 0.4 is the published range for these lines (Nusinow et al., 2020;
        Gonçalves et al., 2022). The strength words (strong, moderate) are display choices, not statistical cuts.
      </p>
    </section>

    <section class="cl-card">
      <h3>Co-expression</h3>
      <p>
        Per study (≥ 10 lines): proteins present in at least half the lines, top principal components removed, Spearman per
        pair; studies are combined with a Stouffer Z that discounts shared lines. A link is <b>strong</b> at |Z| ≥
        {{ r.coexpression_min_abs_z ?? 5 }}, the threshold calibrated against STRING physical interactions and a permutation
        null. Strong is a statistical cut, not experimental validation. Partners down to |Z| ≥ 4 are shown as ranked
        neighbours, where about one chance partner per protein is expected.
      </p>
      <p class="cl-muted">
        Co-expression is not physical interaction. Many strong links join members of the same complex (ribosome,
        mitoribosome, proteasome); Complex Portal is used to label them, not to score them. Studies with more lines weigh more.
      </p>
    </section>

    <section class="cl-card">
      <h3>Cell lines and labels</h3>
      <ul class="cl-methods-list">
        <li>Identity is the Cellosaurus accession. Lineage and primary disease are DepMap (Oncotree) where the line has a
          DepMap model, otherwise mapped from Cellosaurus disease and site.</li>
        <li><b>non-cancerous</b>: the Cellosaurus category is a known non-cancer type (for example transformed or immortalised).
          <b>problematic</b>: Cellosaurus marks the line as misidentified or contaminated.</li>
        <li>Samples that failed identity checks were removed before the atlas was frozen; other flags are shown as badges and
          never applied as filters.</li>
      </ul>
    </section>

    <section class="cl-card">
      <h3>Provenance</h3>
      <p class="cl-caption">
        Atlas {{ m.atlas || '—' }} · built {{ built }} · level 4: {{ m.level4 || '—' }} · co-expression {{ m.coexpression_threshold || '—' }}
        <template v-if="(m.amendments || []).length"> · methods amendments {{ m.amendments.join(', ') }}</template>.
        Sources: DepMap {{ m.sources?.depmap?.release || '—' }} ({{ m.sources?.depmap?.licence || '—' }}); HPA cell-line RNA
        ({{ m.sources?.hpa_rna_celline?.licence || '—' }}).
      </p>
      <template v-if="decisions.length">
        <h4>Decisions applied<template v-if="anyDraft"> (draft)</template></h4>
        <ul class="cl-methods-list" data-test="decisions">
          <li v-for="d in decisions" :key="d.constant">
            <a v-if="d.url" :href="d.url" target="_blank" rel="noopener">{{ d.decision }}<template v-if="d.title"> — {{ d.title }}</template></a><template v-else>{{ d.decision }}<template v-if="d.title"> — {{ d.title }}</template></template>:
            {{ d.constant }} = {{ shown(d.value) }}<span class="cl-muted"> · v{{ d.version ?? '—' }} · {{ d.status ?? '—' }}</span>
          </li>
        </ul>
      </template>
      <p class="cl-caption">
        Key references: Gonçalves et al., Cancer Cell 2022 (ProCan); Nusinow et al., Cell 2020 (CCLE proteomics); Uhlén et al.,
        Science 2015 (HPA categories); Dai et al., Nature Methods 2024 (quantms).
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { decisionList } from '../../cellLines.js'

const props = defineProps({ manifest: { type: Object, default: null } })
const m = computed(() => props.manifest || {})
const r = computed(() => m.value.rules || {})
const built = computed(() => (m.value.built ? String(m.value.built).slice(0, 10) : '—'))
const decisions = computed(() => decisionList(props.manifest))
const anyDraft = computed(() => decisions.value.some((d) => d.status === 'draft'))
const shown = (v) => (Array.isArray(v) ? `${v.length} entries` : v && typeof v === 'object' ? `${Object.keys(v).length} entries` : v)
const excluded = computed(() => m.value.excluded_studies?.studies || [])
</script>
