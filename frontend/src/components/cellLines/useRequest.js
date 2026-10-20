import { ref } from 'vue'

// Latest-call-wins request state: a slower earlier response never overwrites a newer one.
export function useRequest(fn) {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let token = 0
  async function run(...args) {
    const mine = ++token
    loading.value = true
    error.value = null
    try {
      const result = await fn(...args)
      if (mine === token) data.value = result
    } catch (e) {
      if (mine === token) { error.value = e; data.value = null }
    } finally {
      if (mine === token) loading.value = false
    }
  }
  function reset() {
    token++
    data.value = null
    error.value = null
    loading.value = false
  }
  return { data, loading, error, run, reset }
}
