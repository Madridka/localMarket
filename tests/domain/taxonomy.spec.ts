import {
  getCategoryAttributes,
  getCategoryPath,
  getDescendantCategoryIds,
  isLeafCategory,
  searchCategories,
} from '@/data/taxonomy'

describe('taxonomy', () => {
  it('keeps deep category paths and descendants', () => {
    const path = getCategoryPath('kitchen-chairs').map((item) => item.id)

    expect(path).toContain('home')
    expect(path.at(-1)).toBe('kitchen-chairs')
    expect(getDescendantCategoryIds('kitchen')).toContain('kitchen-chairs')
    expect(isLeafCategory('kitchen-chairs')).toBe(true)
    expect(isLeafCategory('kitchen')).toBe(false)
  })

  it('inherits attributes and searches by aliases', () => {
    expect(getCategoryAttributes('ram-ddr5').length).toBeGreaterThanOrEqual(4)
    expect(searchCategories('оперативка').map((item) => item.id)).toContain('ram')
  })
})
