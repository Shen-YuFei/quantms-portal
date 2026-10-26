import { describe, it, expect } from 'vitest'
import { colLabel, compareValues, formatCell, isNumericColumn } from './qpxFormat.js'

const t = (v, k) => formatCell(v, k).text

describe('formatCell', () => {
  it('formats numbers by kind', () => {
    expect(t(8.45e-5, 'global_qvalue')).toBe('8.45e-5')
    expect(t(0.0136, 'peptide_qvalue')).toBe('0.0136')
    expect(t(98.71244, 'sequence_coverage')).toBe('98.7%')
    expect(t(2708401408, 'intensity')).toBe((2708401408).toLocaleString())
    expect(t(512.30001, 'observed_mz')).toBe('512.3')
    expect(t(0.0001234, 'mass_error_ppm')).toBe('1.23e-4')
  })
  it('summarizes structs and lists', () => {
    expect(t({ unique_sequences: 74, total_sequences: 89 })).toBe('unique sequences 74 · total sequences 89')
    expect(t([{ name: 'Oxidation', accession: 'UNIMOD:35' }, { name: 'TMT6plex' }])).toBe('Oxidation, TMT6plex')
    expect(t(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a, b, c, d +2 more')
    expect(formatCell(['a', 'b', 'c', 'd', 'e']).title).toBe('a, b, c, d, e')
    expect(t([514])).toBe('514')
    expect(t([27829], 'scan')).toBe('27829')
    expect(t(27829, 'n_psms')).toBe((27829).toLocaleString())
  })
  it('renders empty values as a dash and booleans as words', () => {
    expect(t(null)).toBe('—')
    expect(t([])).toBe('—')
    expect(t(false)).toBe('no')
  })
})

describe('sorting helpers', () => {
  it('sorts text naturally and puts empty values last', () => {
    const v = ['Sample-10', null, 'Sample-2', 'Sample-1']
    expect(v.slice().sort(compareValues)).toEqual(['Sample-1', 'Sample-2', 'Sample-10', null])
  })
  it('detects numeric columns', () => {
    expect(isNumericColumn([1, null, 2.5])).toBe(true)
    expect(isNumericColumn([1, 'x'])).toBe(false)
    expect(isNumericColumn([null])).toBe(false)
  })
  it('labels known columns', () => {
    expect(colLabel('posterior_error_probability')).toBe('PEP')
    expect(colLabel('cell_line')).toBe('cell line')
  })
})
