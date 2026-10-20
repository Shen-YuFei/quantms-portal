import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  compareParams, compare, presenceState, presenceByGroup, presenceTooltip, errorMessage, tabFromQuery,
  listFromQuery, abundanceByGroup, boxStats, catalogueRows, liveCollections, accessionRoute, sortRows,
  getGene, searchLines, rnaScatter,
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
    expect(compareParams({ mode: 'groups', group: 'lineage', a: 'Breast', b: 'Lung' })).toEqual({ group: 'lineage', a: 'Breast', b: 'Lung' })
    expect(compareParams({ mode: 'groups', group: 'primary_disease', a: 'NSCLC', b: 'NSCLC' })).toBeNull()
    expect(compareParams({ mode: 'groups', group: 'tissue', a: 'x', b: 'y' })).toBeNull()
    expect(compareParams({ mode: 'groups', group: 'lineage', a: 'Breast' })).toBeNull()
  })

  it('sends the expected query string and skips incomplete selections', async () => {
    global.fetch.mockResolvedValue(ok({ lines: [], genes: [] }))
    await compare({ mode: 'lines', lines: ['CVCL_0000', 'CVCL_0023'] })
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/cell-lines\/compare\?lines=CVCL_0000%2CCVCL_0023$/)
    await compare({ mode: 'groups', group: 'lineage', a: 'Breast', b: 'Lung' })
    expect(global.fetch.mock.calls[1][0]).toMatch(/\/compare\?group=lineage&a=Breast&b=Lung$/)
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

  it('counts atlas lines missing from the gene response as not measured', () => {
    const lines = [
      { line: 'L1', lineage: 'Lung', n_studies_measured: 2, n_studies_present: 2, n_studies_present_high: 2 },
      { line: 'L2', lineage: 'Lung', n_studies_measured: 1, n_studies_present: 1, n_studies_present_high: 0 },
      { line: 'L3', lineage: 'Lung', n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0 },
      { line: 'L4', lineage: 'Lung', n_studies_measured: 0, n_studies_present: 0, n_studies_present_high: 0 },
      { line: 'B1', lineage: 'Breast', n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0 },
    ]
    const groups = [
      { group: 'lineage', value: 'Lung', n_lines: 6 },
      { group: 'lineage', value: 'Breast', n_lines: 2 },
      { group: 'lineage', value: 'Skin', n_lines: 3 },
      { group: 'primary_disease', value: 'NSCLC', n_lines: 6 },
    ]
    const rows = Object.fromEntries(presenceByGroup(lines, groups, 'lineage').map((r) => [r.value, r]))
    expect(rows.Lung.counts).toEqual({ high: 1, detected: 1, plex: 0, absent: 1, unmeasured: 3 })
    expect(rows.Lung.total).toBe(6)
    expect(rows.Lung.lines.map((l) => l.line)).toEqual(['L1', 'L2', 'L3'])
    expect(rows.Breast.counts).toEqual({ high: 0, detected: 0, plex: 0, absent: 1, unmeasured: 1 })
    expect(rows.Skin.counts.unmeasured).toBe(3)
    expect(Object.keys(rows)).not.toContain('NSCLC')
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
  it('computes box stats and joins the group summary', () => {
    expect(boxStats([0.1, 0.5, 0.9, null])).toMatchObject({ min: 0.1, median: 0.5, max: 0.9, n: 3 })
    expect(boxStats([])).toBeNull()
    const lines = [
      { line: 'a', lineage: 'Lung', l4_mean: 0.2 }, { line: 'b', lineage: 'Lung', l4_mean: 0.4 },
      { line: 'c', lineage: 'Breast', l4_mean: 0.9 }, { line: 'd', lineage: 'Breast', l4_mean: null },
    ]
    const groups = [{ group: 'lineage', group_value: 'Lung', mean_l4: 0.3, n_lines: 2, frac_present: 1 }]
    const out = abundanceByGroup(lines, groups, 'lineage')
    expect(out.map((r) => r.value)).toEqual(['Breast', 'Lung'])
    expect(out[1]).toMatchObject({ mean_l4: 0.3, n_lines: 2, frac_present: 1 })
    expect(out[0].rows).toHaveLength(1)
  })

  it('builds per-lineage RNA scatter datasets, skipping missing values', () => {
    const s = rnaScatter([
      { line: 'a', lineage: 'Lung', log2_tpm: 3, l4_mean: 0.5 },
      { line: 'b', lineage: 'Lung', log2_tpm: null, l4_mean: 0.5 },
      { line: 'c', lineage: 'Breast', log2_tpm: 1, l4_mean: null },
    ], 'log2_tpm')
    expect(s.n).toBe(1)
    expect(s.data.datasets.map((d) => d.label)).toEqual(['Lung'])
  })

  it('resolves catalogue status and dataset links', () => {
    const cat = {
      datasets: [{ accession: 'PXD1', live: 0 }, { accession: 'PXD2', live: 1, portal_collection: 'absolute-expression' }],
      live_status: { live: [{ accession: 'PXD1', portal_collection: 'differential-expression' }] },
    }
    expect(catalogueRows(cat).map((r) => r.status)).toEqual(['live', 'live'])
    const live = liveCollections(cat)
    expect(accessionRoute('PXD1', live)).toBe('/collections/differential-expression/PXD1')
    expect(accessionRoute('MSV000085836', live)).toBe('/apps/dataset-search?q=MSV000085836')
    expect(accessionRoute('PMID23933261', live)).toBe('')
  })

  it('sorts with nulls last', () => {
    expect(sortRows([{ v: 1 }, { v: null }, { v: 3 }], 'v', 'desc').map((r) => r.v)).toEqual([3, 1, null])
    expect(sortRows([{ v: 'b' }, { v: 'a' }], 'v', 'asc').map((r) => r.v)).toEqual(['a', 'b'])
  })
})

describe('TMT plex-level presence', () => {
  it('classifies lines seen only in TMT as plex-only, not detected', () => {
    expect(presenceState({ n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 })).toBe('plex')
    expect(presenceState({ n_studies_measured: 2, n_studies_present: 1, n_studies_present_high: 0, n_studies_plex_identified: 1 })).toBe('detected')
    const rows = presenceByGroup(
      [{ line: 'a', lineage: 'Lung', n_studies_measured: 1, n_studies_present: 0, n_studies_present_high: 0, n_studies_plex_identified: 1 }],
      [{ group: 'lineage', value: 'Lung', n_lines: 2 }])
    expect(rows[0].counts).toEqual({ high: 0, detected: 0, plex: 1, absent: 0, unmeasured: 1 })
  })
})
