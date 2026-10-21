<template>
  <div>
    <StatusBlock :loading="req.loading.value" :error="req.error.value" what="The cell-line list" :retry="req.run" />
    <div v-if="rows.length" class="cl-lbars" data-test="lineage-bars">
      <button v-for="r in rows" :key="r.lineage" type="button" class="cl-lbar" data-test="lineage-bar"
              :title="`${r.lineage}: ${r.n} cell lines, ${r.multi} measured in 2+ studies, ${r.studies} studies`"
              @click="$emit('select-lineage', r.lineage)">
        <span class="cl-lbar-name">{{ r.lineage }}</span>
        <span class="cl-lbar-track">
          <span class="cl-lbar-all" :style="{ width: r.wAll, background: r.color.bg, borderColor: r.color.dot }"></span>
          <span class="cl-lbar-multi" :style="{ width: r.wMulti, background: r.color.dot }"></span>
        </span>
        <span class="cl-lbar-n">{{ r.n }}</span>
      </button>
    </div>
    <p class="cl-caption">Bar = cell lines; darker part = measured in 2+ studies (cross-lab evidence). Click a lineage to list its cell lines.</p>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { getAllLines, lineageColor } from '../../cellLines.js'
import { useRequest } from './useRequest.js'
import StatusBlock from './StatusBlock.vue'

defineEmits(['select-lineage'])

const req = useRequest(getAllLines)
onMounted(() => req.run())

const rows = computed(() => {
  const by = {}
  for (const l of req.data.value || []) {
    const k = l.lineage || 'unmapped'
    by[k] ||= { lineage: k, n: 0, multi: 0, studies: new Set() }
    by[k].n++
    if ((l.n_studies || 0) >= 2) by[k].multi++
    for (const s of l.studies || []) by[k].studies.add(s)
  }
  const list = Object.values(by).sort((a, b) => b.n - a.n || a.lineage.localeCompare(b.lineage))
  const top = Math.max(1, ...list.map((r) => r.n))
  return list.map((r) => ({
    ...r, studies: r.studies.size, color: lineageColor(r.lineage),
    wAll: `${(r.n / top) * 100}%`, wMulti: `${(r.multi / top) * 100}%`,
  }))
})
</script>
