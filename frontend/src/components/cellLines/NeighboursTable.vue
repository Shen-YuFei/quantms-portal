<template>
  <div>
    <p class="cl-threshold">Validated threshold: <strong>{{ threshold || '—' }}</strong></p>
    <div v-if="!partners.length" class="cl-empty">{{ emptyText || noPartnersText(gene, minZ) }}</div>
    <div v-else class="cl-table-wrap cl-table-tall">
      <table class="cl-table" data-test="neighbours-table">
        <thead>
          <tr>
            <th>Partner</th><th class="num">Z</th><th>Edge</th><th class="num">Studies</th><th class="num">Distinct lines</th><th>Reliability</th><th>Specificity</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in partners" :key="p.partner" :class="{ 'cl-row-ranked': !p.validated }" data-test="partner-row">
            <td class="cl-nowrap">
              <button type="button" class="cl-linkish" @click="$emit('select-gene', p.partner)">{{ p.partner }}</button>
              <span v-if="p.shared_complexes?.length" class="cl-badge cl-badge-complex" data-test="same-complex"
                    :title="p.shared_complexes.join('; ')">same complex</span>
            </td>
            <td class="num" :class="p.z >= 0 ? 'cl-pos' : 'cl-neg'">{{ fmt(p.z, 1) }}</td>
            <td class="cl-nowrap" data-test="edge-kind">{{ p.validated ? 'validated (A44)' : 'ranked neighbour' }}</td>
            <td class="num">{{ p.studies ?? '—' }}</td>
            <td class="num">{{ p.distinct_lines ?? '—' }}</td>
            <td>{{ p.reliability_class || '—' }}</td>
            <td>{{ p.spec_cat3 || '—' }}<span v-if="p.spec_top3" class="cl-muted"> · {{ p.spec_top3 }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { fmt, noPartnersText } from '../../cellLines.js'

defineProps({
  gene: { type: String, default: '' },
  partners: { type: Array, default: () => [] },
  threshold: { type: String, default: '' },
  emptyText: { type: String, default: '' },
  minZ: { type: Number, default: 4 },
})
defineEmits(['select-gene'])
</script>
