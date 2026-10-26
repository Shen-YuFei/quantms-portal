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

function respond(url) {
  if (url.includes('/overview')) return overview
  if (url.includes('/runs')) return { runs: [{ run_file_name: 'r1' }] }
  if (url.includes('/proteins')) return { columns: ['anchor_protein', 'intensity'], rows: [['P1', 40]] }
  if (url.includes('/schema')) return { views: [] }
  return {}
}

beforeEach(() => {
  global.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => respond(String(url)) }))
})
afterEach(() => { vi.restoreAllMocks() })

async function open(query) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/apps/qpx-explore', component: QpxExplore }, { path: '/:p(.*)*', component: { template: '<div/>' } }] })
  router.push({ path: '/apps/qpx-explore', query })
  await router.isReady()
  const w = mount(QpxExplore, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

describe('QpxExplore', () => {
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
