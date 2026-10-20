<template>
  <div v-if="loading" class="cl-loading" role="status">{{ loadingText }}</div>
  <div v-else-if="error" class="cl-notice" :class="{ 'cl-notice-warn': error.status === 503 }" role="alert">
    {{ errorMessage(error, what) }}
    <button v-if="retry && error.status !== 404" type="button" class="page-btn cl-retry" @click="retry">Retry</button>
  </div>
</template>

<script setup>
import { errorMessage } from '../../cellLines.js'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
  what: { type: String, default: 'This item' },
  loadingText: { type: String, default: 'Loading…' },
  retry: { type: Function, default: null },
})
</script>
