<template>
  <div>
    <section class="cl-card">
      <AtlasPicker id="cl-coexp-gene" kind="gene" label="Gene" placeholder="Gene symbol, e.g. PSMA1" @select="(g) => $emit('select-gene', g)" />
    </section>
    <div v-if="!gene" class="cl-notice">
      Pick a gene to see its strongest co-expression partners. Try
      <button type="button" class="cl-linkish" @click="$emit('select-gene', 'PSMA1')">PSMA1</button>; its partners should be the rest of the proteasome.
    </div>
    <StatusBlock v-else :loading="req.loading.value" :error="req.error.value" what="Co-expression"
                 :loading-text="`Loading the partners of ${gene}…`" :retry="load" />

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
          <span class="cl-muted">{{ validatedCount }} validated · {{ partners.length - validatedCount }} ranked</span>
        </div>
        <div class="cl-grid-2">
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
                <span class="cl-legend-item"><svg class="cl-edge-key" viewBox="0 0 22 6"><line x1="0" y1="3" x2="22" y2="3" class="cl-edge cl-edge-pos" stroke-width="2.5" /></svg>validated (A44)</span>
                <span class="cl-legend-item"><svg class="cl-edge-key" viewBox="0 0 22 6"><line x1="0" y1="3" x2="22" y2="3" class="cl-edge cl-edge-pos cl-edge-ranked" stroke-width="2" /></svg>ranked neighbour (below validated threshold)</span>
                <span class="cl-legend-item"><span class="cl-line-swatch cl-neg-bg"></span> negative Z</span>
                <span class="cl-legend-item"><span class="cl-complex-key"></span> same complex</span>
              </span>
            </div>
            <div v-if="!shown.length" class="cl-empty">No partners match this filter.</div>
            <svg v-else :viewBox="`0 0 ${W} ${H}`" class="cl-network" role="img" :aria-label="`Co-expression partners of ${gene}`">
              <line v-for="n in nodes" :key="`e-${n.partner}`" :x1="W / 2" :y1="H / 2" :x2="n.x" :y2="n.y"
                    :stroke-width="0.8 + 4 * n.strength"
                    :class="['cl-edge', n.z >= 0 ? 'cl-edge-pos' : 'cl-edge-neg', { 'cl-edge-ranked': !n.validated }]"
                    :data-edge="n.validated ? 'validated' : 'ranked'" />
              <g v-for="n in nodes" :key="`n-${n.partner}`" class="cl-node" :class="{ 'cl-node-complex': n.shared_complexes?.length, 'cl-node-ranked': !n.validated }"
                 tabindex="0" @click="$emit('select-gene', n.partner)" @keydown.enter="$emit('select-gene', n.partner)">
                <title>{{ n.partner }} · Z {{ fmt(n.z, 1) }} · {{ n.validated ? 'validated (A44)' : 'ranked neighbour' }} · {{ n.studies }} studies · {{ n.distinct_lines }} lines<template v-if="n.shared_complexes?.length"> · same complex: {{ n.shared_complexes.join('; ') }}</template></title>
                <circle :cx="n.x" :cy="n.y" r="7" />
                <text :x="n.x + (n.anchor === 'start' ? 11 : -11)" :y="n.y + 4" :text-anchor="n.anchor">{{ n.partner }}</text>
              </g>
              <g class="cl-node cl-node-centre">
                <circle :cx="W / 2" :cy="H / 2" r="14" />
                <text :x="W / 2" :y="H / 2 + 34" text-anchor="middle">{{ gene }}</text>
              </g>
            </svg>
            <p class="cl-caption">Click a partner to re-centre on it. Stronger edges sit closer to the centre.</p>
          </section>
          <section class="cl-card">
            <NeighboursTable :gene="gene" :partners="shown" :threshold="data.threshold || ''" :min-z="minZ" empty-text="No partners match this filter."
                             @select-gene="(g) => $emit('select-gene', g)" />
            <p class="cl-muted cl-actions">
              <button type="button" class="cl-linkish" @click="$emit('open-protein', gene)">Protein view for {{ gene }} →</button>
              · <a :href="stringUrl" target="_blank" rel="noopener">STRING ↗</a>
            </p>
          </section>
        </div>
      </template>
      <p class="cl-caption" data-test="coexp-caption">Partners ranked by |Z| on the A44 recipe, shown down to |Z| ≥ {{ minZ }} (about one chance partner per gene expected at that level). Only |Z| ≥ 5 is validated; |Z| {{ minZ }}–5 are ranked neighbours. Complex Portal is used for annotation only. Negative Z means the two proteins vary in opposite directions across lines. Co-expression is not physical interaction.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AtlasPicker from './AtlasPicker.vue'
import StatusBlock from './StatusBlock.vue'
import NeighboursTable from './NeighboursTable.vue'
import { useRequest } from './useRequest.js'
import { getGeneCoexpression, radialLayout, filterPartners, noPartnersText, COEXP_FILTERS, fmt } from '../../cellLines.js'

const props = defineProps({ gene: { type: String, default: '' } })
defineEmits(['select-gene', 'open-protein'])

const W = 640
const H = 600
const req = useRequest(getGeneCoexpression)
const mode = ref('all')
const data = computed(() => req.data.value)
const partners = computed(() => data.value?.partners || [])
const complexes = computed(() => data.value?.complexes || [])
const minZ = computed(() => data.value?.display_min_z ?? 4)
const stringUrl = computed(() => `https://string-db.org/cgi/network?identifiers=${encodeURIComponent(props.gene)}&species=9606`)
const validatedCount = computed(() => partners.value.filter((p) => p.validated).length)
const shown = computed(() => filterPartners(partners.value, mode.value))
const nodes = computed(() => radialLayout(shown.value, { cx: W / 2, cy: H / 2, radius: 240 }))

function load() {
  if (props.gene) req.run(props.gene)
  else req.reset()
}
watch(() => props.gene, load, { immediate: true })
</script>
