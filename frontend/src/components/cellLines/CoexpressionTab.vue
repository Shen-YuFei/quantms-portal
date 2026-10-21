<template>
  <div>
    <section class="cl-card">
      <AtlasPicker id="cl-coexp-gene" kind="gene" label="Gene or protein" placeholder="Gene, UniProt accession or protein name, e.g. PSMA1" @select="(g) => $emit('select-gene', g)" />
    </section>
    <div v-if="!gene" class="cl-notice">
      Pick a gene to see its strongest co-expression partners. Try
      <button type="button" class="cl-linkish" @click="$emit('select-gene', 'PSMA1')">PSMA1</button>; its partners should be the rest of the proteasome.
    </div>
    <StatusBlock v-else :loading="req.loading.value" :error="req.error.value" what="Co-expression"
                 :loading-text="`Loading the partners of ${gene}…`" :retry="load" />

    <section v-if="(!gene || (data && !partners.length)) && hubs.length" class="cl-card" data-test="coexp-hubs">
      <div class="cl-card-head">
        <h3>Proteins with the most strong partners</h3>
        <span class="cl-muted">a starting point for exploring the network</span>
      </div>
      <div class="cl-hubs">
        <button v-for="h in hubs" :key="h.gene" type="button" class="cl-hub" data-test="coexp-hub" @click="$emit('select-gene', h.gene)">
          <b>{{ h.gene }}</b> <span class="cl-muted">{{ h.coexpression_partners }} partners</span>
          <span class="cl-hub-name">{{ h.protein_name }}</span>
          <span v-if="h.complex_name" class="cl-hub-cx">{{ h.complex_name }}</span>
        </button>
      </div>
    </section>

    <template v-if="gene && data">
      <div v-if="!partners.length" class="cl-notice" data-test="coexp-empty">
        {{ noPartnersText(gene, minZ) }}
        <p class="cl-muted cl-actions">
          <button type="button" class="cl-linkish" @click="$emit('open-protein', gene)">Protein view for {{ gene }} →</button>
          · <a :href="stringUrl" target="_blank" rel="noopener">STRING ↗</a>
        </p>
      </div>
      <template v-else>
        <div class="cl-toolbar">
          <div class="cl-toggle" role="group" aria-label="Partner filter">
            <button v-for="f in COEXP_FILTERS" :key="f.id" type="button" :class="{ active: mode === f.id }" :aria-pressed="mode === f.id"
                    :data-filter="f.id" @click="mode = f.id">{{ f.label }}</button>
          </div>
          <span class="cl-muted">{{ strongCount }} strong (|Z| ≥ 5) · {{ partners.length - strongCount }} ranked</span>
        </div>
        <section class="cl-card">
          <div class="cl-card-head">
            <div>
              <h3>{{ gene }} <span class="cl-muted">· {{ shown.length }} of {{ partners.length }} partner{{ partners.length === 1 ? '' : 's' }}</span></h3>
              <p class="cl-fact-sub" data-test="own-complexes">
                <template v-if="complexes.length">Complexes: {{ complexes.map((c) => c.complex_name).join('; ') }}</template>
                <template v-else>No curated complex in Complex Portal.</template>
              </p>
            </div>
            <span class="cl-legend">
              <span class="cl-legend-item"><svg class="cl-edge-key" viewBox="0 0 22 6"><line x1="0" y1="3" x2="22" y2="3" class="cl-edge cl-edge-pos" stroke-width="2.5" /></svg>strong, |Z| ≥ 5 (A44)</span>
              <span class="cl-legend-item"><svg class="cl-edge-key" viewBox="0 0 22 6"><line x1="0" y1="3" x2="22" y2="3" class="cl-edge cl-edge-pos cl-edge-ranked" stroke-width="2" /></svg>ranked neighbour (|Z| below 5)</span>
              <span class="cl-legend-item"><span class="cl-line-swatch cl-neg-bg"></span> negative Z</span>
              <span class="cl-legend-item"><span class="cl-complex-key"></span> same complex</span>
            </span>
          </div>
          <div v-if="!shown.length" class="cl-empty">No partners match this filter.</div>
          <svg v-else :viewBox="`0 0 ${W} ${H}`" class="cl-network" role="img" :aria-label="`Co-expression partners of ${gene}`">
            <line v-for="n in nodes" :key="`e-${n.partner}`" :x1="W / 2" :y1="H / 2" :x2="n.x" :y2="n.y"
                  :stroke-width="0.8 + 4 * n.strength" :style="{ strokeOpacity: (isStrong(n) ? 0.3 : 0.15) + 0.6 * n.strength }"
                  :class="['cl-edge', n.z >= 0 ? 'cl-edge-pos' : 'cl-edge-neg', { 'cl-edge-ranked': !isStrong(n) }]"
                  :data-edge="isStrong(n) ? 'strong' : 'ranked'" />
            <g v-for="n in nodes" :key="`n-${n.partner}`" class="cl-node" :class="{ 'cl-node-complex': n.shared_complexes?.length, 'cl-node-ranked': !isStrong(n) }"
               tabindex="0" @click="$emit('select-gene', n.partner)" @keydown.enter="$emit('select-gene', n.partner)">
              <title>{{ n.partner }} · Z {{ fmt(n.z, 1) }} · {{ isStrong(n) ? 'strong, |Z| ≥ 5' : 'ranked neighbour' }} · {{ n.studies }} studies · {{ n.distinct_lines }} lines<template v-if="n.shared_complexes?.length"> · same complex: {{ n.shared_complexes.join('; ') }}</template></title>
              <circle :cx="n.x" :cy="n.y" r="7" />
              <text :x="n.x + (n.anchor === 'start' ? 11 : -11)" :y="n.y + 4" :text-anchor="n.anchor">{{ n.partner }}</text>
            </g>
            <g class="cl-node cl-node-centre">
              <circle :cx="W / 2" :cy="H / 2" r="14" />
              <text :x="W / 2" :y="H / 2 + 34" text-anchor="middle">{{ gene }}</text>
            </g>
          </svg>
          <p class="cl-caption">Click a partner to re-centre on it. Partners sit on one circle ordered by Z, clockwise from 12 o'clock; thicker, darker edges are stronger.</p>
        </section>
        <section class="cl-card">
          <NeighboursTable :gene="gene" :partners="shown" :threshold="data.threshold || ''" :min-z="minZ" empty-text="No partners match this filter."
                           @select-gene="(g) => $emit('select-gene', g)" />
          <p class="cl-muted cl-actions">
            <button type="button" class="cl-linkish" @click="$emit('open-protein', gene)">Protein view for {{ gene }} →</button>
            · <a :href="stringUrl" target="_blank" rel="noopener">STRING ↗</a>
          </p>
        </section>
      </template>
      <p class="cl-caption" data-test="coexp-caption">Partners ranked by |Z| on the A44 recipe, shown down to |Z| ≥ {{ minZ }} (about one chance partner per gene expected at that level). Only |Z| ≥ 5 passes the calibrated A44 threshold (strong); |Z| {{ minZ }}–5 are ranked neighbours. Strong is a statistical cut, not experimental validation. Complex Portal is used for annotation only. Negative Z means the two proteins vary in opposite directions across lines. Co-expression is not physical interaction.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AtlasPicker from './AtlasPicker.vue'
import StatusBlock from './StatusBlock.vue'
import NeighboursTable from './NeighboursTable.vue'
import { useRequest } from './useRequest.js'
import { getGeneCoexpression, getTable, radialLayout, filterPartners, noPartnersText, COEXP_FILTERS, fmt, isStrong } from '../../cellLines.js'

const props = defineProps({ gene: { type: String, default: '' } })
defineEmits(['select-gene', 'open-protein'])

const W = 760
const H = 600
const req = useRequest(getGeneCoexpression)
const mode = ref('all')
const data = computed(() => req.data.value)
const partners = computed(() => data.value?.partners || [])
const hubReq = useRequest(getTable)
hubReq.run({ sort: 'coexpression', limit: 18, hide: true })
const hubs = computed(() => (hubReq.data.value?.rows || []).filter((r) => r.coexpression_partners > 0))
const complexes = computed(() => data.value?.complexes || [])
const minZ = computed(() => data.value?.display_min_z ?? 4)
const stringUrl = computed(() => `https://string-db.org/cgi/network?identifiers=${encodeURIComponent(props.gene)}&species=9606`)
const strongCount = computed(() => partners.value.filter(isStrong).length)
const shown = computed(() => filterPartners(partners.value, mode.value))
const nodes = computed(() => radialLayout(shown.value, { cx: W / 2, cy: H / 2, radius: 220 }))

function load() {
  if (props.gene) req.run(props.gene)
  else req.reset()
}
watch(() => props.gene, load, { immediate: true })
</script>
