import { locations } from './data.js';

export const CITY_LOCATIONS = Object.freeze(Object.fromEntries(
  Object.entries(locations).map(([id, value]) => [id, Object.freeze({ id, ...value })]),
));
export const RADIUS_OPTIONS = Object.freeze([5, 10, 25, 50, 100, 200]);

const DEFAULT_CITY = 'tomsk';
const DEFAULT_RADIUS = 25;
const CITY_STORAGE_KEY = 'locationCity';
const RADIUS_STORAGE_KEY = 'locationRadius';
const LEGACY_STORAGE_KEYS = ['ryadom.location.v1', 'ryadom.location.v2'];
let currentLocation = null;

function coordinate(value, limit) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric) <= limit ? numeric : null;
}

function pointFrom(value) {
  if (!value || typeof value !== 'object') return null;
  const latitude = coordinate(value.centerLat ?? value.latitude ?? value.lat, 90);
  const longitude = coordinate(value.centerLng ?? value.longitude ?? value.lng ?? value.lon, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

export function getCityLocation(value) {
  const key = String(value || '').trim().toLowerCase();
  return CITY_LOCATIONS[key] || Object.values(CITY_LOCATIONS).find((city) => city.name.toLowerCase() === key) || null;
}

export function createLocationCell(latitude, longitude, cityId = DEFAULT_CITY) {
  const point = pointFrom({ latitude, longitude });
  if (!point) return null;
  const latStep = 0.006;
  const lngStep = 0.01;
  const latIndex = Math.round(point.latitude / latStep);
  const lngIndex = Math.round(point.longitude / lngStep);
  return {
    id: `${cityId}-cell-${latIndex}-${lngIndex}`,
    centerLat: Number((latIndex * latStep).toFixed(3)),
    centerLng: Number((lngIndex * lngStep).toFixed(3)),
  };
}

export function calculateDistance(latitude1, longitude1, latitude2, longitude2) {
  const first = pointFrom({ latitude: latitude1, longitude: longitude1 });
  const second = pointFrom({ latitude: latitude2, longitude: longitude2 });
  if (!first || !second) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latDelta = radians(second.latitude - first.latitude);
  const lonDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeRadius(value) {
  const radius = Number(value);
  return RADIUS_OPTIONS.includes(radius) ? radius : DEFAULT_RADIUS;
}

export function normalizeLocationState(input = {}) {
  const source = input instanceof URLSearchParams ? Object.fromEntries(input) : input || {};
  const city = getCityLocation(source.city ?? source.cityId ?? source.selectedCity) || CITY_LOCATIONS[DEFAULT_CITY];
  return { city: city.id, radius: normalizeRadius(source.radius) };
}

function readSelection() {
  try {
    return {
      city: localStorage.getItem(CITY_STORAGE_KEY) || DEFAULT_CITY,
      radius: localStorage.getItem(RADIUS_STORAGE_KEY) || DEFAULT_RADIUS,
    };
  } catch {
    return { city: DEFAULT_CITY, radius: DEFAULT_RADIUS };
  }
}

export function getCurrentLocation() {
  if (currentLocation) return { ...currentLocation };
  const stored = readSelection();
  const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
  currentLocation = normalizeLocationState({
    city: params.get('city') || stored.city,
    radius: params.get('radius') || stored.radius,
  });
  return { ...currentLocation };
}

export function setCurrentLocation(input) {
  currentLocation = normalizeLocationState(input);
  try {
    localStorage.setItem(CITY_STORAGE_KEY, CITY_LOCATIONS[currentLocation.city].name);
    localStorage.setItem(RADIUS_STORAGE_KEY, String(currentLocation.radius));
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch { /* Browsing still works when storage is unavailable. */ }
  return { ...currentLocation };
}

export function getDistanceOrigin(input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  const city = CITY_LOCATIONS[state.city];
  return { latitude: city.centerLat, longitude: city.centerLng, city: city.id };
}

export function listingDistanceKm(listing, input = getCurrentLocation()) {
  const listingCity = getCityLocation(listing?.cityId || listing?.city);
  const listingPoint = pointFrom(listing?.locationCell) || (listingCity
    ? { latitude: listingCity.centerLat, longitude: listingCity.centerLng }
    : null);
  if (!listingPoint) return null;
  const origin = getDistanceOrigin(input);
  return calculateDistance(origin.latitude, origin.longitude, listingPoint.latitude, listingPoint.longitude);
}

export function matchesLocation(listing, input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  const distance = listingDistanceKm(listing, state);
  return distance !== null && distance <= state.radius;
}

export function formatListingLocation(listing) {
  const city = getCityLocation(listing?.cityId || listing?.city);
  return listing?.publicAreaName || city?.name || 'Местоположение не указано';
}

export function locationTitle(input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  const city = CITY_LOCATIONS[state.city];
  return `Объявления в радиусе ${state.radius} км от ${city.genitive || city.name}`;
}

export function locationIntro() { return ''; }
export function distanceSortLabel() { return 'Сначала ближайшие'; }
