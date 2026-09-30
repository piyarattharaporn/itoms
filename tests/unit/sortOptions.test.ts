import { describe, expect, it } from 'vitest'
import { sortByLabel } from '../../src/lib/sortOptions'

describe('sortByLabel', () => {
  it('sorts a copy by the visible label without mutating the source', () => {
    const source = [
      { value: 'b', label: 'Beta' },
      { value: 'a', label: 'Alpha' },
    ]

    expect(sortByLabel(source, (item) => item.label).map((item) => item.value)).toEqual(['a', 'b'])
    expect(source.map((item) => item.value)).toEqual(['b', 'a'])
  })
})
