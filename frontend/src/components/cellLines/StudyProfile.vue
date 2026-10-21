<template>
  <div>
    <div class="cl-box-controls">
      <label class="cl-ctl-inline">Study
        <select v-model="study" aria-label="Study" data-test="profile-study">
          <option v-for="s in studies" :key="s.study" :value="s.study">
            {{ s.study }} · {{ (s.acq || []).join('/') }} · {{ methodLabel(s) }} · {{ s.n_lines }} lines
          </option>
        </select>
      </label>
    </div>
    <p v-if="current" class="cl-caption" data-test="profile-caption">
      Each point is one cell line in {{ current.study }}. Height = log2 difference from this study's average for {{ gene }}
      (0 = average, +1 = twice the average, −1 = half), from {{ methodLabel(current) }}.
      <template v-if="isTmt">For TMT the average is per plex, and identification is per plex, not per line.</template>
      Values from different studies are not on the same scale; pick another study to compare its own profile.
    </p>
    <p v-if="withinLineage" class="cl-caption cl-warn" data-test="profile-lineage-warning">
      Most lines in this study come from one lineage, so compare its lines within a lineage only.
    </p>
    <div v-if="!groups.length" class="cl-empty">No line of this study has a value for {{ gene }}.</div>
    <div v-else class="cl-box-scroll">
      <div class="cl-box-wrap" :style="{ width: `${W}px` }" @mouseleave="tip = null">
        <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="cl-boxplot" role="img"
             :aria-label="`Profile of ${gene} within ${study}`" data-test="profile-plot">
          <g class="cl-box-axis">
            <template v-for="t in axis.ticks" :key="t">
              <line :x1="PAD_L" :x2="W - 4" :y1="y(t)" :y2="y(t)" class="cl-box-grid" :class="{ 'cl-box-zero': t === 0 }" />
              <text :x="PAD_L - 6" :y="y(t) + 4" text-anchor="end">{{ t > 0 ? `+${t}` : t }}</text>
            </template>
            <text :x="PAD_L - 6" :y="ABSENT_Y + 4" text-anchor="end">n.d.</text>
          </g>
          <g v-for="(g, i) in groups" :key="g.value" class="cl-box-group" data-test="profile-group">
            <rect :x="cx(i) - SLOT / 2" :y="TOP" :width="SLOT" :height="PLOT_H" class="cl-box-hit"
                  @mouseenter="showTip(cx(i), y(g.median ?? 0), groupTip(g))" />
            <template v-if="g.box">
              <line :x1="cx(i)" :x2="cx(i)" :y1="y(g.box.hi)" :y2="y(g.box.q3)" class="cl-box-whisker" />
              <line :x1="cx(i)" :x2="cx(i)" :y1="y(g.box.q1)" :y2="y(g.box.lo)" class="cl-box-whisker" />
              <rect :x="cx(i) - BOX_W / 2" :y="y(g.box.q3)" :width="BOX_W" :height="Math.max(1, y(g.box.q1) - y(g.box.q3))"
                    class="cl-box-iqr" @mouseenter="showTip(cx(i), y(g.box.q3), groupTip(g))" />
            </template>
            <line v-if="g.median != null" :x1="cx(i) - BOX_W / 2" :x2="cx(i) + BOX_W / 2" :y1="y(g.median)" :y2="y(g.median)" class="cl-box-median" />
            <circle v-for="(p, j) in g.points" :key="p.line" :cx="cx(i) + jitter(j)" :cy="y(p.value)" r="2.6"
                    class="cl-box-pt" :class="{ 'cl-pt-on': p.detected }" :data-line="p.line"
                    @mouseenter="showTip(cx(i) + jitter(j), y(p.value), pointTip(p))"
                    @click="$emit('select-line', p.line)" />
            <circle v-for="(p, j) in g.absent" :key="`nd-${p.line}`" :cx="cx(i) + jitter(j)" :cy="ABSENT_Y" r="2.2"
                    class="cl-box-pt cl-pt-absent" :data-line="p.line"
                    @mouseenter="showTip(cx(i) + jitter(j), ABSENT_Y, `${p.name} · measured, not detected`)"
                    @click="$emit('select-line', p.line)" />
            <text :transform="`translate(${cx(i) + 4}, ${ABSENT_Y + 12}) rotate(-90)`" text-anchor="end" class="cl-box-label">
              <title>{{ g.value }}</title>{{ short(g.value) }}
            </text>
          </g>
        </svg>
        <div v-if="tip" class="cl-box-tip" :class="{ below: tip.below }" role="tooltip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">{{ tip.text }}</div>
      </div>
    </div>
    <span class="cl-legend">
      <span class="cl-legend-item"><span class="cl-pt-key cl-pt-on"></span>{{ isTmt ? 'identified in the plex' : 'detected' }}</span>
      <span class="cl-legend-item"><span class="cl-pt-key"></span>value without a detection</span>
      <span class="cl-legend-item"><span class="cl-pt-key cl-pt-absent"></span>n.d. = measured, not detected</span>
    </span>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { studyProfile, profileAxis, methodLabel, foldText, signed } from '../../cellLines.js'

const props = defineProps({
  gene: { type: String, default: '' },
  values: { type: Array, default: () => [] },
  lines: { type: Array, default: () => [] },
  studies: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
defineEmits(['select-line'])

const SLOT = 28
const BOX_W = 16
const PAD_L = 34
const TOP = 10
const PLOT_H = 220
const ABSENT_Y = TOP + PLOT_H + 18
const H = ABSENT_Y + 130

const study = ref('')
const tip = ref(null)
watch(() => props.studies, (s) => { study.value = s?.[0]?.study || '' }, { immediate: true })
watch([study, () => props.kind], () => { tip.value = null })

const current = computed(() => props.studies.find((s) => s.study === study.value) || null)
const isTmt = computed(() => (current.value?.acq || []).includes('TMT'))
const groups = computed(() => studyProfile(props.values, props.lines, study.value, props.kind))
const withinLineage = computed(() => props.values.some((v) => v.study === study.value && v.comparability === 'within-lineage only'))
const axis = computed(() => profileAxis(groups.value))
const W = computed(() => PAD_L + groups.value.length * SLOT + 8)

const cx = (i) => PAD_L + SLOT * i + SLOT / 2
const y = (v) => TOP + (1 - (Math.min(axis.value.max, Math.max(axis.value.min, v)) - axis.value.min) / (axis.value.max - axis.value.min)) * PLOT_H
const jitter = (j) => (((j * 37) % 13) - 6) * 0.9
const short = (s) => (s.length > 20 ? `${s.slice(0, 19)}…` : s)
const showTip = (x, yy, text) => {
  const half = Math.min(150, W.value / 2)
  tip.value = { x: Math.min(W.value - half, Math.max(half, x)), y: yy, below: yy < 80, text }
}
const pointTip = (p) => `${p.name} · ${signed(p.value)} log2 · ${foldText(p.value, 'the study average')}${p.detected ? '' : ' · no detection'}`
const groupTip = (g) => [
  `${g.value} · ${g.points.length} line${g.points.length === 1 ? '' : 's'} with a value`,
  g.median != null ? `median ${signed(g.median)} log2` : '',
  g.absent.length ? `${g.absent.length} measured, not detected` : '',
].filter(Boolean).join(' · ')
</script>
