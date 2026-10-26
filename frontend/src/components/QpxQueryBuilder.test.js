// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QpxQueryBuilder from './QpxQueryBuilder.vue'

const views = [
  { name: 'feature', columns: [
    { name: 'sequence', type: 'VARCHAR' },
    { name: 'charge', type: 'INTEGER' },
    { name: 'intensity', type: 'FLOAT' },
    { name: 'modifications', type: 'STRUCT(name VARCHAR)[]' },
  ] },
  { name: 'run', columns: [{ name: 'run_file_name', type: 'VARCHAR' }] },
]

const lastSql = (w) => w.emitted('sql').at(-1)[0]

describe('QpxQueryBuilder', () => {
  it('does not emit until the user changes something', () => {
    expect(mount(QpxQueryBuilder, { props: { views } }).emitted('sql')).toBeUndefined()
  })

  it('writes filters and grouping into the SQL', async () => {
    const w = mount(QpxQueryBuilder, { props: { views } })
    await w.find('[data-test="qb-add-filter"]').trigger('click')
    const filter = w.find('[data-test="qb-filter"]')
    await filter.findAll('select')[0].setValue('charge')
    await filter.findAll('select')[1].setValue('>=')
    await filter.find('input').setValue('2')
    await w.find('[data-test="qb-add-group"]').setValue('charge')
    await w.find('[data-test="qb-order"]').setValue('n')
    expect(lastSql(w)).toBe(
      'SELECT "charge", count(*) AS "n"\nFROM "feature"\nWHERE "charge" >= 2\n'
      + 'GROUP BY "charge"\nORDER BY "n" DESC NULLS LAST\nLIMIT 50',
    )
  })

  it('does not offer nested columns for grouping', () => {
    const w = mount(QpxQueryBuilder, { props: { views } })
    const opts = w.find('[data-test="qb-add-group"]').findAll('option').map((o) => o.text())
    expect(opts).not.toContain('modifications')
  })

  it('resets the query when the table changes', async () => {
    const w = mount(QpxQueryBuilder, { props: { views } })
    await w.find('[data-test="qb-add-column"]').setValue('sequence')
    await w.find('[data-test="qb-table"]').setValue('run')
    expect(lastSql(w)).toBe('SELECT *\nFROM "run"\nLIMIT 50')
  })
})
