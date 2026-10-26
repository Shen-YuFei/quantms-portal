// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QxOverviewStats from './QxOverviewStats.vue'

const STATS = {
  summary: { available: true, source: 'feature', n_target: 10, n_peptides: 6, n_peptidoforms: 8, decoy_pct: 0, median_per_run: 5 },
  per_run: { available: true, source: 'feature', rows: [['r1', 6], ['r2', 4]] },
  charge: { available: true, source: 'feature', rows: [[2, 7], [3, 3]] },
  length: { available: true, source: 'feature', rows: [[7, 4], [8, 6]] },
  missed_cleavages: { available: false, source: 'feature' },
  metadata: { available: true, source: 'sample', fields: {
    organism_part: { top: [['breast', 3], ['lung', 1]], distinct: 2 },
    sex: { top: [['female', 4]], distinct: 1 },
  } },
}

let resolvers
beforeEach(() => {
  resolvers = {}
  global.fetch = vi.fn((url) => new Promise((resolve) => {
    const part = String(url).split('/stats/')[1]
    resolvers[part] = () => resolve({ ok: true, status: 200, json: async () => STATS[part] })
  }))
})
afterEach(() => { vi.restoreAllMocks() })

const mountIt = () => mount(QxOverviewStats, {
  props: { datasetRef: 'PXD1/abc' },
  global: { stubs: { StatsChart: { props: ['data'], template: '<div class="chart">{{ data.labels.join(",") }}</div>' } } },
})

describe('QxOverviewStats', () => {
  it('shows real progress as parts arrive', async () => {
    const w = mountIt()
    expect(w.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    resolvers.summary(); resolvers.charge()
    await flushPromises()
    expect(w.text()).toContain('Computing statistics · 2 of 6')
    Object.values(resolvers).forEach((r) => r())
    await flushPromises()
    expect(w.find('[role="progressbar"]').exists()).toBe(false)
  })

  it('renders tiles, charts and sample annotations', async () => {
    const w = mountIt()
    Object.values(resolvers).forEach((r) => r())
    await flushPromises()
    expect(w.text()).toContain('Peptidoforms')
    expect(w.text()).not.toContain('Decoy') // 0% decoys after FDR filtering is not shown
    const charts = w.findAll('.chart').map((c) => c.text())
    expect(charts).toContain('2+,3+')
    expect(w.text()).toContain('Not recorded in this dataset.') // missed cleavages absent
    expect(w.text()).toContain('Organism part')
    expect(w.text()).not.toContain('Sex') // a single category is not a chart
  })
})
