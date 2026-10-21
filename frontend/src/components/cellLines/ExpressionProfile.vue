<template>
  <div>
    <div class="cl-legend">
      <span v-for="s in PROFILE_STATES" :key="s.id" class="cl-legend-item"><span class="cl-swatch cl-bar-key" :class="`cl-bar-${s.id}`"></span>{{ s.label }}</span>
    </div>
    <div v-if="!shown.length" class="cl-empty">No line has a level 4 value for this gene.</div>
    <div v-else class="cl-prof-scroll">
      <div class="cl-prof" :style="{ minWidth: `${minWidth}px` }" data-test="profile" @click="onClick">
        <div class="cl-prof-yaxis" aria-hidden="true"><span>1</span><span>0.5</span><span>0</span></div>
        <div v-for="g in shown" :key="g.value" class="cl-prof-group" :style="{ flexGrow: g.bars.length }" data-test="profile-group">
          <div class="cl-prof-bars" role="img" :aria-label="`${g.value}: ${g.bars.length} lines`">
            <span v-for="b in g.bars" :key="b.line" class="cl-bar" :class="`cl-bar-${b.state}`" :data-line="b.line"
                  :style="{ height: `${b.l4_mean * 100}%` }" :title="tip(b)"></span>
          </div>
          <div class="cl-prof-label" :title="g.value">{{ g.value }}</div>
        </div>
      </div>
    </div>
    <button v-if="hidden" type="button" class="cl-linkbtn" data-test="profile-toggle" @click="showAll = !showAll">
      {{ showAll ? 'Hide' : 'Show' }} {{ hidden }} group{{ hidden === 1 ? '' : 's' }} with fewer than {{ MIN_GROUP_LINES }} lines or no within-study comparison
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { MIN_GROUP_LINES, PROFILE_STATES, profileBars, fmt } from '../../cellLines.js'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  kind: { type: String, default: 'lineage' },
})
const emit = defineEmits(['select-line'])
const showAll = ref(false)
watch(() => props.kind, () => { showAll.value = false })

const STATE_LABEL = Object.fromEntries(PROFILE_STATES.map((s) => [s.id, s.label.toLowerCase()]))
const rows = computed(() => profileBars(props.lines, props.groups, props.kind))
const shown = computed(() => (showAll.value ? rows.value : rows.value.filter((g) => !g.small)))
const hidden = computed(() => rows.value.filter((g) => g.small).length)
// 1px per bar plus room for each group's label keeps bars crisp; narrower screens scroll inside the panel.
const minWidth = computed(() => 28 + shown.value.reduce((n, g) => n + Math.max(14, g.bars.length) + 3, 0))
const tip = (b) => `${b.name} · ${[b.lineage, b.primary_disease].filter(Boolean).join(' / ')} · rank ${fmt(b.l4_mean)} · ${STATE_LABEL[b.state]}`
function onClick(e) {
  const line = e.target?.dataset?.line
  if (line) emit('select-line', line)
}
</script>
