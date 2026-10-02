import { seedListings } from '@/data/seed'
import {
  CITY_LOCATIONS,
  createLocationCell,
  formatApproximateDistance,
  formatListingLocation,
  matchesLocation,
  normalizeLocationState,
} from '@/domain/location'

describe('location domain', () => {
  it('normalizes the city radius to the supported range and step', () => {
    expect(normalizeLocationState({ cityId: 'tomsk', radius: 5 }).radiusKm).toBe(10)
    expect(normalizeLocationState({ cityId: 'tomsk', radius: 46 }).radiusKm).toBe(50)
    expect(normalizeLocationState({ cityId: 'tomsk', radius: 999 }).radiusKm).toBe(300)
  })

  it('keeps rounded listing cells and formats the public address', () => {
    const cell = createLocationCell(56.588234, 84.951234, 'tomsk')
    expect(cell).toEqual({
      id: expect.stringContaining('tomsk-cell-'),
      centerLat: expect.any(Number),
      centerLng: expect.any(Number),
    })
    expect(cell).not.toHaveProperty('latitude')
    expect(cell).not.toHaveProperty('longitude')

    const listing = seedListings[0]!
    const label = formatListingLocation(
      listing,
      normalizeLocationState({ cityId: 'tomsk', radius: 50 }),
    )
    expect(label).toContain(listing.address)
    expect(formatApproximateDistance(8.2)).toBe(
      new Intl.NumberFormat('ru-RU', {
        style: 'unit',
        unit: 'kilometer',
        unitDisplay: 'short',
        maximumFractionDigits: 0,
      }).format(8),
    )
  })

  it('filters listings by distance from the selected city center', () => {
    const seversk = CITY_LOCATIONS.seversk!
    const listing = {
      ...seedListings[0]!,
      cityId: seversk.id,
      city: seversk.name,
      locationCell: createLocationCell(seversk.centerLat, seversk.centerLng, seversk.id),
    }

    expect(matchesLocation(listing, normalizeLocationState({ cityId: 'tomsk', radius: 10 }))).toBe(
      false,
    )
    expect(matchesLocation(listing, normalizeLocationState({ cityId: 'tomsk', radius: 30 }))).toBe(
      true,
    )
  })
})
