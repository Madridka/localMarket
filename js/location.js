import { locations } from './data.js';

export const CITY_LOCATIONS = Object.freeze(Object.fromEntries(
  Object.entries(locations).map(([id, value]) => [id, Object.freeze({ id, ...value })]),
));

const DEFAULT_CITY_ID = 'tomsk';
const REGION_ID = 'tomsk-oblast';
const VALID_RADII = [5, 10, 30, 100];
const STORAGE_KEY = 'ryadom.location.v1';
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

let userCoordinates = null;
let currentLocation = null;

function coordinate(value, limit) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric) <= limit ? numeric : null;
}

function validPoint(value) {
  if (!value || typeof value !== 'object') return null;
  const latitude = coordinate(value.latitude ?? value.lat, 90);
  const longitude = coordinate(value.longitude ?? value.lng ?? value.lon, 180);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

export function getCityLocation(value) {
  const key = String(value || '').trim().toLowerCase();
  return CITY_LOCATIONS[key] || Object.values(CITY_LOCATIONS).find((city) => city.name.toLowerCase() === key) || null;
}

export function setUserCoordinates(value) {
  userCoordinates = validPoint(value);
  return getUserCoordinates();
}

export function getUserCoordinates() {
  return userCoordinates ? { ...userCoordinates } : null;
}

export function normalizeLocationState(input = {}) {
  const source = input instanceof URLSearchParams ? Object.fromEntries(input) : input || {};
  const city = getCityLocation(source.cityId || source.city || source.selectedCity) || CITY_LOCATIONS[DEFAULT_CITY_ID];
  const radiusValue = source.radiusKm ?? source.radius;
  const radiusKm = VALID_RADII.includes(Number(radiusValue)) && radiusValue !== null && radiusValue !== ''
    ? Number(radiusValue) : null;
  const scope = source.scope === 'region' ? 'region' : radiusKm === null ? 'region' : 'radius';
  const requestedMode = source.mode || source.locationMode || source.origin;
  const point = validPoint(source) || userCoordinates;
  const mode = requestedMode === 'user' && point ? 'user' : 'cityCenter';
  return {
    regionId: REGION_ID,
    cityId: city.id,
    city: city.name,
    mode,
    scope,
    radiusKm: scope === 'region' ? null : radiusKm,
    latitude: mode === 'user' ? point.latitude : null,
    longitude: mode === 'user' ? point.longitude : null,
  };
}

function readSelection() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function getCurrentLocation() {
  if (currentLocation) return { ...currentLocation };
  const stored = readSelection();
  const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
  currentLocation = normalizeLocationState({
    cityId: params.get('city') || stored.cityId,
    radiusKm: params.has('radius') ? params.get('radius') : stored.radiusKm,
    scope: params.has('radius') ? undefined : (params.get('scope') || stored.scope),
    origin: params.get('origin') || 'center',
  });
  return { ...currentLocation };
}

export function setCurrentLocation(input) {
  currentLocation = normalizeLocationState(input);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cityId: currentLocation.cityId,
      scope: currentLocation.scope,
      radiusKm: currentLocation.radiusKm,
    }));
  } catch {
    // The location filter remains usable when storage is unavailable.
  }
  return { ...currentLocation };
}

export function getDistanceOrigin(input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  const city = CITY_LOCATIONS[state.cityId];
  return state.mode === 'user'
    ? { latitude: state.latitude, longitude: state.longitude, mode: 'user', cityId: state.cityId, label: 'вас' }
    : { latitude: city.latitude, longitude: city.longitude, mode: 'cityCenter', cityId: city.id, label: `центра ${city.genitive}` };
}

export function calculateDistance(latitude1, longitude1, latitude2, longitude2) {
  const first = validPoint({ latitude: latitude1, longitude: longitude1 });
  const second = validPoint({ latitude: latitude2, longitude: longitude2 });
  if (!first || !second) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latDelta = radians(second.latitude - first.latitude);
  const lonDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(lonDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function listingDistanceKm(listing, input = getCurrentLocation()) {
  // A seller who supplied only a city has no known listing position.
  if (listing?.locationPrecision === 'city') return null;
  const point = validPoint(listing);
  if (!point) return null;
  const origin = getDistanceOrigin(input);
  return calculateDistance(origin.latitude, origin.longitude, point.latitude, point.longitude);
}

export function matchesLocation(listing, input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  const city = getCityLocation(listing?.cityId || listing?.city);
  const regionId = listing?.regionId || city?.regionId;
  if (regionId !== state.regionId) return false;
  if (state.scope === 'region') return true;
  const distance = listingDistanceKm(listing, state);
  return distance !== null && distance <= state.radiusKm;
}

export function formatDistanceValue(km) {
  if (km === null || km === undefined || !Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const metres = Math.round(km * 100) * 10;
    return metres >= 1000 ? '1 км' : `${metres} м`;
  }
  return `${numberFormat.format(km < 10 ? Math.round(km * 10) / 10 : Math.round(km))} км`;
}

export function formatListingLocation(listing, input = getCurrentLocation()) {
  const city = getCityLocation(listing?.cityId || listing?.city);
  const name = listing?.city || city?.name || 'Томская область';
  const distance = listingDistanceKm(listing, input);
  if (distance === null) return name;
  const origin = getDistanceOrigin(input);
  return `${name} · ${formatDistanceValue(distance)} от ${origin.label}`;
}

export function locationTitle(input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  if (state.scope === 'region') return 'Объявления в Томской области';
  if (state.mode === 'user') return 'Рядом с вами';
  return `Рядом с центром ${CITY_LOCATIONS[state.cityId].genitive}`;
}

export function locationIntro(input = getCurrentLocation()) {
  const state = normalizeLocationState(input);
  if (state.scope === 'region') return 'Томск, Северск, Асино и другие города';
  return `В радиусе ${state.radiusKm} км`;
}

export function distanceSortLabel(input = getCurrentLocation()) {
  return normalizeLocationState(input).mode === 'user' ? 'Сначала ближайшие' : 'Ближе к центру';
}

export function requestUserLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
      reject(new Error('Геолокация недоступна'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = setUserCoordinates(position.coords);
        if (point) resolve(point);
        else reject(new Error('Не удалось определить координаты'));
      },
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
