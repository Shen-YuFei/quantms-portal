// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MethodsTab from './MethodsTab.vue'

const manifest = {
  atlas: 'v3.5',
  decisions: {
    MIN_GROUP_LINES: { value: 3, decision: 'DR-016', title: 'Group views', version: '0.1', status: 'draft', file: 'DR-016-group-views.md' },
    SERUM_GENES: { value: ['HBA1', 'HBB'], decision: 'DR-017', version: '0.1', status: 'draft', file: null },
  },
}

describe('MethodsTab decisions', () => {
  const w = mount(MethodsTab, { props: { manifest } })
  const list = w.find('[data-test="decisions"]')
  it('shows a titled decision and a bare one', () => {
    expect(list.text()).toContain('DR-016 — Group views')
    expect(list.text()).toContain('DR-017:')
    expect(list.text()).not.toContain('DR-017 —')
  })
  it('shows list values as a count', () => {
    expect(list.text()).toContain('SERUM_GENES = 2 entries')
    expect(list.text()).not.toContain('HBA1')
  })
  it('marks the heading as draft and renders no links', () => {
    expect(w.text()).toContain('Decisions applied (draft)')
    expect(list.find('a').exists()).toBe(false)
  })
})
