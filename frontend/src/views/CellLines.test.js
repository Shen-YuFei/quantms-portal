// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../api.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, apiGet: vi.fn() }
})
import { apiGet, ApiError } from '../api.js'
import CellLines from './CellLines.vue'
import { routes } from '../router.js'

const manifest = { atlas: 'v3.5', built: '2026-10-20T10:00:00+00:00', amendments: ['A41', 'A44'], level4: 'level4_rank_corrected (A41)' }
const groups = { groups: [{ group: 'lineage', value: 'Lung', n_lines: 3 }, { group: 'lineage', value: 'Breast', n_lines: 2 }] }
const vim = {
  gene: { gene: 'VIM', reliability_class: 'reliable', icc: 0.81, spec_cat3: 'lineage enriched', spec_top3: 'Lung', n_lines_present: 2, n_lines_measured: 3, n_studies: 4, is_family: false, contamination_prone: true },
  lines: [
    { line: 'CVCL_0001', name: 'L1', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.9, n_studies_measured: 2, n_studies_present: 2, n_studies_present_high: 2 },
    { line: 'CVCL_0002', name: 'L2', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.5, n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0 },
    { line: 'CVCL_0003', name: 'B1', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.4, n_studies_measured: 1, n_studies_present: 1, n_studies_present_high: 0 },
  ],
  values: [{ study: 'S1', line: 'CVCL_0001', l1: 20.1, l3: 0.3, present: true, present_high: true, n_pep: 5, acq: 'DIA', comparability: 'ok' }],
  groups: [{ group: 'lineage', group_value: 'Lung', n_lines: 2, mean_l4: 0.7, median_l4: 0.7, frac_present: 0.5 }],
  links: { uniprot: 'https://u', depmap: 'https://d', string: 'https://s', hpa_cell_line: 'https://h1', hpa_tissue: 'https://h2' },
}
const coexp = { gene: 'VIM', threshold: '|Z| >= 5 (A44)', edges: [{ partner: 'DES', z: 7.2, studies: 5, distinct_lines: 300, reliability_class: 'reliable' }] }

function respond(overrides = {}) {
  apiGet.mockImplementation(async (base, path, params) => {
    if (path in overrides) {
      const v = overrides[path]
      if (v instanceof Error) throw v
      return typeof v === 'function' ? v(params) : v
    }
    if (path === '/manifest') return manifest
    if (path === '/groups') return groups
    if (path === '/genes/VIM') return vim
    if (path === '/genes/VIM/rna') return { depmap: [], hpa: [], agreement: null, sources: {} }
    if (path === '/genes/VIM/coexpression' || path === '/genes/DES/coexpression') return coexp
    if (path === '/datasets') return { datasets: [], live_status: { live: [] } }
    if (path === '/compare') return params.lines ? { lines: [], genes: [] } : { group: params.group, a: params.a, b: params.b, genes: [] }
    throw new ApiError('not found', 404)
  })
}

async function mountAt(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  const w = mount(CellLines, { global: { plugins: [router], stubs: { ScatterChart: true } } })
  await flushPromises()
  return { w, router }
}

describe('CellLines view', () => {
  beforeEach(() => { apiGet.mockReset() })

  it('reads tab and gene from the URL and writes tab changes back', async () => {
    respond()
    const { w, router } = await mountAt('/cell-lines?tab=protein&gene=VIM')
    expect(apiGet.mock.calls.some((c) => c[1] === '/genes/VIM')).toBe(true)
    expect(w.find('[data-tab="protein"]').attributes('aria-selected')).toBe('true')
    const header = w.find('[data-test="gene-header"]').text()
    expect(header).toContain('VIM')
    expect(header).toContain('reliable')
    expect(header).toContain('contamination-prone')
    expect(w.text()).toContain('not comparable across studies')
    expect(w.text()).toContain('|Z| >= 5 (A44)')
    expect(w.find('[data-test="provenance"]').text()).toContain('Updated 2026-10-20')

    await w.find('[data-tab="line"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'line', gene: 'VIM' })
    expect(w.find('[data-tab="line"]').attributes('aria-selected')).toBe('true')
  })

  it('switches to a partner gene from the neighbours table', async () => {
    respond()
    const { w, router } = await mountAt('/cell-lines?gene=VIM')
    const partner = w.findAll('button').find((b) => b.text() === 'DES')
    await partner.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'protein', gene: 'DES' })
  })

  it('shows presence per lineage including not-measured lines', async () => {
    respond()
    const { w } = await mountAt('/cell-lines?gene=VIM')
    const rows = w.findAll('[data-test="presence-row"]')
    const lung = rows.find((r) => r.text().startsWith('Lung'))
    expect(lung.text()).toContain('1 / 3')
    expect(lung.find('.cl-presence-bar').attributes('aria-label')).toContain('1 not measured')
    expect(lung.findAll('.cl-dot')[0].attributes('title')).toBe('L1: detected in 2 of 2 studies that measured it (≥2 peptides in 2)')
  })

  it('shows the atlas-loading message on 503', async () => {
    respond({ '/genes/VIM': new ApiError('x', 503), '/manifest': new ApiError('x', 503) })
    const { w } = await mountAt('/cell-lines?gene=VIM')
    expect(w.text()).toContain('The atlas is loading, try again shortly.')
  })

  it('shows a not-in-atlas message on 404', async () => {
    respond()
    const { w } = await mountAt('/cell-lines?gene=NOPE')
    expect(w.text()).toContain('Gene NOPE is not in the atlas.')
  })

  it('requests a line comparison from the URL selection', async () => {
    respond()
    await mountAt('/cell-lines?tab=compare&lines=CVCL_0001,CVCL_0002')
    const call = apiGet.mock.calls.find((c) => c[1] === '/compare')
    expect(call[2]).toEqual({ lines: 'CVCL_0001,CVCL_0002' })
  })

  it('requests a group comparison and labels it descriptive', async () => {
    respond()
    const { w } = await mountAt('/cell-lines?tab=compare&mode=groups&group=lineage&a=Lung&b=Breast')
    const call = apiGet.mock.calls.find((c) => c[1] === '/compare')
    expect(call[2]).toEqual({ group: 'lineage', a: 'Lung', b: 'Breast' })
    expect(w.text()).toContain('Descriptive difference in mean within-study rank; not a statistical test.')
  })

  it('writes the compare group selection to the URL', async () => {
    respond()
    const { w, router } = await mountAt('/cell-lines?tab=compare&mode=groups')
    await w.find('select[aria-label="Group A"]').setValue('Lung')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'compare', mode: 'groups', a: 'Lung' })
  })

  it('renders the co-expression tab with the threshold label', async () => {
    respond()
    const { w } = await mountAt('/cell-lines?tab=coexpression&gene=VIM')
    expect(w.find('svg.cl-network').exists()).toBe(true)
    expect(w.text()).toContain('|Z| >= 5 (A44)')
  })

  it('handles a gene with no edges', async () => {
    respond({ '/genes/VIM/coexpression': { gene: 'VIM', threshold: '|Z| >= 5 (A44)', edges: [] } })
    const { w } = await mountAt('/cell-lines?tab=coexpression&gene=VIM')
    expect(w.text()).toContain('No edges at the validated threshold')
  })

  it('renders the datasets catalogue with live/pending status', async () => {
    respond({
      '/datasets': {
        n_datasets: 2,
        datasets: [{ accession: 'PXD030304', n_cell_lines: 950, live: 1, portal_collection: 'absolute-expression' }, { accession: 'PXD058664', n_cell_lines: 10, live: 0 }],
        live_status: { n_live: 1, n_pending: 1, live: [{ accession: 'PXD030304', portal_collection: 'absolute-expression' }] },
      },
    })
    const { w } = await mountAt('/cell-lines?tab=datasets')
    const rows = w.findAll('[data-test="datasets-table"] tbody tr')
    expect(rows.map((r) => r.find('td').text())).toEqual(['PXD030304', 'PXD058664'])
    expect(rows[0].text()).toContain('live')
    expect(rows[1].text()).toContain('pending')
    await w.findAll('[data-test="datasets-table"] th')[0].trigger('click')
    expect(w.findAll('[data-test="datasets-table"] tbody tr')[0].find('td').text()).toBe('PXD030304')
  })
})

describe('/apps/coexpression redirect', () => {
  it('redirects to the co-expression tab and keeps the gene', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/apps/coexpression?gene=PSMA1')
    expect(router.currentRoute.value.path).toBe('/cell-lines')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression', gene: 'PSMA1' })
    await router.push('/apps/coexpression?protein=P25786')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression' })
    await router.push('/apps/coexpression')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression' })
  })
})
