import { getCategoryPath, getDescendantCategoryIds } from '@/data/taxonomy'
import type { CatalogQuery, Listing, LocationState, SortMode } from '@/domain/types'
import { listingDistanceKm, matchesLocation } from '@/domain/location'

export function searchListings(listings: Listing[], query: string): Listing[] {
  const words = query.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean)
  if (!words.length) return listings
  return listings.filter((listing) => {
    const categoryTerms = getCategoryPath(listing.categoryId)
      .map((node) => `${node.name} ${(node.searchAliases ?? []).join(' ')}`)
      .join(' ')
    const haystack = `${listing.title} ${listing.description} ${categoryTerms}`.toLocaleLowerCase(
      'ru',
    )
    return words.every((word) => haystack.includes(word))
  })
}

export function filterListings(listings: Listing[], state: CatalogQuery): Listing[] {
  const categoryIds = state.category ? new Set(getDescendantCategoryIds(state.category)) : null
  return listings.filter((listing) => {
    if (categoryIds && !categoryIds.has(listing.categoryId)) return false
    if (state.min !== '' && listing.price < Number(state.min)) return false
    if (state.max !== '' && listing.price > Number(state.max)) return false
    if (state.conditions.length && !state.conditions.includes(listing.condition)) return false
    return matchesLocation(listing, state.location)
  })
}

export function sortListings(
  listings: Listing[],
  sort: SortMode,
  location: LocationState,
): Listing[] {
  const items = [...listings]
  const distance = (item: Listing) => listingDistanceKm(item, location) ?? Infinity
  const recent = (a: Listing, b: Listing) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  switch (sort) {
    case 'distance':
      return items.sort((a, b) => distance(a) - distance(b) || recent(a, b))
    case 'newest':
      return items.sort(recent)
    case 'price-asc':
      return items.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return items.sort((a, b) => b.price - a.price)
    default:
      return items.sort((a, b) => recent(a, b) || distance(a) - distance(b))
  }
}

export function selectListings(listings: Listing[], state: CatalogQuery): Listing[] {
  return sortListings(
    filterListings(searchListings(listings, state.query), state),
    state.sort,
    state.location,
  )
}
