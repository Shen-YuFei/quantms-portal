<template>
  <div class="cl-toggle" role="group" aria-label="Group by">
    <button v-for="k in GROUP_KINDS" :key="k.id" type="button" :class="{ active: modelValue === k.id }"
            :aria-pressed="modelValue === k.id" @click="$emit('update:modelValue', k.id)">{{ k.label }}</button>
  </div>
</template>

<script setup>
import { GROUP_KINDS } from '../../cellLines.js'

defineProps({ modelValue: { type: String, default: 'lineage' } })
defineEmits(['update:modelValue'])
</script>
