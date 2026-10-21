<template>
  <div class="cl-picker">
    <label :for="id" class="cl-ctl-label">{{ label }}</label>
    <input
      :id="id"
      v-model="query"
      class="cl-input"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      @keydown.enter.prevent="pickFirst"
      @keydown.esc="open = false"
      @blur="closeSoon"
    />
    <ul v-if="open && suggestions.length" class="cl-suggestions" role="listbox">
      <li v-for="s in suggestions" :key="keyOf(s)">
        <button type="button" @mousedown.prevent @click="pick(s)">
          <template v-if="kind === 'gene'">
            <strong>{{ s.gene }}</strong>
            <span v-if="s.protein_name" class="cl-muted">{{ s.protein_name }}</span>
            <span v-if="s.match && s.match !== 'gene' && s.match !== 'protein_name'" class="cl-muted">matched {{ s.matched }}</span>
            <span class="cl-muted">{{ s.reliability_class || 'no reliability class' }} · detected in {{ s.n_lines_present ?? '—' }} / {{ s.n_lines_measured ?? '—' }} lines</span>
          </template>
          <template v-else>
            <strong>{{ s.name }}</strong>
            <span class="cl-muted">{{ s.line }} · {{ s.lineage }} · {{ s.primary_disease }}</span>
          </template>
        </button>
      </li>
    </ul>
    <p v-if="noMatch" class="cl-no-match" role="status">No {{ kind === 'gene' ? 'gene or protein' : 'cell line' }} matches “{{ query.trim() }}”.</p>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { searchGenes, searchLines } from '../../cellLines.js'

const props = defineProps({
  kind: { type: String, default: 'gene' },
  id: { type: String, required: true },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  debounce: { type: Number, default: 200 },
})
const emit = defineEmits(['select'])

const query = ref('')
const suggestions = ref([])
const open = ref(false)
const noMatch = ref(false)
let timer = null
let token = 0

const keyOf = (s) => (props.kind === 'gene' ? s.gene : s.line)

async function search(q) {
  const mine = ++token
  try {
    const rows = await (props.kind === 'gene' ? searchGenes(q) : searchLines(q))
    if (mine !== token) return
    suggestions.value = rows
    open.value = true
    noMatch.value = !rows.length
  } catch (e) {
    if (mine === token) suggestions.value = []
  }
}

watch(query, (q) => {
  clearTimeout(timer)
  noMatch.value = false
  const term = q.trim()
  if (!term) { token++; suggestions.value = []; return }
  timer = setTimeout(() => search(term), props.debounce)
})

function pick(s) {
  open.value = false
  suggestions.value = []
  query.value = ''
  emit('select', keyOf(s), s)
}

function pickFirst() {
  if (suggestions.value.length) return pick(suggestions.value[0])
  const term = query.value.trim()
  if (!term) return
  if (props.kind === 'gene') { query.value = ''; emit('select', term.toUpperCase()) }
  else if (/^CVCL_/i.test(term)) { query.value = ''; emit('select', term.toUpperCase()) }
  else noMatch.value = true
}

function closeSoon() { setTimeout(() => { open.value = false }, 150) }
onBeforeUnmount(() => clearTimeout(timer))
</script>
