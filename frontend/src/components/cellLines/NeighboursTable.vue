<template>
  <div>
    <p class="cl-threshold">Validated threshold: <strong>{{ threshold || '—' }}</strong></p>
    <div v-if="!edges.length" class="cl-empty">No edges at the validated threshold for {{ gene }}.</div>
    <div v-else class="cl-table-wrap">
      <table class="cl-table">
        <thead>
          <tr>
            <th>Partner</th><th class="num">Z</th><th class="num">Studies</th><th class="num">Distinct lines</th><th>Reliability</th><th>Specificity</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in edges" :key="e.partner">
            <td><button type="button" class="cl-linkish" @click="$emit('select-gene', e.partner)">{{ e.partner }}</button></td>
            <td class="num" :class="e.z >= 0 ? 'cl-pos' : 'cl-neg'">{{ fmt(e.z, 1) }}</td>
            <td class="num">{{ e.studies ?? '—' }}</td>
            <td class="num">{{ e.distinct_lines ?? '—' }}</td>
            <td>{{ e.reliability_class || '—' }}</td>
            <td>{{ e.spec_cat3 || '—' }}<span v-if="e.spec_top3" class="cl-muted"> · {{ e.spec_top3 }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { fmt } from '../../cellLines.js'

defineProps({
  gene: { type: String, default: '' },
  edges: { type: Array, default: () => [] },
  threshold: { type: String, default: '' },
})
defineEmits(['select-gene'])
</script>
