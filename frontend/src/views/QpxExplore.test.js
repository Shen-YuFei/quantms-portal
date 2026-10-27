// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import QpxExplore from './QpxExplore.vue'

const overview = {
  accession: 'PXD1', phash: 'abc', files: { pg: ['x.pg.parquet'] },
  available_views: { feature: false, pg: true, psm: false, sample: false, run: true },
  row_counts: { pg: 3, run: 552 }, protein_groups: 2,
  organisms: [], organism_parts: [], instruments: [], acquisition_methods: [],
}

let searchDown = false

function respond(url) {
  const ds = url.match(/dataset-search\/datasets\/([^/?]+)$/)
  if (ds && searchDown) throw new TypeError('network down')
  if (ds) return ds[1] === 'PXD021013' ? {} : { accession: ds[1], dataset_ref: `${ds[1]}/hash1`, samples: 42 }
  if (url.includes('/overview')) return overview
  if (url.includes('/runs')) return { runs: [{ run_file_name: 'r1' }] }
  if (url.includes('/proteins')) return { columns: ['anchor_protein', 'intensity'], rows: [['P1', 40]] }
  if (url.includes('/schema')) return { views: [] }
  return {}
}

beforeEach(() => {
  searchDown = false
  global.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => respond(String(url)) }))
})
afterEach(() => { vi.restoreAllMocks() })

async function open(query) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/apps/qpx-explore', component: QpxExplore }, { path: '/:p(.*)*', component: { template: '<div/>' } }] })
  router.push({ path: '/apps/qpx-explore', query })
  await router.isReady()
  const w = mount(QpxExplore, { global: { plugins: [router] } })
  await flushPromises()
  w.router = router
  return w
}

const searchCalls = () => global.fetch.mock.calls.filter((c) => String(c[0]).includes('dataset-search/datasets/')).length

describe('QpxExplore', () => {
  it('offers examples on the start page, resolved to their current version', async () => {
    const w = await open({})
    const cards = w.findAll('.qx-example')
    expect(cards.map((c) => c.find('.qx-example-acc').text())).toEqual(['MSV000085836', 'PXD048538', 'PXD021013'])
    expect(cards[0].find('.qx-example-kind').text()).toContain('42 samples')
    // an example dataset search cannot resolve says so instead of sitting disabled
    expect(cards[2].attributes('disabled')).toBeUndefined()
    expect(cards[2].find('.qx-example-failed').exists()).toBe(true)
    await cards[0].trigger('click')
    await flushPromises()
    expect(global.fetch.mock.calls.some((c) => String(c[0]).includes('/datasets/MSV000085836/hash1/overview'))).toBe(true)
  })

  it('retries an example whose lookup failed', async () => {
    searchDown = true
    const w = await open({})
    expect(w.findAll('.qx-example-failed')).toHaveLength(3)
    searchDown = false
    await w.findAll('.qx-example')[0].trigger('click')
    await flushPromises()
    const card = w.findAll('.qx-example')[0]
    expect(card.find('.qx-example-failed').exists()).toBe(false)
    expect(card.find('.qx-example-kind').text()).toContain('42 samples')
  })

  it('does not look up examples when opened on a dataset', async () => {
    await open({ ref: 'PXD1/abc' })
    expect(searchCalls()).toBe(0)
  })

  it('returns to a working start page when the ref leaves the URL', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    await w.router.push({ path: '/apps/qpx-explore', query: {} })
    await flushPromises()
    const cards = w.findAll('.qx-example')
    expect(cards).toHaveLength(3)
    expect(cards[0].attributes('disabled')).toBeUndefined()
    expect(w.find('.qx-card').exists()).toBe(false)
  })

  it('disables tabs whose table the dataset lacks', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    const tab = (label) => w.findAll('.qx-tab').find((b) => b.text() === label)
    expect(tab('Proteins').attributes('disabled')).toBeUndefined()
    expect(tab('Runs').attributes('disabled')).toBeUndefined()
    expect(tab('PSMs').attributes('disabled')).toBeDefined()
    expect(tab('PSMs').attributes('title')).toBe('This dataset has no psm table')
    expect(tab('Features').attributes('disabled')).toBeDefined()
  })

  it('counts protein groups and runs from the overview, not the loaded rows', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    const cards = Object.fromEntries(w.findAll('.qx-card').map((c) => [c.find('.qx-card-label').text(), c.find('.qx-card-val').text()]))
    expect(cards['Protein groups']).toBe('2')
    expect(cards.Runs).toBe('552')
  })

  it('falls back to the overview when a deep-linked tab is unavailable', async () => {
    const w = await open({ ref: 'PXD1/abc', tab: 'spectra' })
    expect(w.find('.qx-tab.active').text()).toBe('Overview')
  })

  it('opens the PSM tab from an old ?tab=spectra link', async () => {
    overview.available_views.psm = true
    try {
      const w = await open({ ref: 'PXD1/abc', tab: 'spectra' })
      expect(w.find('.qx-tab.active').text()).toBe('PSMs')
    } finally {
      overview.available_views.psm = false
    }
  })

  it('loads a tab only when it is opened, once', async () => {
    const w = await open({ ref: 'PXD1/abc' })
    const urls = () => global.fetch.mock.calls.map((c) => String(c[0]))
    expect(urls().some((u) => u.includes('/proteins') || u.includes('/runs'))).toBe(false)
    const tab = (label) => w.findAll('.qx-tab').find((b) => b.text() === label)
    await tab('Proteins').trigger('click')
    await flushPromises()
    await tab('Overview').trigger('click')
    await tab('Proteins').trigger('click')
    await flushPromises()
    expect(urls().filter((u) => u.includes('/proteins')).length).toBe(1)
  })

  it('sends sort parameters when a protein column is clicked', async () => {
    const w = await open({ ref: 'PXD1/abc', tab: 'proteins' })
    await w.findAll('th button')[1].trigger('click')
    await flushPromises()
    const last = String(global.fetch.mock.calls.at(-1)[0])
    expect(last).toContain('/proteins')
    expect(last).toContain('sort=intensity')
  })
})
