<template>
  <div>
    <div class="cl-toolbar cl-gs-tools">
      <label class="cl-ctl-inline">Study
        <select v-model="study" aria-label="Study" data-test="profile-study">
          <option v-for="s in options" :key="s.study" :value="s.study" :disabled="!s.quantified">
            {{ s.study }} · {{ (s.acq || []).join('/') }} · {{ methodLabel(s) }} · {{ s.quantified }} of {{ s.n_lines }} lines quantified{{ s.quantified ? '' : ' (not quantified)' }}
          </option>
        </select>
      </label>
    </div>
    <p v-if="current" class="cl-caption" data-test="profile-caption">
      log2 difference from {{ current.study }}'s average for {{ gene }} (0 = average, +1 = twice), from {{ methodLabel(current) }}.
      <template v-if="isTmt">For TMT the average is per plex, and identification is per plex, not per line.</template>
    </p>
    <p v-if="withinLineage" class="cl-caption cl-warn" data-test="profile-lineage-warning">
      Most lines in this study come from one lineage, so compare its lines within a lineage only.
    </p>
    <div v-if="!options.some((s) => s.quantified)" class="cl-empty" data-test="profile-empty">
      {{ gene }} has no quantified value in any study.
    </div>
    <div v-else class="cl-gs-scroll">
      <div class="cl-gs cl-gs-profile" data-test="profile-plot">
        <div class="cl-gs-row cl-gs-head">
          <span>{{ kindLabel }}</span>
          <span>lines</span>
          <span class="cl-gs-axis">
            <span class="cl-strip-nd" title="cell lines measured where the protein was not detected">n.d.</span>
            <span class="cl-gs-ticks"><span v-for="t in innerTicks" :key="t" :style="{ left: tickPos(t) }">{{ t > 0 ? `+${t}` : t }}</span></span>
          </span>
        </div>
        <div v-for="g in groups" :key="g.value" class="cl-gs-row" data-test="profile-group">
          <span class="cl-gs-name" :title="g.value">{{ g.value }}</span>
          <span class="cl-gs-det cl-muted">{{ g.points.length }}<template v-if="g.absent.length"> + {{ g.absent.length }} n.d.</template></span>
          <AmountStrip :points="g.points" :absent="g.absent" :box="g.box" :median="g.median" :axis="axis"
                       what="the study average" @select-line="(l) => $emit('select-line', l)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { GROUP_KINDS, studyProfile, profileAxis, methodLabel } from '../../cellLines.js'
import AmountStrip from './AmountStrip.vue'

const props = defineProps({
  gene: { type: String, default: '' },
  values: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  studies: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
defineEmits(['select-line'])

const quantified = computed(() => {
  const n = {}
  for (const v of props.values || []) if (Number.isFinite(v.l3)) n[v.study] = (n[v.study] || 0) + 1
  return n
})
// Studies without a quantified value stay listed but disabled, so nobody picks an empty plot.
const options = computed(() => props.studies.map((s) => ({ ...s, quantified: quantified.value[s.study] || 0 }))
  .sort((a, b) => (b.quantified > 0) - (a.quantified > 0) || b.n_lines - a.n_lines))
const study = ref('')
watch(options, (o) => {
  if (!o.some((s) => s.study === study.value && s.quantified)) study.value = o.find((s) => s.quantified)?.study || ''
}, { immediate: true })

const kindLabel = computed(() => GROUP_KINDS.find((k) => k.id === props.kind)?.label.toLowerCase() || props.kind)
const current = computed(() => options.value.find((s) => s.study === study.value) || null)
const isTmt = computed(() => (current.value?.acq || []).includes('TMT'))
const groups = computed(() => studyProfile(props.values, props.lines, study.value, props.kind))
const withinLineage = computed(() => props.values.some((v) => v.study === study.value && v.comparability === 'within-lineage only'))
const axis = computed(() => profileAxis(groups.value))
const innerTicks = computed(() => axis.value.ticks.filter((t) => t > axis.value.min && t < axis.value.max))
const tickPos = (t) => `${(((t - axis.value.min) / (axis.value.max - axis.value.min)) * 100).toFixed(2)}%`
</script>
