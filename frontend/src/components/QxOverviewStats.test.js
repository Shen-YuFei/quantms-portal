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
  mass_error: { available: true, source: 'feature', bins: [[-0.04, -0.035, 3], [-0.035, -0.03, 5]], bin_width: 0.005, n_outside: 2 },
  rt: { available: false, source: 'feature' },
  intensity: { available: false, source: 'feature' },
  pep: { available: false, source: 'feature' },
  peptides_per_protein: { available: true, source: 'pg', rows: [[1, 2], [20, 1]], capped_at: 20 },
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
    expect(w.text()).toContain('Computing statistics · 2 of 11')
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
    expect(w.text()).not.toContain('Missed cleavages') // absent parts are hidden, not shown empty
    expect(charts).toContain('-0.038,-0.033') // bin centres, decimals follow the bin width
    expect(w.text()).toContain('2 (20.0%) outside the range are not drawn.')
    expect(charts).toContain('1,20+')
    expect(w.text()).toContain('Organism part')
    expect(w.text()).not.toContain('Sex') // a single category is not a chart
  })
})
