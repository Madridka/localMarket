import { locationAreas, locations } from './data.js';

export const CITY_LOCATIONS = Object.freeze(Object.fromEntries(
  Object.entries(locations).map(([id, value]) => [id, Object.freeze({ id, ...value })]),
));
export const LOCATION_AREAS = Object.freeze(locationAreas);
export const MIN_NEARBY_RESULTS = 12;
export const IDEAL_NEARBY_RESULTS = 24;

const DEFAULT_CITY_ID = 'tomsk';
const STORAGE_KEY = 'ryadom.location.v2';
const LEGACY_STORAGE_KEY = 'ryadom.location.v1';
const VALID_MODES = new Set(['city', 'nearby', 'manual']);
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

export function getCityAreas(cityId) { return LOCATION_AREAS[cityId] || []; }
export function getAreaLocation(cityId, areaId) { return getCityAreas(cityId).find((area) => area.id === areaId) || null; }

export function createLocationCell(latitude, longitude, cityId = DEFAULT_CITY_ID) {
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

function cellFrom(value, cityId = DEFAULT_CITY_ID) {
  const point = pointFrom(value);
  return point ? createLocationCell(point.latitude, point.longitude, cityId) : null;
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

export function findNearestArea(cityId, cell) {
  const point = pointFrom(cell);
  if (!point) return null;
  return getCityAreas(cityId)
    .map((area) => ({ area, distance: calculateDistance(point.latitude, point.longitude, area.centerLat, area.centerLng) }))
    .sort((a, b) => a.distance - b.distance)[0]?.area || null;
}

export function normalizeLocationState(input = {}) {
  const source = input instanceof URLSearchParams ? Object.fromEntries(input) : input || {};
  const city = getCityLocation(source.cityId || source.city || source.selectedCity) || CITY_LOCATIONS[DEFAULT_CITY_ID];
  const selectedAreaId = source.selectedAreaId || source.area || null;
  const area = getAreaLocation(city.id, selectedAreaId);
  const requestedMode = source.mode || source.locationMode || source.location || 'city';
  const locationCell = cellFrom(source.locationCell || source.cell, city.id);
  let mode = VALID_MODES.has(requestedMode) ? requestedMode : 'city';
  if (mode === 'nearby' && !locationCell) mode = 'city';
  if (mode === 'manual' && !area) mode = 'city';
  return {
    cityId: city.id,
    city: city.name,
    mode,
    locationCell: mode === 'manual' ? createLocationCell(area.centerLat, area.centerLng, city.id) : locationCell,
    selectedAreaId: mode === 'manual' ? area.id : null,
  };
}

function readSelection() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
}

export function getCurrentLocation() {
  if (currentLocation) return { ...currentLocation, locationCell: currentLocation.locationCell ? { ...currentLocation.locationCell } : null };
  const stored = readSelection();
  const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
  currentLocation = normalizeLocationState({
    ...stored,
    cityId: params.get('city') || stored.cityId,
    mode: params.get('area') ? 'manual' : params.get('location') || stored.mode || 'city',
    selectedAreaId: params.get('area') || stored.selectedAreaId,
  });
  return getCurrentLocation();
}

export function setCurrentLocation(input) {
  currentLocation = normalizeLocationState(input);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentLocation));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch { /* Browsing still works when storage is unavailable. */ }
  return getCurrentLocation();
}

export function getDistanceOrigin(input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  if (state.locationCell) return { latitude: state.locationCell.centerLat, longitude: state.locationCell.centerLng, mode: state.mode, cityId: state.cityId };
  const city = CITY_LOCATIONS[state.cityId];
  return { latitude: city.centerLat, longitude: city.centerLng, mode: 'city', cityId: city.id };
}

export function listingDistanceKm(listing, input = getCurrentLocation()) {
  const listingPoint = pointFrom(listing?.locationCell);
  if (!listingPoint) return null;
  const origin = getDistanceOrigin(input);
  return calculateDistance(origin.latitude, origin.longitude, listingPoint.latitude, listingPoint.longitude);
}

export function matchesLocation(listing, input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  return getCityLocation(listing?.cityId || listing?.city)?.id === state.cityId;
}

export function formatApproximateDistance(distanceKm) {
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 0.3) return '< 300 м';
  if (km < 0.75) return '≈ 500 м';
  if (km < 1.5) return '≈ 1 км';
  if (km < 3.5) return '≈ 2 км';
  if (km < 7) return '≈ 5 км';
  if (km < 10) return '7–10 км';
  if (km < 15) return '≈ 10 км';
  return 'дальше 10 км';
}

export function formatDistanceValue(km) { return formatApproximateDistance(km); }

export function formatListingLocation(listing, input = getCurrentLocation(), detail = false) {
  const state = normalizeLocationState(input);
  const city = getCityLocation(listing?.cityId || listing?.city);
  const areaName = listing?.publicAreaName || city?.name || 'Местоположение не указано';
  if (state.mode === 'city' || city?.id !== state.cityId) return areaName;
  const formatted = formatApproximateDistance(listingDistanceKm(listing, state));
  return formatted ? `${areaName} · ${formatted}${detail && state.mode === 'nearby' ? ' от вас' : ''}` : areaName;
}

export function locationTitle(input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  if (state.mode === 'nearby') return 'Рядом с вами';
  if (state.mode === 'manual') {
    const area = getAreaLocation(state.cityId, state.selectedAreaId);
    return `Рядом с ${area?.instrumental || area?.name || state.city}`;
  }
  return `В ${CITY_LOCATIONS[state.cityId].prepositional || state.city}`;
}

export function locationIntro(input = getCurrentLocation()) {
  return normalizeLocationState(input).mode === 'city' ? `Объявления только из города ${normalizeLocationState(input).city}` : 'То, что можно забрать неподалёку';
}

export function distanceSortLabel() { return 'Сначала ближайшие'; }

function relevanceScore(listing, query) {
  const words = String(query || '').toLocaleLowerCase('ru').split(/\s+/).filter(Boolean);
  const haystack = `${listing.title || ''} ${listing.description || ''}`.toLocaleLowerCase('ru');
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

export function getAdaptiveNearbyResults(listings, origin, query = '') {
  const state = normalizeLocationState(origin);
  const ranked = listings.map((listing) => ({ listing, distance: listingDistanceKm(listing, state), relevance: relevanceScore(listing, query) }))
    .sort((a, b) => b.relevance - a.relevance || (a.distance ?? Infinity) - (b.distance ?? Infinity) || new Date(b.listing.createdAt) - new Date(a.listing.createdAt));
  const group = (min, max) => ranked.filter((item) => item.distance !== null && item.distance >= min && item.distance < max).map((item) => item.listing);
  const veryClose = group(0, 1);
  const nearby = veryClose.length < MIN_NEARBY_RESULTS ? group(1, 3) : [];
  const notFar = veryClose.length + nearby.length < MIN_NEARBY_RESULTS ? group(3, 7) : [];
  const localIds = new Set([...veryClose, ...nearby, ...notFar].map((item) => String(item.id)));
  const cityFallback = ranked.filter((item) => !localIds.has(String(item.listing.id))).map((item) => item.listing);
  return { veryClose, nearby, notFar, cityFallback };
}

export function requestUserLocation(cityId = getCurrentLocation().cityId) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) return reject(new Error('Геолокация недоступна'));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationCell = createLocationCell(position.coords.latitude, position.coords.longitude, cityId);
        if (locationCell) resolve({ locationCell });
        else reject(new Error('Не удалось определить примерное местоположение'));
      },
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
