import { seedListings } from '@/data/seed'
import { filterListings, searchListings, sortListings } from '@/domain/catalog'
import { normalizeLocationState } from '@/domain/location'
import type { CatalogQuery } from '@/domain/types'

const base: CatalogQuery = {
  query: '',
  category: '',
  min: '',
  max: '',
  conditions: [],
  location: normalizeLocationState({ cityId: 'tomsk', radius: 50 }),
  sort: 'recommended',
}

describe('catalog domain', () => {
  it('searches listing text and category aliases', () => {
    expect(searchListings(seedListings, 'Lightning')).toHaveLength(4)
    expect(searchListings(seedListings, 'оперативка').length).toBeGreaterThan(0)
  })

  it('includes descendants when filtering a parent category', () => {
    const home = filterListings(seedListings, { ...base, category: 'home' })
    const leaf = filterListings(seedListings, { ...base, category: 'kitchen-chairs' })

    expect(home.length).toBeGreaterThan(leaf.length)
    expect(leaf).toHaveLength(1)
  })

  it('sorts by numeric price without mutating input', () => {
    const source = seedListings.slice(0, 5)
    const sorted = sortListings(source, 'price-asc', base.location)

    expect(sorted[0]!.price).toBeLessThanOrEqual(sorted.at(-1)!.price)
    expect(source).not.toBe(sorted)
  })
})
