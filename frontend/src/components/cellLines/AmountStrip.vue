<template>
  <div class="cl-strip" data-test="amount-strip">
    <span class="cl-strip-nd" :title="absent.length ? `${absent.length} measured, not detected` : 'none measured without a detection'">
      <template v-if="absent.length">{{ absent.length }} n.d.</template>
    </span>
    <div class="cl-strip-plot">
      <span v-for="t in axis.ticks" :key="t" class="cl-strip-grid" :class="{ zero: t === 0 }" :style="{ left: pos(t) }"></span>
      <span v-if="box" class="cl-strip-iqr" :style="{ left: pos(box.q1), width: span(box.q1, box.q3) }"></span>
      <span v-if="box" class="cl-strip-whisker" :style="{ left: pos(box.lo), width: span(box.lo, box.hi) }"></span>
      <span v-if="median !== null" class="cl-strip-median" :style="{ left: pos(median) }"></span>
      <button v-for="(p, j) in points" :key="p.line" type="button" class="cl-strip-dot"
              :class="{ on: p.detected, ring: highlight.has(p.line) }" :data-line="p.line"
              :style="{ left: pos(p.value), top: `${50 + jitter(j)}%` }" :title="tip(p)" :aria-label="tip(p)"
              @click="$emit('select-line', p.line)"></button>
    </div>
  </div>
</template>

<script setup>
import { foldText, signed } from '../../cellLines.js'

const props = defineProps({
  points: { type: Array, default: () => [] },
  absent: { type: Array, default: () => [] },
  box: { type: Object, default: null },
  median: { type: Number, default: null },
  axis: { type: Object, required: true },
  highlight: { type: Set, default: () => new Set() },
  what: { type: String, default: 'the average' },
})
defineEmits(['select-line'])

const frac = (v) => (Math.min(props.axis.max, Math.max(props.axis.min, v)) - props.axis.min) / (props.axis.max - props.axis.min)
const pos = (v) => `${(frac(v) * 100).toFixed(2)}%`
const span = (a, b) => `${Math.max(0.6, (frac(b) - frac(a)) * 100).toFixed(2)}%`
const jitter = (j) => (((j * 37) % 11) - 5) * 6
const tip = (p) => `${p.name} · ${signed(p.value)} log2 · ${foldText(p.value, props.what)}${p.detected ? '' : ' · no detection'}`
</script>
