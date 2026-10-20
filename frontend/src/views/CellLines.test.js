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
    { line: 'CVCL_0004', name: 'L3', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: 0, n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 },
    { line: 'CVCL_0003', name: 'B1', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.4, n_studies_measured: 1, n_studies_present: 1, n_studies_present_high: 0 },
  ],
  values: [{ study: 'S1', line: 'CVCL_0001', l1: 20.1, l3: 0.3, present: true, present_high: true, n_pep: 5, acq: 'DIA', comparability: 'ok' }],
  groups: [{ group: 'lineage', group_value: 'Lung', n_lines: 2, mean_l4: 0.7, median_l4: 0.7, frac_present: 0.5 }],
  links: { uniprot: 'https://u', depmap: 'https://d', string: 'https://s', hpa_cell_line: 'https://h1', hpa_tissue: 'https://h2' },
}
const coexp = {
  gene: 'VIM',
  threshold: '|Z| >= 5 (A44)',
  display_min_z: 4.0,
  complexes: [{ complex_ac: 'CPX-1', complex_name: 'Intermediate filament' }],
  partners: [
    { partner: 'DES', z: 7.2, rank: 1, studies: 5, distinct_lines: 300, validated: true, reliability_class: 'reliable', shared_complexes: ['Intermediate filament'] },
    { partner: 'LMNA', z: 6.1, rank: 2, studies: 5, distinct_lines: 280, validated: true, reliability_class: 'reliable', shared_complexes: [] },
    { partner: 'NES', z: 4.3, rank: 3, studies: 4, distinct_lines: 200, validated: false, reliability_class: 'moderate', shared_complexes: [] },
  ],
}
const rnaBody = {
  depmap: [
    { line: 'CVCL_0001', name: 'L1', lineage: 'Lung', log2_tpm: 8, l4_mean: 0.9, protein_state: 'detected' },
    { line: 'CVCL_0003', name: 'B1', lineage: 'Breast', log2_tpm: 6, l4_mean: 0.4, protein_state: 'detected' },
    { line: 'CVCL_0002', name: 'L2', lineage: 'Lung', log2_tpm: 1, l4_mean: 0, protein_state: 'absent' },
    { line: 'CVCL_0004', name: 'L3', lineage: 'Lung', log2_tpm: 2, l4_mean: 0, protein_state: 'plex' },
  ],
  hpa: [{ line: 'CVCL_0001', name: 'L1', lineage: 'Lung', ntpm: 255, l4_mean: 0.9 }, { line: 'CVCL_0002', name: 'L2', lineage: 'Lung', ntpm: 3, l4_mean: 0 }],
  agreement: { rna_protein_spearman: 0.72, rna_protein_lines: 400, rna_sd: 2.1, flat_rna: false, icc: 0.81, reliability_class: 'reliable', n_lines_present: 2, n_lines_measured: 4, n_lines_plex_only: 1, rho_percentile: 0.93 },
  atlas: { bin: 0.05, hist: [[0.3, 10], [0.7, 4]], median: 0.35, genes: 9000, flat_rna_sd: 0.5 },
  sources: {},
}

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
    if (path === '/genes/VIM/rna') return rnaBody
    if (path === '/genes/VIM/coexpression' || path === '/genes/DES/coexpression') return coexp
    if (path === '/datasets') return { studies: [] }
    if (path === '/compare') return params.lines ? { lines: [], genes: [] } : { group: params.group, a: params.a, b: params.b, genes: [], background: [] }
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
    const { w, router } = await mountAt('/apps/cell-lines?tab=protein&gene=VIM')
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
    const { w, router } = await mountAt('/apps/cell-lines?gene=VIM')
    const partner = w.findAll('button').find((b) => b.text() === 'DES')
    await partner.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'protein', gene: 'DES' })
  })

  it('shows one dot-plot row per lineage with plex-only lines counted apart', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    const rows = w.findAll('[data-test="dot-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Lung')
    expect(rows[0].find('[data-test="dot-count"]').text()).toBe('1 / 3 measured · 1 TMT plex only')
    expect(w.find('[data-test="dot-strip"]').exists()).toBe(false)
    await rows[0].find('button').trigger('click')
    const strip = w.find('[data-test="dot-strip"]')
    expect(strip.findAll('.cl-hpt').map((p) => p.classes().find((c) => c.startsWith('cl-p-')))).toEqual(['cl-p-high', 'cl-p-absent', 'cl-p-plex'])
    expect(strip.find('.cl-hpt').attributes('title')).toContain('L1: detected in 2 of 2 studies that measured it')

    const toggle = w.find('[data-test="dot-toggle"]')
    expect(toggle.text()).toContain('Show 1 group with fewer than 3 lines')
    await toggle.trigger('click')
    expect(w.findAll('[data-test="dot-row"]').map((r) => r.find('.cl-presence-label').text())).toEqual(['Lung', 'Breast'])
  })

  it('reads and writes the grouping as by= in the URL', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?gene=VIM&by=disease')
    expect(w.find('[aria-label="Group by"] button.active').text()).toBe('Primary disease')
    expect(w.text()).toContain('Detection and abundance by primary disease')
    await w.findAll('[aria-label="Group by"] button').find((b) => b.text() === 'Lineage').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ gene: 'VIM', by: 'lineage' })
    await w.findAll('[aria-label="Group by"] button').find((b) => b.text() === 'Primary disease').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.by).toBe('disease')
  })

  it('shows the RNA verdict, detection groups and a detected-only scatter', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.find('[data-test="rna-verdict"]').text()).toBe('Protein tracks mRNA across lines.')
    expect(w.findAll('[data-test="rna-detection-row"]').map((r) => r.find('.cl-presence-label').text()))
      .toEqual(['Detected n=2', 'Identified in TMT plex only n=1', 'Not detected n=1'])
    const chart = w.findComponent({ name: 'ScatterChart' })
    expect(chart.props('data').datasets[0].data.map((p) => p.label)).toEqual(['L1', 'B1'])
    expect(w.find('[data-test="rna-scatter-note"]').text()).toContain('2 measured but non-detected lines')
    expect(w.find('[data-test="rho-hist"]').text()).toContain('93% percentile')
    expect(w.text()).toContain('Edfors et al. 2016')

    await w.findAll('button').find((b) => b.text() === 'HPA cell lines').trigger('click')
    expect(w.findComponent({ name: 'ScatterChart' }).props('data').datasets[0].data.map((p) => p.label)).toEqual(['L1'])
  })

  it('skips the scatter when RNA is flat', async () => {
    respond({ '/genes/VIM/rna': { ...rnaBody, agreement: { ...rnaBody.agreement, flat_rna: true } } })
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.find('[data-test="rna-verdict"]').text()).toContain('RNA barely varies across lines')
    expect(w.find('[data-test="rna-flat"]').exists()).toBe(true)
    expect(w.findComponent({ name: 'ScatterChart' }).exists()).toBe(false)
  })

  it('shows the atlas-loading message on 503', async () => {
    respond({ '/genes/VIM': new ApiError('x', 503), '/manifest': new ApiError('x', 503) })
    const { w } = await mountAt('/apps/cell-lines?gene=VIM')
    expect(w.text()).toContain('The atlas is loading, try again shortly.')
  })

  it('shows a not-in-atlas message on 404', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?gene=NOPE')
    expect(w.text()).toContain('Gene NOPE is not in the atlas.')
  })

  it('requests a line comparison from the URL selection', async () => {
    respond()
    await mountAt('/apps/cell-lines?tab=compare&lines=CVCL_0001,CVCL_0002')
    const call = apiGet.mock.calls.find((c) => c[1] === '/compare')
    expect(call[2]).toEqual({ lines: 'CVCL_0001,CVCL_0002' })
  })

  it('requests a group comparison and labels it descriptive', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?tab=compare&mode=groups&group=lineage&a=Lung&b=Breast')
    const call = apiGet.mock.calls.find((c) => c[1] === '/compare')
    expect(call[2]).toEqual({ group: 'lineage', a: 'Lung', b: 'Breast', background: true })
    expect(w.text()).toContain('Descriptive difference in mean within-study rank; not a statistical test.')
  })

  it('plots background genes under the top genes with an x = y line', async () => {
    respond({
      '/compare': (p) => ({
        group: p.group, a: p.a, b: p.b, background: [['AAA', 0.1, 0.2], ['BBB', 0.5, 0.5], ['VIM', 0.9, 0.3]],
        genes: [{ gene: 'VIM', delta: 0.6, mean_l4_a: 0.9, mean_l4_b: 0.3, n_lines_a: 30, n_lines_b: 40 }],
      }),
    })
    const { w } = await mountAt('/apps/cell-lines?tab=compare&mode=groups&group=lineage&a=Lung&b=Breast')
    const sets = w.findComponent({ name: 'ScatterChart' }).props('data').datasets
    expect(sets.map((d) => [d.label, d.data.length])).toEqual([['largest differences', 1], ['x = y', 2], ['all genes', 3]])
    expect(sets[1].showLine).toBe(true)
    expect(w.find('[data-test="compare-groups-table"] td.cl-nowrap').text()).toBe('30 / 40')
  })

  it('writes the compare group selection to the URL', async () => {
    respond()
    const { w, router } = await mountAt('/apps/cell-lines?tab=compare&mode=groups')
    await w.find('select[aria-label="Group A"]').setValue('Lung')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'compare', mode: 'groups', a: 'Lung' })
  })

  it('renders the co-expression tab with validated and ranked edges', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=VIM')
    expect(w.find('svg.cl-network').exists()).toBe(true)
    expect(w.text()).toContain('|Z| >= 5 (A44)')
    expect(w.find('[data-test="own-complexes"]').text()).toBe('Complexes: Intermediate filament')
    expect(w.findAll('[data-edge]').map((e) => e.attributes('data-edge'))).toEqual(['validated', 'validated', 'ranked'])
    expect(w.findAll('svg.cl-network line.cl-edge-ranked')).toHaveLength(1)
    expect(w.findAll('[data-test="edge-kind"]').map((c) => c.text())).toEqual(['validated (A44)', 'validated (A44)', 'ranked neighbour'])
    const badge = w.find('[data-test="same-complex"]')
    expect(badge.text()).toBe('same complex')
    expect(badge.attributes('title')).toBe('Intermediate filament')
    expect(w.find('[data-test="coexp-caption"]').text()).toContain('Partners ranked by |Z| on the A44 recipe, shown down to |Z| ≥ 4 (about one chance partner per gene expected at that level). Only |Z| ≥ 5 is validated; |Z| 4–5 are ranked neighbours. Complex Portal is used for annotation only.')
  })

  it('filters partners beyond shared complexes or validated only', async () => {
    respond()
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=VIM')
    const partnersShown = () => w.findAll('[data-test="partner-row"]').map((r) => r.find('button').text())
    await w.find('[data-filter="beyond"]').trigger('click')
    expect(partnersShown()).toEqual(['LMNA', 'NES'])
    await w.find('[data-filter="validated"]').trigger('click')
    expect(partnersShown()).toEqual(['DES', 'LMNA'])
    expect(w.findAll('[data-edge]')).toHaveLength(2)
    await w.find('[data-filter="all"]').trigger('click')
    expect(partnersShown()).toEqual(['DES', 'LMNA', 'NES'])
  })

  it('handles a gene with no partners', async () => {
    respond({ '/genes/VIM/coexpression': { gene: 'VIM', threshold: '|Z| >= 5 (A44)', display_min_z: 4.0, partners: [], complexes: [] } })
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=VIM')
    const empty = w.find('[data-test="coexp-empty"]')
    expect(empty.text()).toContain('No partners at |Z| ≥ 4 for VIM: its co-variation across lines is not distinguishable from chance.')
    expect(empty.find('a').attributes('href')).toContain('string-db.org')
    expect(empty.find('button').text()).toBe('Protein view for VIM →')
  })

  it('shows negative partners in their own colour (PSMB9)', async () => {
    const imm = ['20S immunoproteasome complex']
    const p = (partner, z, validated, shared = []) => ({ partner, z, validated, studies: 5, distinct_lines: 900, shared_complexes: shared })
    respond({
      '/genes/PSMB9/coexpression': {
        gene: 'PSMB9', threshold: '|Z| >= 5 (A44)', display_min_z: 4.0, complexes: [{ complex_ac: 'CPX-9003', complex_name: imm[0] }],
        partners: [p('PSMB8', 6.9, true, imm), p('PSMB10', 6.8, true, imm), p('TAP2', 6.2, true), p('TAP1', 6.1, true), p('TAPBP', 5.9, true),
          p('IFI35', 5.4, true), p('UBE2L6', 5.3, true), p('NMI', 5.0, true), p('B2M', 5.0, false), p('HLA-B', 4.9, false),
          p('PSME1', 4.8, false), p('PSMB5', -4.7, false)],
      },
    })
    const { w } = await mountAt('/apps/cell-lines?tab=coexpression&gene=PSMB9')
    expect(w.findAll('svg.cl-network line.cl-edge-neg')).toHaveLength(1)
    const psmb5 = w.findAll('[data-test="partner-row"]').find((r) => r.find('button').text() === 'PSMB5')
    expect(psmb5.find('td.cl-neg').text()).toBe('-4.7')
    expect(w.findAll('[data-test="same-complex"]')).toHaveLength(2)
    await w.find('[data-filter="beyond"]').trigger('click')
    expect(w.findAll('[data-test="partner-row"]')).toHaveLength(10)
    await w.find('[data-filter="validated"]').trigger('click')
    expect(w.findAll('[data-test="partner-row"]')).toHaveLength(8)
  })

  it('lists the atlas studies with linked accessions', async () => {
    respond({
      '/datasets': {
        studies: [
          { study: 'NCI60', acq: ['DDA'], n_lines: 60, n_batches: 1, accessions: ['PMID23933261'] },
          { study: 'ProCan', acq: ['DIA'], n_lines: 949, n_batches: 6, accessions: ['PXD030304'] },
          { study: 'CCLE', acq: ['TMT'], n_lines: 375, n_batches: 42, accessions: ['MSV000085836', 'PXD000000'] },
        ],
      },
    })
    const { w } = await mountAt('/apps/cell-lines?tab=datasets')
    expect(w.find('[data-test="studies-heading"]').text()).toBe('Studies in this atlas (3)')
    const rows = w.findAll('[data-test="datasets-table"] tbody tr')
    expect(rows.map((r) => r.find('td').text())).toEqual(['ProCan', 'CCLE', 'NCI60'])
    expect(rows[1].findAll('td').map((td) => td.text())).toEqual(['CCLE', 'MSV000085836, PXD000000', 'TMT', '375', '42'])
    const hrefs = w.findAll('[data-test="datasets-table"] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      'https://www.ebi.ac.uk/pride/archive/projects/PXD030304',
      'https://massive.ucsd.edu/ProteoSAFe/dataset.jsp?accession=MSV000085836',
      'https://www.ebi.ac.uk/pride/archive/projects/PXD000000',
      'https://pubmed.ncbi.nlm.nih.gov/23933261',
    ])
    await w.findAll('[data-test="datasets-table"] th')[0].trigger('click')
    expect(w.findAll('[data-test="datasets-table"] tbody tr')[0].find('td').text()).toBe('CCLE')
  })
})

describe('/apps/coexpression redirect', () => {
  it('redirects to the co-expression tab and keeps the gene', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/apps/coexpression?gene=PSMA1')
    expect(router.currentRoute.value.path).toBe('/apps/cell-lines')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression', gene: 'PSMA1' })
    await router.push('/apps/coexpression?protein=P25786')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression' })
    await router.push('/apps/coexpression')
    expect(router.currentRoute.value.query).toEqual({ tab: 'coexpression' })
  })
})

describe('/cell-lines redirect', () => {
  it('moves old links under /apps and keeps the query', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/cell-lines?tab=line&line=CVCL_0031')
    expect(router.currentRoute.value.path).toBe('/apps/cell-lines')
    expect(router.currentRoute.value.query).toEqual({ tab: 'line', line: 'CVCL_0031' })
  })
})
