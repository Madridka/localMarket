import { conditions, seedListings, seedSellers, seedChats } from './data.js';
import { getCategory as findCategory, isLeafCategory, searchCategories, getCategoryPath } from './categories.js';
import {
  CITY_LOCATIONS, createLocationCell, findNearestArea, formatListingLocation,
  getAreaLocation, getCityAreas, getCityLocation, getCurrentLocation,
  requestUserLocation, setCurrentLocation,
} from './location.js';

const KEY = {
  listings: 'ryadom.listings.v1',
  favorites: 'ryadom.favorites.v1',
  chats: 'ryadom.chats.v1',
  recent: 'ryadom.recent.v1',
  searches: 'ryadom.searches.v1',
  savedSearches: 'ryadom.saved-searches.v1',
};

const currentUser = {
  id: 0,
  name: 'Вы',
  city: 'Томск',
  rating: null,
  reviewsCount: 0,
  registeredAt: '2026-09-01',
  verifiedPhone: true,
  responseTime: 'Обычно отвечает в течение дня',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    showToast('Не удалось сохранить данные. Освободите место в браузере.');
    return false;
  }
}

const legacyCategoryNames = {
  phones: 'Смартфоны', laptops: 'Ноутбуки', computers: 'Настольные компьютеры',
  games: 'Игровые приставки', audio: 'Наушники', appliances: 'Бытовая техника',
  furniture: 'Кресла', shoes: 'Обувь', outerwear: 'Куртки', jeans: 'Джинсы',
  strollers: 'Коляски', toys: 'Игрушки', music: 'Музыкальные инструменты',
  collectibles: 'Коллекционные товары', photography: 'Фотоаппараты',
  bikes: 'Велосипеды', fitness: 'Тренажёры', winter: 'Лыжи',
  tires: 'Шины', lighting: 'Люстры', fragrance: 'Парфюмерия',
  devices: 'Приборы для ухода', aquariums: 'Аквариумы', books: 'Книги',
};

function firstLeaf(node) {
  if (!node) return null;
  if (!node.children?.length) return node;
  for (const child of node.children) {
    const leaf = firstLeaf(child);
    if (leaf) return leaf;
  }
  return null;
}

function migrateListingCategory(listing) {
  if (isLeafCategory(listing.categoryId)) {
    if (!('category' in listing) && !('subcategory' in listing)) return listing;
    const migrated = { ...listing };
    delete migrated.category;
    delete migrated.subcategory;
    return migrated;
  }
  const oldRoot = listing.category || getCategoryPath(listing.categoryId)[0]?.id;
  const hint = legacyCategoryNames[listing.subcategory] || '';
  const words = [
    ...String(listing.title || '').split(/[\s,.:()«»]+/).filter((word) => word.length > 4),
    hint,
  ];
  let target = null;
  for (const word of words) {
    target = searchCategories(word, 80).find((node) => isLeafCategory(node.id) && (!oldRoot || getCategoryPath(node.id)[0]?.id === oldRoot));
    if (target) break;
  }
  target ||= firstLeaf(findCategory(listing.categoryId || oldRoot));
  target ||= firstLeaf(findCategory('other'));
  if (!target) return listing;
  const migrated = { ...listing, categoryId: target.id };
  delete migrated.category;
  delete migrated.subcategory;
  return migrated;
}

function migrateListingLocation(listing) {
  const city = getCityLocation(listing.cityId || listing.city) || CITY_LOCATIONS.tomsk;
  const rawPoint = listing.latitude !== undefined && listing.longitude !== undefined
    ? createLocationCell(listing.latitude, listing.longitude, city.id)
    : null;
  const existingCell = listing.locationCell
    ? createLocationCell(listing.locationCell.centerLat, listing.locationCell.centerLng, city.id)
    : null;
  const fallbackAreas = getCityAreas(city.id);
  const fallbackArea = getAreaLocation(city.id, listing.areaId) || fallbackAreas[Number(listing.id || 0) % Math.max(fallbackAreas.length, 1)] || null;
  const locationCell = existingCell || rawPoint || (fallbackArea ? createLocationCell(fallbackArea.centerLat, fallbackArea.centerLng, city.id) : null);
  const nearestArea = getAreaLocation(city.id, listing.areaId) || findNearestArea(city.id, locationCell) || fallbackArea;
  const migrated = {
    ...listing,
    cityId: city.id,
    city: city.name,
    regionId: city.regionId,
    areaId: nearestArea?.id || null,
    publicAreaName: listing.publicAreaName || nearestArea?.name || city.name,
    locationCell,
  };
  delete migrated.latitude;
  delete migrated.longitude;
  delete migrated.address;
  delete migrated.locationPrecision;
  delete migrated.distance;
  return migrated;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function safeImage(url) {
  if (typeof url !== 'string') return './assets/placeholder.svg';
  if (/^https:\/\//i.test(url) || /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(url) || /^\.\/assets\//.test(url)) return url;
  return './assets/placeholder.svg';
}

export function getCurrentUser() { return currentUser; }
export function getListings() {
  const added = read(KEY.listings, []);
  const items = Array.isArray(added) ? added : [];
  const migrated = items.map((item) => migrateListingLocation(migrateListingCategory(item)));
  if (JSON.stringify(migrated) !== JSON.stringify(items)) write(KEY.listings, migrated);
  return [...migrated, ...seedListings];
}
export function getListingById(id) { return getListings().find(item => String(item.id) === String(id)); }
export function getSellerById(id) { return Number(id) === 0 ? currentUser : seedSellers.find(item => String(item.id) === String(id)); }
export function getCategory(id) { return findCategory(id); }
export function getCondition(id) { return conditions.find(item => item.id === id); }

export function addListing(listing) {
  if (!isLeafCategory(listing.categoryId)) return null;
  const added = read(KEY.listings, []);
  const items = Array.isArray(added) ? added : [];
  const nextId = Math.max(1000, ...getListings().map(item => Number(item.id) || 0)) + 1;
  const created = migrateListingLocation({ ...listing, id: nextId, sellerId: 0, createdAt: new Date().toISOString(), views: 0 });
  if (!write(KEY.listings, [created, ...items])) return null;
  return created;
}

export function updateListing(id, changes) {
  if (!isLeafCategory(changes.categoryId)) return null;
  const added = read(KEY.listings, []);
  if (!Array.isArray(added)) return null;
  const index = added.findIndex((item) => String(item.id) === String(id) && Number(item.sellerId) === currentUser.id);
  if (index < 0) return null;
  const updated = migrateListingLocation({ ...migrateListingCategory(added[index]), ...changes, id: added[index].id, sellerId: currentUser.id });
  delete updated.category;
  delete updated.subcategory;
  delete updated.distance;
  const items = [...added];
  items[index] = updated;
  return write(KEY.listings, items) ? updated : null;
}

export function getFavorites() {
  const value = read(KEY.favorites, [2, 9, 17]);
  return Array.isArray(value) ? value : [];
}
export function isFavorite(id) { return getFavorites().some(item => String(item) === String(id)); }
export function toggleFavorite(id) {
  const favorites = getFavorites();
  const included = favorites.some(item => String(item) === String(id));
  const updated = included ? favorites.filter(item => String(item) !== String(id)) : [...favorites, Number(id)];
  write(KEY.favorites, updated);
  syncFavoriteButtons();
  document.dispatchEvent(new CustomEvent('favorites:changed', { detail: { id, favorite: !included } }));
  showToast(included ? 'Удалено из избранного' : 'Добавлено в избранное');
  return !included;
}
export function syncFavoriteButtons() {
  document.querySelectorAll('[data-favorite-id]').forEach(button => {
    const active = isFavorite(button.dataset.favoriteId);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Убрать из избранного' : 'Добавить в избранное');
    const glyph = button.querySelector('svg');
    if (glyph) glyph.setAttribute('fill', active ? 'currentColor' : 'none');
  });
}

export function getChats() {
  const chats = read(KEY.chats, seedChats);
  return Array.isArray(chats) ? chats : seedChats;
}
export function saveChats(chats) { return write(KEY.chats, chats); }
export function ensureChat(listingId) {
  const listing = getListingById(listingId);
  if (!listing || Number(listing.sellerId) === 0) return null;
  const chats = getChats();
  let chat = chats.find(item => String(item.listingId) === String(listingId));
  if (!chat) {
    chat = { id: `chat-${Date.now()}`, listingId: listing.id, sellerId: listing.sellerId, messages: [] };
    chats.unshift(chat);
    saveChats(chats);
  }
  return chat;
}
export function addChatMessage(listingId, text) {
  const chat = ensureChat(listingId);
  if (!chat) return null;
  const chats = getChats();
  const target = chats.find(item => String(item.id) === String(chat.id));
  target.messages.push({ sender: 'me', text: String(text).trim(), timestamp: new Date().toISOString() });
  saveChats(chats);
  return target;
}

export function getRecent() {
  const ids = read(KEY.recent, []);
  return Array.isArray(ids) ? ids : [];
}
export function markViewed(id) {
  const ids = [Number(id), ...getRecent().filter(item => String(item) !== String(id))].slice(0, 5);
  write(KEY.recent, ids);
}
export function getRecentSearches() {
  const items = read(KEY.searches, []);
  return Array.isArray(items) ? items : [];
}
export function addRecentSearch(query) {
  const trimmed = String(query).trim();
  if (!trimmed) return;
  write(KEY.searches, [trimmed, ...getRecentSearches().filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5));
}
export function getSavedSearches() {
  const items = read(KEY.savedSearches, []);
  return Array.isArray(items) ? items : [];
}
export function toggleSavedSearch(search) {
  const value = JSON.stringify(search);
  const saved = getSavedSearches();
  const has = saved.some(item => JSON.stringify(item) === value);
  write(KEY.savedSearches, has ? saved.filter(item => JSON.stringify(item) !== value) : [search, ...saved].slice(0, 15));
  showToast(has ? 'Поиск удалён из сохранённого' : 'Поиск сохранён');
  return !has;
}

export function formatPrice(value) { return `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₽`; }
export function formatDistance(listing, locationState = getCurrentLocation(), detail = false) {
  return formatListingLocation(listing, locationState, detail);
}
export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((todayOnly - dateOnly) / 86400000);
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
  if (days === 0) return `Сегодня, ${time}`;
  if (days === 1) return `Вчера, ${time}`;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

const paths = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  chat: '<path d="M20 11.5a7.8 7.8 0 0 1-8 7.5 9 9 0 0 1-3.2-.6L4 20l1.6-4.2A7.2 7.2 0 0 1 4 11.5 7.8 7.8 0 0 1 12 4a7.8 7.8 0 0 1 8 7.5Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-7h6v7"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowRight: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  sliders: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="17" r="2" fill="white"/>',
  camera: '<path d="M4 7h4l2-2h4l2 2h4v12H4V7Z"/><circle cx="12" cy="13" r="3"/>',
};
export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

export function listingCard(listing, locationState = getCurrentLocation()) {
  const img = safeImage(listing.images?.[0]);
  return `<article class="listing-card" data-listing-id="${escapeHtml(listing.id)}">
    <div class="listing-card__image">
      <a href="listing.html?id=${encodeURIComponent(listing.id)}" aria-label="Открыть объявление ${escapeHtml(listing.title)}"><img src="${escapeHtml(img)}" alt="${escapeHtml(listing.title)}" loading="lazy"></a>
      <button class="favorite-button ${isFavorite(listing.id) ? 'is-active' : ''}" type="button" data-favorite-id="${escapeHtml(listing.id)}" aria-label="${isFavorite(listing.id) ? 'Убрать из избранного' : 'Добавить в избранное'}" aria-pressed="${isFavorite(listing.id)}">${icon('heart', 20)}</button>
      ${listing.images?.length > 1 ? `<span class="image-count">${icon('camera', 13)} ${listing.images.length}</span>` : ''}
    </div>
    <div class="listing-card__body">
      <a href="listing.html?id=${encodeURIComponent(listing.id)}" class="listing-card__link">
        <strong class="listing-card__price">${formatPrice(listing.price)}</strong>
        <span class="listing-card__title">${escapeHtml(listing.title)}</span>
        <span class="listing-card__meta">${escapeHtml(findCategory(listing.categoryId)?.name || 'Другое')}</span>
        <span class="listing-card__meta" data-location-meta>${escapeHtml(formatDistance(listing, locationState))}</span>
        <span class="listing-card__meta listing-card__date">${escapeHtml(formatDate(listing.createdAt))}</span>
      </a>
    </div>
  </article>`;
}

export function showToast(message) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-container';
    document.body.append(root);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  root.append(toast);
  setTimeout(() => { toast.classList.add('is-leaving'); setTimeout(() => toast.remove(), 200); }, 3200);
}

export function refreshLocationUi(refreshCards = true) {
  const state = getCurrentLocation();
  const city = CITY_LOCATIONS[state.cityId];
  const cityButton = document.getElementById('header-city-button');
  const cityName = cityButton?.querySelector('[data-header-city-name]');
  if (cityName) cityName.textContent = city.name;
  const current = document.querySelector('.city-menu__current');
  if (current) current.textContent = city.name;
  document.querySelectorAll('[data-header-location-mode]').forEach((button) => {
    const active = button.dataset.headerLocationMode === (state.mode === 'manual' ? 'nearby' : state.mode);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    if (button.dataset.headerLocationMode === 'city') button.textContent = `По ${city.dative || city.name}`;
  });
  document.querySelectorAll('[data-location-city]').forEach((button) => {
    button.setAttribute('aria-current', String(button.dataset.locationCity === state.cityId));
  });
  const areaSelect = document.getElementById('header-area');
  if (areaSelect) {
    areaSelect.innerHTML = `<option value="">Выбрать район</option>${getCityAreas(state.cityId).map((area) => `<option value="${escapeHtml(area.id)}">${escapeHtml(area.name)}</option>`).join('')}`;
    areaSelect.value = state.selectedAreaId || '';
  }
  const permission = document.getElementById('header-location-permission');
  if (permission && state.mode !== 'city') permission.hidden = true;
  if (refreshCards) document.querySelectorAll('[data-location-meta]').forEach((element) => {
    const id = element.closest('[data-listing-id]')?.dataset.listingId;
    const listing = id ? getListingById(id) : null;
    if (listing) element.textContent = formatDistance(listing);
  });
}

function closeCityMenu() {
  const menu = document.getElementById('city-menu');
  const button = document.getElementById('header-city-button');
  if (menu) menu.hidden = true;
  if (button) button.setAttribute('aria-expanded', 'false');
}

function changeLocation(input) {
  const next = setCurrentLocation(input);
  refreshLocationUi();
  document.dispatchEvent(new CustomEvent('location:changed', { detail: { location: next } }));
  closeCityMenu();
}

export function renderShell(activePage = '') {
  const header = document.getElementById('site-header');
  const mobile = document.getElementById('mobile-nav');
  if (header) {
    const query = new URLSearchParams(location.search).get('q') || '';
    header.className = 'site-header';
    header.innerHTML = `<div class="header-inner page-container">
      <a class="logo" href="index.html" aria-label="Рядом — на главную"><span class="logo-mark" aria-hidden="true"></span>Рядом</a>
      <form class="header-search" action="index.html" method="get" role="search">
        ${icon('search', 20)}<input id="global-search" type="search" name="q" value="${escapeHtml(query)}" placeholder="Что ищете?" aria-label="Поиск объявлений" autocomplete="off">
        <div id="recent-searches" class="search-suggestions" hidden></div>
      </form>
      <div class="header-actions">
        <div class="city-picker"><button class="header-city" id="header-city-button" type="button" aria-expanded="false" aria-controls="city-menu">${icon('pin', 18)}<span data-header-city-name>${escapeHtml(getCurrentLocation().city)}</span>${icon('chevron', 16)}</button>
          <div class="city-menu" id="city-menu" hidden>
            <p class="city-menu__heading">Где искать</p>
            <strong class="city-menu__current">${escapeHtml(getCurrentLocation().city)}</strong>
            <div class="location-mode-switch location-mode-switch--header" role="group" aria-label="Режим поиска">
              <button type="button" data-header-location-mode="nearby" aria-pressed="false">Рядом</button>
              <button type="button" data-header-location-mode="city" aria-pressed="false">По ${escapeHtml(CITY_LOCATIONS[getCurrentLocation().cityId].dative || getCurrentLocation().city)}</button>
            </div>
            <div class="location-permission" id="header-location-permission" hidden><p>Разрешите определить примерное местоположение.</p><button type="button" class="button button--primary" id="header-use-location">Использовать моё местоположение</button><label for="header-area">Или выберите район</label><select id="header-area"></select><p>Точная позиция не будет показана другим.</p></div>
            <button class="city-menu__change" id="city-change-button" type="button" aria-expanded="false" aria-controls="city-options">Другой город</button>
            <div class="city-menu__cities" id="city-options" hidden>${Object.values(CITY_LOCATIONS).map(city => `<button type="button" data-location-city="${city.id}" aria-current="${city.id === getCurrentLocation().cityId}">${escapeHtml(city.name)}</button>`).join('')}</div>
            <p class="city-menu__status" id="city-menu-status" role="status" hidden></p>
          </div>
        </div>
        <a class="header-icon" href="favorites.html" aria-label="Избранное" title="Избранное">${icon('heart', 21)}</a>
        <a class="header-icon" href="messages.html" aria-label="Сообщения" title="Сообщения">${icon('chat', 21)}</a>
        <a class="header-profile" href="profile.html">Профиль</a>
        <a class="sell-button" href="create.html">${icon('plus', 19)}Продать</a>
      </div>
    </div>`;
  }
  if (mobile) {
    mobile.className = 'mobile-nav';
    const links = [
      ['index', 'index.html', 'home', 'Главная'],
      ['favorites', 'favorites.html', 'heart', 'Избранное'],
      ['create', 'create.html', 'plus', 'Продать'],
      ['messages', 'messages.html', 'chat', 'Сообщения'],
      ['profile', 'profile.html', 'user', 'Профиль'],
    ];
    mobile.innerHTML = links.map(([key, href, symbol, label]) => `<a href="${href}" class="${activePage === key ? 'is-active' : ''}" ${activePage === key ? 'aria-current="page"' : ''}>${icon(symbol, 21)}<span>${label}</span></a>`).join('');
  }
  document.addEventListener('click', async event => {
    const favorite = event.target.closest('[data-favorite-id]');
    if (favorite) { event.preventDefault(); toggleFavorite(favorite.dataset.favoriteId); return; }
    const cityButton = event.target.closest('#header-city-button');
    const cityMenu = document.getElementById('city-menu');
    if (cityButton && cityMenu) {
      cityMenu.hidden = !cityMenu.hidden;
      cityButton.setAttribute('aria-expanded', String(!cityMenu.hidden));
      return;
    }
    const cityChange = event.target.closest('#city-change-button');
    if (cityChange) {
      const options = document.getElementById('city-options');
      options.hidden = !options.hidden;
      cityChange.setAttribute('aria-expanded', String(!options.hidden));
      return;
    }
    const cityOption = event.target.closest('[data-location-city]');
    if (cityOption) {
      changeLocation({ cityId: cityOption.dataset.locationCity, mode: 'city' });
      return;
    }
    const modeButton = event.target.closest('[data-header-location-mode]');
    if (modeButton) {
      const state = getCurrentLocation();
      if (modeButton.dataset.headerLocationMode === 'city') {
        changeLocation({ ...state, mode: 'city', selectedAreaId: null });
      } else if (state.locationCell) {
        changeLocation({ ...state, mode: 'nearby', selectedAreaId: null });
      } else {
        const permission = document.getElementById('header-location-permission');
        if (permission) permission.hidden = false;
      }
      return;
    }
    const useLocation = event.target.closest('#header-use-location');
    if (useLocation) {
      const state = getCurrentLocation();
      useLocation.disabled = true;
      try {
        const approximate = await requestUserLocation(state.cityId);
        changeLocation({ ...state, ...approximate, mode: 'nearby', selectedAreaId: null });
      } catch {
        useLocation.disabled = false;
        showToast('Не удалось получить местоположение. Можно искать по городу или выбрать район вручную.');
      }
      return;
    }
    if (cityMenu && !event.target.closest('.city-picker')) closeCityMenu();
  });
  document.addEventListener('change', event => {
    const area = event.target.closest('#header-area');
    if (area?.value) changeLocation({ cityId: getCurrentLocation().cityId, mode: 'manual', selectedAreaId: area.value });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('city-menu')?.hidden) closeCityMenu();
  });
  document.addEventListener('location:changed', refreshLocationUi);
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && !event.target.src.endsWith('/assets/placeholder.svg')) event.target.src = './assets/placeholder.svg';
  }, true);
  syncFavoriteButtons();
  refreshLocationUi();
}
