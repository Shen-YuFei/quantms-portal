// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QxTable from './QxTable.vue'

const firstCol = (w) => w.findAll('tbody tr').map((r) => r.find('td').text())

describe('QxTable', () => {
  it('sorts client-side naturally and toggles direction', async () => {
    const w = mount(QxTable, { props: { columns: ['sample', 'n'], rows: [['S-10', 1], ['S-2', 3], ['S-1', 2]] } })
    const [sampleTh, nTh] = w.findAll('th button')
    await sampleTh.trigger('click')
    expect(firstCol(w)).toEqual(['S-1', 'S-2', 'S-10'])
    await sampleTh.trigger('click')
    expect(firstCol(w)).toEqual(['S-10', 'S-2', 'S-1'])
    await nTh.trigger('click') // numbers start descending
    expect(firstCol(w)).toEqual(['S-2', 'S-1', 'S-10'])
  })

  it('emits sort and keeps row order in server mode', async () => {
    const rows = [['B', 1], ['A', 2]]
    const w = mount(QxTable, { props: { columns: ['p', 'q'], rows, serverSort: true } })
    await w.findAll('th button')[0].trigger('click')
    expect(w.emitted('sort')[0][0]).toEqual({ key: 'p', dir: 'asc' })
    expect(firstCol(w)).toEqual(['B', 'A'])
  })

  it('right-aligns numeric columns and formats composite cells', () => {
    const w = mount(QxTable, { props: { columns: ['p', 'counts'], rows: [['P1', { unique_sequences: 3 }]] } })
    expect(w.findAll('td')[1].text()).toBe('unique sequences 3')
    const n = mount(QxTable, { props: { columns: ['p', 'n'], rows: [['P1', 5]] } })
    expect(n.findAll('td')[1].classes()).toContain('qt-num')
    expect(n.findAll('td')[0].classes()).toContain('qt-text')
  })

  it('shows loading, empty and error states', () => {
    expect(mount(QxTable, { props: { columns: ['a'], rows: [], loading: true } }).text()).toContain('Loading…')
    expect(mount(QxTable, { props: { columns: ['a'], rows: [], emptyText: 'Nothing here.' } }).text()).toContain('Nothing here.')
    expect(mount(QxTable, { props: { columns: ['a'], rows: [], error: 'boom' } }).text()).toContain('boom')
    const busy = mount(QxTable, { props: { columns: ['a'], rows: [['x']], loading: true } })
    expect(busy.find('.qt-badge').exists()).toBe(true)
  })
})
