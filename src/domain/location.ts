import { locations } from '@/data/seed'
import { DEFAULT_CITY_ID } from '@/domain/constants'
import type { City, Listing, LocationCell, LocationState } from '@/domain/types'

export const MIN_RADIUS_KM = 10
export const MAX_RADIUS_KM = 300
export const DEFAULT_RADIUS_KM = 50

export const CITY_LOCATIONS: Readonly<Record<string, City>> = Object.freeze(
  Object.fromEntries(
    Object.entries(locations).map(([id, value]) => [id, Object.freeze({ id, ...value })]),
  ),
)

function coordinate(value: unknown, limit: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && Math.abs(numeric) <= limit ? numeric : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function pointFrom(value: unknown): { latitude: number; longitude: number } | null {
  const source = asRecord(value)
  const latitude = coordinate(source.centerLat ?? source.latitude ?? source.lat, 90)
  const longitude = coordinate(
    source.centerLng ?? source.longitude ?? source.lng ?? source.lon,
    180,
  )
  return latitude === null || longitude === null ? null : { latitude, longitude }
}

function normalizeRadius(value: unknown): number {
  if (value === null || value === undefined || value === '') return DEFAULT_RADIUS_KM
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_RADIUS_KM
  const stepped = Math.round(numeric / 10) * 10
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, stepped))
}

export function getCityLocation(value: unknown): City | null {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
  return (
    CITY_LOCATIONS[key] ??
    Object.values(CITY_LOCATIONS).find((city) => city.name.toLowerCase() === key) ??
    null
  )
}

export function createLocationCell(
  latitude: unknown,
  longitude: unknown,
  cityId = DEFAULT_CITY_ID,
): LocationCell | null {
  const point = pointFrom({ latitude, longitude })
  if (!point) return null
  const latStep = 0.006
  const lngStep = 0.01
  const latIndex = Math.round(point.latitude / latStep)
  const lngIndex = Math.round(point.longitude / lngStep)
  return {
    id: `${cityId}-cell-${latIndex}-${lngIndex}`,
    centerLat: Number((latIndex * latStep).toFixed(3)),
    centerLng: Number((lngIndex * lngStep).toFixed(3)),
  }
}

export function normalizeLocationState(input: unknown = {}): LocationState {
  const source =
    input instanceof URLSearchParams ? Object.fromEntries(input.entries()) : asRecord(input)
  const city =
    getCityLocation(source.cityId ?? source.city ?? source.selectedCity) ??
    CITY_LOCATIONS[DEFAULT_CITY_ID]!
  return {
    cityId: city.id,
    city: city.name,
    radiusKm: normalizeRadius(source.radiusKm ?? source.radius),
  }
}

export function calculateDistance(
  latitude1: unknown,
  longitude1: unknown,
  latitude2: unknown,
  longitude2: unknown,
): number | null {
  const first = pointFrom({ latitude: latitude1, longitude: longitude1 })
  const second = pointFrom({ latitude: latitude2, longitude: longitude2 })
  if (!first || !second) return null
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const latDelta = radians(second.latitude - first.latitude)
  const lonDelta = radians(second.longitude - first.longitude)
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(lonDelta / 2) ** 2
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function listingDistanceKm(listing: Listing, input: LocationState): number | null {
  const state = normalizeLocationState(input)
  const city = CITY_LOCATIONS[state.cityId]!
  const listingPoint = pointFrom(listing.locationCell)
  if (!listingPoint) return listing.cityId === state.cityId ? 0 : null
  return calculateDistance(
    city.centerLat,
    city.centerLng,
    listingPoint.latitude,
    listingPoint.longitude,
  )
}

export function matchesLocation(listing: Listing, input: LocationState): boolean {
  const state = normalizeLocationState(input)
  const distance = listingDistanceKm(listing, state)
  return distance !== null && distance <= state.radiusKm
}

export function formatApproximateDistance(distanceKm: unknown): string {
  const km = Number(distanceKm)
  if (!Number.isFinite(km) || km < 0) return ''
  const formatter = new Intl.NumberFormat('ru-RU', {
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  })
  if (km < 1) return `< ${formatter.format(1)}`
  return formatter.format(Math.round(km))
}

export function formatListingLocation(listing: Listing, input: LocationState): string {
  const city = getCityLocation(listing.cityId || listing.city)
  const place = [city?.name ?? listing.city, listing.address].filter(Boolean).join(', ')
  const distance = formatApproximateDistance(listingDistanceKm(listing, input))
  return distance ? `${place} · ${distance}` : place
}
