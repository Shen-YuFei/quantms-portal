import { describe, it, expect } from 'vitest'
import { buildSql, opsFor, typeClass, quoteIdent } from './qpxQueryBuilder.js'

const TYPES = {
  sequence: 'VARCHAR',
  charge: 'INTEGER',
  peptide_qvalue: 'DOUBLE',
  intensity: 'FLOAT',
  is_decoy: 'BOOLEAN',
  modifications: 'STRUCT(name VARCHAR)[]',
}

describe('typeClass / opsFor', () => {
  it('classifies DuckDB types', () => {
    expect(typeClass('BIGINT')).toBe('number')
    expect(typeClass('DECIMAL(10,2)')).toBe('number')
    expect(typeClass('VARCHAR')).toBe('text')
    expect(typeClass('BOOLEAN')).toBe('bool')
    expect(typeClass('VARCHAR[]')).toBe('other')
    expect(typeClass('STRUCT(a INTEGER)')).toBe('other')
  })
  it('offers only null checks on nested columns', () => {
    expect(opsFor('STRUCT(name VARCHAR)[]')).toEqual(['is null', 'is not null'])
  })
})

describe('buildSql', () => {
  it('selects all columns by default', () => {
    expect(buildSql({ table: 'feature' }, TYPES).sql).toBe('SELECT *\nFROM "feature"\nLIMIT 50')
  })

  it('builds filters, sort and limit', () => {
    const { sql, problems } = buildSql({
      table: 'feature',
      columns: ['sequence', 'charge'],
      filters: [
        { column: 'peptide_qvalue', op: '<=', value: '0.01' },
        { column: 'is_decoy', op: 'is false' },
        { column: 'sequence', op: 'starts with', value: 'PEP' },
      ],
      orderBy: { column: 'charge', dir: 'asc' },
      limit: 20,
    }, TYPES)
    expect(problems).toEqual([])
    expect(sql).toBe(
      'SELECT "sequence", "charge"\nFROM "feature"\n'
      + 'WHERE "peptide_qvalue" <= 0.01\n  AND "is_decoy" IS FALSE\n  AND "sequence" ILIKE \'PEP%\' ESCAPE \'\\\'\n'
      + 'ORDER BY "charge" ASC NULLS LAST\nLIMIT 20',
    )
  })

  it('groups with count and other aggregates', () => {
    const { sql } = buildSql({
      table: 'feature',
      groupBy: ['charge'],
      aggregates: [{ fn: 'count' }, { fn: 'avg', column: 'intensity' }],
      orderBy: { column: 'n', dir: 'desc' },
    }, TYPES)
    expect(sql).toBe(
      'SELECT "charge", count(*) AS "n", avg("intensity") AS "avg_intensity"\nFROM "feature"\n'
      + 'GROUP BY "charge"\nORDER BY "n" DESC NULLS LAST\nLIMIT 50',
    )
  })

  it('defaults to count(*) when grouping without aggregates', () => {
    expect(buildSql({ table: 'pg', groupBy: ['charge'] }, TYPES).sql).toContain('count(*) AS "n"')
  })

  it('escapes quotes and LIKE wildcards in values', () => {
    const { sql } = buildSql({ table: 'feature', filters: [
      { column: 'sequence', op: '=', value: "x' OR 1=1 --" },
      { column: 'sequence', op: 'contains', value: '50%_a' },
    ] }, TYPES)
    expect(sql).toContain('"sequence" = \'x\'\' OR 1=1 --\'')
    expect(sql).toContain("ILIKE '%50\\%\\_a%'")
  })

  it('quotes identifiers', () => {
    expect(quoteIdent('a"b')).toBe('"a""b"')
  })

  it('drops and reports invalid filters', () => {
    const { sql, problems } = buildSql({ table: 'feature', filters: [
      { column: 'charge', op: '>', value: '2; DROP' },
      { column: 'charge', op: '>', value: '' },
      { column: 'modifications', op: '=', value: 'x' },
      { column: 'nope', op: '=', value: '1' },
    ] }, TYPES)
    expect(sql).not.toContain('WHERE')
    expect(problems).toHaveLength(4)
  })

  it('ignores unknown columns, non-numeric aggregates and an order outside the output', () => {
    const { sql } = buildSql({
      table: 'feature',
      columns: ['sequence', 'evil"col'],
      aggregates: [],
      orderBy: { column: 'charge', dir: 'desc' },
    }, TYPES)
    expect(sql).toBe('SELECT "sequence"\nFROM "feature"\nLIMIT 50')
    const bad = buildSql({ table: 'feature', aggregates: [{ fn: 'sum', column: 'sequence' }] }, TYPES)
    expect(bad.sql).not.toContain('sum(')
    expect(bad.problems).toEqual(['sum(sequence) needs a numeric column'])
  })

  it('clamps the limit', () => {
    expect(buildSql({ table: 'feature', limit: 999999 }, TYPES).sql).toContain('LIMIT 2000')
    expect(buildSql({ table: 'feature', limit: -3 }, TYPES).sql).toContain('LIMIT 1')
  })
})
