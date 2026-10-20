import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  compareParams, compare, presenceState, presenceTooltip, errorMessage, tabFromQuery, listFromQuery, boxStats,
  sortRows, getGene, getDatasets, searchLines, groupDots, kindFromQuery, byParam, rnaVerdict, rnaByDetection,
  detectedScatter, filterPartners, accessionUrl, indigoScale,
} from './cellLines.js'
import { ApiError } from './api.js'

const ok = (b) => ({ ok: true, status: 200, json: async () => b })
beforeEach(() => { global.fetch = vi.fn() })
afterEach(() => { vi.restoreAllMocks() })

describe('compare request building', () => {
  it('builds a lines request from 2 to 5 distinct lines', () => {
    expect(compareParams({ mode: 'lines', lines: ['CVCL_1', 'CVCL_2', 'CVCL_1'] })).toEqual({ lines: 'CVCL_1,CVCL_2' })
    expect(compareParams({ mode: 'lines', lines: ['CVCL_1'] })).toBeNull()
    expect(compareParams({ mode: 'lines', lines: ['a', 'b', 'c', 'd', 'e', 'f'] })).toBeNull()
  })

  it('builds a group request only with a known group and two different values', () => {
    expect(compareParams({ mode: 'groups', group: 'lineage', a: 'Breast', b: 'Lung' })).toEqual({ group: 'lineage', a: 'Breast', b: 'Lung', background: true })
    expect(compareParams({ mode: 'groups', group: 'primary_disease', a: 'NSCLC', b: 'NSCLC' })).toBeNull()
    expect(compareParams({ mode: 'groups', group: 'tissue', a: 'x', b: 'y' })).toBeNull()
    expect(compareParams({ mode: 'groups', group: 'lineage', a: 'Breast' })).toBeNull()
  })

  it('sends the expected query string and skips incomplete selections', async () => {
    global.fetch.mockResolvedValue(ok({ lines: [], genes: [] }))
    await compare({ mode: 'lines', lines: ['CVCL_0000', 'CVCL_0023'] })
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/cell-lines\/compare\?lines=CVCL_0000%2CCVCL_0023$/)
    await compare({ mode: 'groups', group: 'lineage', a: 'Breast', b: 'Lung' })
    expect(global.fetch.mock.calls[1][0]).toMatch(/\/compare\?group=lineage&a=Breast&b=Lung&background=true$/)
    expect(await compare({ mode: 'lines', lines: ['x'] })).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('api wrappers', () => {
  it('encodes the gene path and unwraps search lists', async () => {
    global.fetch.mockResolvedValueOnce(ok({ gene: {} }))
    await getGene('HLA-A/B')
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/cell-lines\/genes\/HLA-A\/B$/)
    global.fetch.mockResolvedValueOnce(ok({ lines: [{ line: 'CVCL_0023' }] }))
    expect(await searchLines('a549')).toEqual([{ line: 'CVCL_0023' }])
    expect(global.fetch.mock.calls[1][0]).toContain('/lines?q=a549')
  })
})

describe('presence classification', () => {
  it('separates ≥2 peptides, detected, not detected and not measured', () => {
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 2, n_studies_present_high: 1 })).toBe('high')
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 1, n_studies_present_high: 0 })).toBe('detected')
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 0, n_studies_present_high: 0 })).toBe('absent')
    expect(presenceState({ n_studies_measured: 0, n_studies_present: 0 })).toBe('unmeasured')
    expect(presenceState(undefined)).toBe('unmeasured')
  })

  it('labels line-level presence as k of N studies that measured it', () => {
    expect(presenceTooltip({ name: 'A549', n_studies_measured: 3, n_studies_present: 2, n_studies_present_high: 1 }))
      .toBe('A549: detected in 2 of 3 studies that measured it (≥2 peptides in 1)')
    expect(presenceTooltip({ line: 'CVCL_1', n_studies_measured: 0 })).toBe('CVCL_1: not measured')
  })
})

describe('messages and query parsing', () => {
  it('maps 503 to the atlas-loading message and 404 to not in the atlas', () => {
    expect(errorMessage(new ApiError('x', 503))).toBe('The atlas is loading, try again shortly.')
    expect(errorMessage(new ApiError('x', 404), 'Gene NOPE')).toBe('Gene NOPE is not in the atlas.')
    expect(errorMessage(new ApiError('x', 0))).toMatch(/unavailable/)
  })

  it('reads the tab and comma lists from the query', () => {
    expect(tabFromQuery({ tab: 'compare' })).toBe('compare')
    expect(tabFromQuery({ tab: 'bogus' })).toBe('protein')
    expect(tabFromQuery({})).toBe('protein')
    expect(listFromQuery('a, b,,a')).toEqual(['a', 'b'])
    expect(listFromQuery(undefined)).toEqual([])
  })
})

describe('summaries', () => {
  it('computes box stats', () => {
    expect(boxStats([0.1, 0.5, 0.9, null])).toMatchObject({ min: 0.1, median: 0.5, max: 0.9, n: 3 })
    expect(boxStats([])).toBeNull()
  })

  it('sorts with nulls last', () => {
    expect(sortRows([{ v: 1 }, { v: null }, { v: 3 }], 'v', 'desc').map((r) => r.v)).toEqual([3, 1, null])
    expect(sortRows([{ v: 'b' }, { v: 'a' }], 'v', 'asc').map((r) => r.v)).toEqual(['a', 'b'])
  })

  it('scales level 4 from light to dark indigo', () => {
    expect(indigoScale(0)).toBe('rgb(224, 231, 255)')
    expect(indigoScale(1)).toBe('rgb(49, 46, 129)')
    expect(indigoScale(null)).toBe('#e2e8f0')
  })
})

describe('group dot plot', () => {
  const m = (n, p, h = 0, plex = 0) => ({ n_studies_measured: n, n_studies_present: p, n_studies_present_high: h, n_studies_plex_identified: plex })
  const lines = [
    { line: 'L1', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.9, ...m(2, 2, 2) },
    { line: 'L2', lineage: 'Lung', primary_disease: 'NSCLC', l4_mean: 0.6, ...m(1, 1) },
    { line: 'L3', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: 0, ...m(1, 0, 0, 1) },
    { line: 'L4', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: 0, ...m(1, 0) },
    { line: 'L5', lineage: 'Lung', primary_disease: 'SCLC', l4_mean: null, ...m(0, 0) },
    { line: 'S1', lineage: 'Skin', primary_disease: 'Melanoma', l4_mean: 0.8, ...m(1, 1) },
    { line: 'S2', lineage: 'Skin', primary_disease: 'Melanoma', l4_mean: 0.7, ...m(1, 1) },
    { line: 'B1', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.95, ...m(1, 1) },
    { line: 'B2', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.85, ...m(1, 1) },
    { line: 'B3', lineage: 'Breast', primary_disease: 'IDC', l4_mean: 0.75, ...m(1, 0) },
  ]

  it('counts detected of measured lines, with TMT plex-only apart and not-measured lines dropped', () => {
    const lung = groupDots(lines, 'lineage').find((r) => r.value === 'Lung')
    expect(lung).toMatchObject({ detected: 2, plex: 1, measured: 4, frac: 0.5 })
    expect(lung.mean_l4).toBeCloseTo(0.375)
    expect(lung.rows.map((r) => r.state)).toEqual(['high', 'detected', 'plex', 'absent'])
  })

  it('sorts by mean level 4 and puts groups under 3 lines last, flagged small', () => {
    const rows = groupDots(lines, 'lineage')
    expect(rows.map((r) => r.value)).toEqual(['Breast', 'Lung', 'Skin'])
    expect(rows.map((r) => r.small)).toEqual([false, false, true])
    expect(groupDots(lines, 'primary_disease').map((r) => r.value)).toEqual(['IDC', 'NSCLC', 'Melanoma', 'SCLC'])
  })

  it('maps the by= URL param to a group kind and back', () => {
    expect(kindFromQuery('disease')).toBe('primary_disease')
    expect(kindFromQuery('lineage')).toBe('lineage')
    expect(kindFromQuery(undefined)).toBe('lineage')
    expect(byParam('primary_disease')).toBe('disease')
    expect(byParam('lineage')).toBe('lineage')
  })
})

describe('RNA reference', () => {
  const agree = (o) => ({ rna_protein_spearman: 0.4, icc: 0.55, flat_rna: false, ...o })

  it('picks the verdict deterministically', () => {
    expect(rnaVerdict(agree({ flat_rna: true, rna_protein_spearman: 0.9, icc: 0.9 })).text)
      .toBe('RNA barely varies across lines (SD < 0.5); correlation is not informative.')
    expect(rnaVerdict(agree({ rna_protein_spearman: 0.5, icc: 0.6 })).text).toBe('Protein tracks mRNA across lines.')
    expect(rnaVerdict(agree({ rna_protein_spearman: 0.1, icc: 0.32 })).text)
      .toBe('Low agreement, but protein reliability is limited (ICC 0.32); likely limited by measurement.')
    expect(rnaVerdict(agree({ rna_protein_spearman: 0.6, icc: 0.4 })).key).toBe('moderate')
    expect(rnaVerdict(agree({ rna_protein_spearman: 0.1, icc: 0.8 })).text).toBe('Moderate / low agreement across lines.')
    expect(rnaVerdict(agree({ rna_protein_spearman: null })).key).toBe('none')
    expect(rnaVerdict(null)).toBeNull()
  })

  const depmap = [
    { line: 'a', name: 'A', lineage: 'Lung', log2_tpm: 5, l4_mean: 0.8, protein_state: 'detected' },
    { line: 'b', name: 'B', lineage: 'Breast', log2_tpm: 0, l4_mean: 1, protein_state: 'detected' },
    { line: 'c', name: 'C', lineage: 'Lung', log2_tpm: 0.5, l4_mean: 0, protein_state: 'absent' },
    { line: 'd', name: 'D', lineage: 'Lung', log2_tpm: 1, l4_mean: 0, protein_state: 'plex' },
    { line: 'e', name: 'E', lineage: 'Lung', log2_tpm: 2, l4_mean: null, protein_state: 'unmeasured' },
    { line: 'f', name: 'F', lineage: 'Lung', log2_tpm: null, l4_mean: 0.5, protein_state: 'detected' },
  ]

  it('groups RNA by protein state', () => {
    const d = rnaByDetection(depmap)
    expect(d.groups.map((g) => [g.id, g.n])).toEqual([['detected', 2], ['plex', 1], ['absent', 1]])
    expect(d.unmeasured).toBe(1)
    expect(d.max).toBe(5)
  })

  it('plots detected lines only, counts the left-out ones and pads the axis', () => {
    const s = detectedScatter(depmap, 'log2_tpm')
    expect(s.n).toBe(2)
    expect(s.excluded).toBe(2)
    expect(s.data.datasets).toHaveLength(1)
    expect(s.data.datasets[0].data.map((p) => p.label)).toEqual(['A', 'B'])
    expect(s.xMin).toBe(0)
    expect(s.xMax).toBeGreaterThan(5)
    const hi = detectedScatter(depmap, 'log2_tpm', { highlight: 'Lung' })
    expect(hi.data.datasets.map((d) => [d.label, d.data.length])).toEqual([['Lung', 1], ['detected lines', 1]])
    const hpa = detectedScatter([{ line: 'x', ntpm: 3, l4_mean: 0.2 }, { line: 'y', ntpm: 3, l4_mean: 0 }], 'ntpm',
      { transform: (v) => Math.log2(v + 1), isDetected: (r) => r.line === 'x' })
    expect(hpa.data.datasets[0].data).toEqual([{ x: 2, y: 0.2, label: 'x', lineage: 'unmapped' }])
    expect(hpa.excluded).toBe(1)
  })
})

describe('co-expression partners', () => {
  const partners = [
    { partner: 'A', z: 8, validated: true, shared_complexes: ['26S proteasome'] },
    { partner: 'B', z: 6, validated: true, shared_complexes: [] },
    { partner: 'C', z: 4, validated: false, shared_complexes: ['26S proteasome'] },
    { partner: 'D', z: -3, validated: false, shared_complexes: [] },
  ]

  it('filters all, beyond shared complexes and validated only', () => {
    expect(filterPartners(partners, 'all').map((p) => p.partner)).toEqual(['A', 'B', 'C', 'D'])
    expect(filterPartners(partners, 'beyond').map((p) => p.partner)).toEqual(['B', 'D'])
    expect(filterPartners(partners, 'validated').map((p) => p.partner)).toEqual(['A', 'B'])
    expect(filterPartners(undefined, 'all')).toEqual([])
  })
})

describe('atlas studies', () => {
  it('links PXD, MSV and PMID accessions', () => {
    expect(accessionUrl('PXD030304')).toBe('https://www.ebi.ac.uk/pride/archive/projects/PXD030304')
    expect(accessionUrl('MSV000085836')).toBe('https://massive.ucsd.edu/ProteoSAFe/dataset.jsp?accession=MSV000085836')
    expect(accessionUrl('PMID23933261')).toBe('https://pubmed.ncbi.nlm.nih.gov/23933261')
    expect(accessionUrl('ProCan')).toBe('')
  })

  it('unwraps the studies list', async () => {
    global.fetch.mockResolvedValueOnce(ok({ studies: [{ study: 'S1' }] }))
    expect(await getDatasets()).toEqual([{ study: 'S1' }])
  })
})

describe('TMT plex-level presence', () => {
  it('classifies lines seen only in TMT as plex-only, not detected', () => {
    expect(presenceState({ n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 })).toBe('plex')
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 1, n_studies_present_high: 0, n_studies_plex_identified: 1 })).toBe('detected')
    const rows = groupDots([{ line: 'a', lineage: 'Lung', l4_mean: 0, n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 }])
    expect(rows[0]).toMatchObject({ detected: 0, plex: 1, measured: 1, frac: 0 })
  })
})
