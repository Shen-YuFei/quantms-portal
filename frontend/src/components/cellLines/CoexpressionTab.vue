<template>
  <div>
    <section class="cl-card">
      <AtlasPicker id="cl-coexp-gene" kind="gene" label="Gene" placeholder="Gene symbol, e.g. PSMA1" @select="(g) => $emit('select-gene', g)" />
    </section>
    <div v-if="!gene" class="cl-notice">
      Pick a gene to draw its validated co-expression network. Try
      <button type="button" class="cl-linkish" @click="$emit('select-gene', 'PSMA1')">PSMA1</button>; its partners should be the rest of the proteasome.
    </div>
    <StatusBlock v-else :loading="req.loading.value" :error="req.error.value" what="Co-expression"
                 :loading-text="`Loading the network for ${gene}…`" :retry="load" />

    <template v-if="gene && data">
      <div v-if="!edges.length" class="cl-notice">No edges at the validated threshold ({{ data.threshold || '—' }}) for {{ gene }}.</div>
      <div v-else class="cl-grid-2">
        <section class="cl-card">
          <div class="cl-card-head">
            <h3>{{ gene }} <span class="cl-muted">· {{ edges.length }} partner{{ edges.length === 1 ? '' : 's' }}</span></h3>
            <span class="cl-legend">
              <span class="cl-line-swatch cl-pos-bg"></span> positive
              <span class="cl-line-swatch cl-neg-bg"></span> negative
            </span>
          </div>
          <svg :viewBox="`0 0 ${W} ${H}`" class="cl-network" role="img" :aria-label="`Co-expression network of ${gene}`">
            <line v-for="n in nodes" :key="`e-${n.partner}`" :x1="W / 2" :y1="H / 2" :x2="n.x" :y2="n.y"
                  :stroke-width="0.8 + 4 * n.strength" :class="n.z >= 0 ? 'cl-edge cl-edge-pos' : 'cl-edge cl-edge-neg'" />
            <g v-for="n in nodes" :key="`n-${n.partner}`" class="cl-node" tabindex="0"
               @click="$emit('select-gene', n.partner)" @keydown.enter="$emit('select-gene', n.partner)">
              <title>{{ n.partner }} · Z {{ fmt(n.z, 1) }} · {{ n.studies }} studies · {{ n.distinct_lines }} lines</title>
              <circle :cx="n.x" :cy="n.y" r="7" />
              <text :x="n.x + (n.anchor === 'start' ? 11 : -11)" :y="n.y + 4" :text-anchor="n.anchor">{{ n.partner }}</text>
            </g>
            <g class="cl-node cl-node-centre">
              <circle :cx="W / 2" :cy="H / 2" r="14" />
              <text :x="W / 2" :y="H / 2 + 34" text-anchor="middle">{{ gene }}</text>
            </g>
          </svg>
          <p class="cl-caption">Click a partner to re-centre on it. Stronger edges sit closer to the centre<template v-if="edges.length > MAX_NODES">; the {{ MAX_NODES }} strongest of {{ edges.length }} are drawn</template>.</p>
        </section>
        <section class="cl-card">
          <NeighboursTable :gene="gene" :edges="edges" :threshold="data.threshold || ''" @select-gene="(g) => $emit('select-gene', g)" />
          <p class="cl-muted cl-actions">
            <button type="button" class="cl-linkish" @click="$emit('open-protein', gene)">Protein view for {{ gene }} →</button>
            · <a :href="`https://string-db.org/cgi/network?identifiers=${encodeURIComponent(gene)}&species=9606`" target="_blank" rel="noopener">STRING ↗</a>
          </p>
        </section>
      </div>
      <p class="cl-caption">The network is the validated all-lines co-expression network (A44 recipe). Only edges at the pre-registered threshold are shown. Co-expression is not physical interaction.</p>
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import AtlasPicker from './AtlasPicker.vue'
import StatusBlock from './StatusBlock.vue'
import NeighboursTable from './NeighboursTable.vue'
import { useRequest } from './useRequest.js'
import { getGeneCoexpression, radialLayout, fmt } from '../../cellLines.js'

const props = defineProps({ gene: { type: String, default: '' } })
defineEmits(['select-gene', 'open-protein'])

const W = 640
const H = 600
const MAX_NODES = 40
const req = useRequest(getGeneCoexpression)
const data = computed(() => req.data.value)
const edges = computed(() => data.value?.edges || [])
const nodes = computed(() => radialLayout(edges.value.slice(0, MAX_NODES), { cx: W / 2, cy: H / 2, radius: 240 }))

function load() {
  if (props.gene) req.run(props.gene)
  else req.reset()
}
watch(() => props.gene, load, { immediate: true })
</script>
