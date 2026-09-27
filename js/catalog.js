import { conditions } from './data.js';
import {
  categories as rootCategories, getCategory, getCategoryParent,
  getCategoryPath, getCategorySidebarState, getDescendantCategoryIds,
} from './categories.js';
import {
  addRecentSearch, escapeHtml, getListings, getRecentSearches, getSavedSearches,
  icon, listingCard, refreshLocationUi, renderShell, showToast, toggleSavedSearch,
} from './common.js';
import {
  CITY_LOCATIONS, distanceSortLabel, getAdaptiveNearbyResults, getCityAreas,
  getCurrentLocation, listingDistanceKm, locationIntro, locationTitle,
  matchesLocation, normalizeLocationState, requestUserLocation, setCurrentLocation,
} from './location.js';

renderShell('index');

const form = document.getElementById('filter-form');
const grid = document.getElementById('listing-grid');
const searchInput = document.getElementById('global-search');
const sortSelect = document.getElementById('sort-select');
const categoryNav = document.getElementById('category-nav');
const categoryInput = document.getElementById('filter-category');
const categoryTree = document.getElementById('category-tree');
const breadcrumbs = document.getElementById('catalog-breadcrumbs');
const suggestions = document.getElementById('recent-searches');
let searchTimer;
let filterTimer;
let categoryLevelExpanded = false;
const CATEGORY_PREVIEW_LIMIT = 7;

form.elements.city.innerHTML = Object.entries(CITY_LOCATIONS).map(([id, city]) => `<option value="${escapeHtml(id)}">${escapeHtml(city.name)}</option>`).join('');
document.getElementById('condition-options').innerHTML = conditions.map(condition => `<label><input type="checkbox" name="condition" value="${condition.id}"> ${escapeHtml(condition.label)}</label>`).join('');

function stateFromUrl() {
  const params = new URLSearchParams(location.search);
  const current = getCurrentLocation();
  const cityId = params.get('city') || current.cityId;
  return {
    query: params.get('q') || '',
    category: params.get('category') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    conditions: (params.get('condition') || '').split(',').filter(Boolean),
    location: normalizeLocationState({
      cityId,
      mode: params.get('area') ? 'manual' : params.get('location') || (cityId === current.cityId ? current.mode : 'city'),
      selectedAreaId: params.get('area') || (cityId === current.cityId ? current.selectedAreaId : null),
      locationCell: cityId === current.cityId ? current.locationCell : null,
    }),
    sort: params.get('sort') || 'recommended',
  };
}

function stateFromForm() {
  const current = getCurrentLocation();
  const cityId = form.elements.city.value || current.cityId;
  return {
    query: searchInput.value.trim(),
    category: categoryInput.value,
    min: form.elements.min.value,
    max: form.elements.max.value,
    conditions: [...form.querySelectorAll('[name="condition"]:checked')].map(input => input.value),
    location: normalizeLocationState({
      ...current,
      cityId,
      mode: cityId === current.cityId ? current.mode : 'city',
      selectedAreaId: cityId === current.cityId ? current.selectedAreaId : null,
      locationCell: cityId === current.cityId ? current.locationCell : null,
    }),
    sort: sortSelect.value,
  };
}

function setFormState(state) {
  const selectedLocation = normalizeLocationState(state.location || state);
  searchInput.value = state.query || '';
  categoryInput.value = getCategory(state.category)?.id || '';
  form.elements.min.value = state.min || '';
  form.elements.max.value = state.max || '';
  form.elements.city.value = selectedLocation.cityId;
  sortSelect.value = state.sort || 'recommended';
  if (!sortSelect.value) sortSelect.value = 'recommended';
  form.querySelectorAll('[name="condition"]').forEach(input => {
    input.checked = (state.conditions || []).includes(input.value);
  });
  setCurrentLocation(selectedLocation);
}

setFormState(stateFromUrl());

function listingCategoryId(listing) {
  return listing.categoryId || listing.category || '';
}

export function searchListings(listings, query) {
  const words = query.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean);
  if (!words.length) return listings;
  return listings.filter(listing => {
    const path = getCategoryPath(listingCategoryId(listing));
    const categoryTerms = path.map(node => `${node.name} ${(node.searchAliases || []).join(' ')}`).join(' ');
    const haystack = `${listing.title || ''} ${listing.description || ''} ${categoryTerms}`.toLocaleLowerCase('ru');
    return words.every(word => haystack.includes(word));
  });
}

export function filterListings(listings, state) {
  const categoryIds = state.category ? new Set(getDescendantCategoryIds(state.category)) : null;
  return listings.filter(listing => {
    if (categoryIds && !categoryIds.has(listingCategoryId(listing))) return false;
    if (state.min !== '' && Number(listing.price) < Number(state.min)) return false;
    if (state.max !== '' && Number(listing.price) > Number(state.max)) return false;
    if (state.conditions?.length && !state.conditions.includes(listing.condition)) return false;
    if (!matchesLocation(listing, state.location)) return false;
    return true;
  });
}

export function sortListings(listings, sort, locationState) {
  const items = [...listings];
  const distance = item => listingDistanceKm(item, locationState) ?? Infinity;
  const recent = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  switch (sort) {
    case 'distance': return items.sort((a, b) => distance(a) - distance(b) || recent(a, b));
    case 'newest': return items.sort(recent);
    case 'price-asc': return items.sort((a, b) => a.price - b.price);
    case 'price-desc': return items.sort((a, b) => b.price - a.price);
    default: return items.sort((a, b) => recent(a, b) || distance(a) - distance(b));
  }
}

function updateUrl(state, mode = 'replace') {
  if (mode === 'none') return;
  const url = new URL(location.href);
  ['q', 'category', 'min', 'max', 'condition', 'radius', 'city', 'origin', 'scope', 'location', 'area', 'sort'].forEach(key => url.searchParams.delete(key));
  if (state.query) url.searchParams.set('q', state.query);
  if (state.category) url.searchParams.set('category', state.category);
  if (state.min) url.searchParams.set('min', state.min);
  if (state.max) url.searchParams.set('max', state.max);
  if (state.conditions.length) url.searchParams.set('condition', state.conditions.join(','));
  url.searchParams.set('city', state.location.cityId);
  if (state.location.mode === 'nearby') url.searchParams.set('location', 'nearby');
  if (state.location.mode === 'manual') url.searchParams.set('area', state.location.selectedAreaId);
  if (state.sort !== 'recommended') url.searchParams.set('sort', state.sort);
  if (url.href !== location.href) history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

function categoryHref(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set('category', id);
  else url.searchParams.delete('category');
  return `index.html${url.search}${url.hash}`;
}

function renderCategories(active) {
  const rootId = getCategoryPath(active)[0]?.id || '';
  categoryNav.innerHTML = `<button type="button" class="category-chip ${!active ? 'is-active' : ''}" data-category="" aria-pressed="${!active}">Для вас</button>${rootCategories.map(category => `<button type="button" class="category-chip ${category.id === rootId ? 'is-active' : ''}" data-category="${escapeHtml(category.id)}" aria-pressed="${category.id === rootId}">${escapeHtml(category.name)}</button>`).join('')}`;
}

function categoryTreeButton(category, depth, active, path = false) {
  const current = category.id === active;
  const classes = ['category-tree__item'];
  if (current) classes.push('category-current');
  if (path) classes.push('category-tree__path-item');
  const indent = Math.min(depth, 3);
  return `<button class="${classes.join(' ')}" style="--category-indent:${indent * 16}px" type="button" data-tree-category="${escapeHtml(category.id)}"${current ? ' aria-current="page"' : ''}>${escapeHtml(category.name)}</button>`;
}

function renderCategoryTree(active) {
  const state = getCategorySidebarState(active);
  let path = [];
  let options = rootCategories;

  if (state.current) {
    if (state.children.length) {
      path = [...state.ancestors, state.current];
      options = state.children;
    } else {
      path = state.ancestors;
      options = getCategoryParent(state.current.id)?.children || rootCategories;
    }
  }

  const visible = categoryLevelExpanded ? options : options.slice(0, CATEGORY_PREVIEW_LIMIT);
  const optionDepth = Math.min(path.length, 3);
  const allCategories = `<button class="category-tree__all${state.current ? '' : ' category-current'}" type="button" data-tree-category=""${state.current ? '' : ' aria-current="page"'}>Все категории</button>`;
  const pathHtml = path.length
    ? `<div class="category-tree__path">${path.map((category, depth) => categoryTreeButton(category, depth, active, true)).join('')}</div>`
    : '';
  const optionsHtml = `<div class="category-tree__level">${visible.map(category => categoryTreeButton(category, optionDepth, active)).join('')}</div>`;
  const toggle = options.length > CATEGORY_PREVIEW_LIMIT
    ? `<button class="category-tree__toggle" type="button" data-category-tree-toggle aria-expanded="${categoryLevelExpanded}">${categoryLevelExpanded ? 'Свернуть' : 'Посмотреть все'}</button>`
    : '';
  categoryTree.innerHTML = `${allCategories}${pathHtml}${optionsHtml}${toggle}`;
}

function renderBreadcrumbs(active) {
  const path = getCategoryPath(active);
  breadcrumbs.hidden = !path.length;
  if (!path.length) {
    breadcrumbs.innerHTML = '';
    return;
  }
  breadcrumbs.innerHTML = `<a href="${escapeHtml(categoryHref(''))}" data-category="">Все категории</a>${path.map((node, index) => `<span aria-hidden="true">›</span><a href="${escapeHtml(categoryHref(node.id))}" data-category="${escapeHtml(node.id)}"${index === path.length - 1 ? ' aria-current="page"' : ''}>${escapeHtml(node.name)}</a>`).join('')}`;
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'объявление';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'объявления';
  return 'объявлений';
}

function savedSearchState(state) {
  return state;
}

function updateSaveButton(state) {
  const saved = getSavedSearches().some(item => JSON.stringify(item) === JSON.stringify(savedSearchState(state)));
  const button = document.getElementById('save-search');
  button.classList.toggle('is-active', saved);
  button.querySelector('span').textContent = saved ? 'Поиск сохранён' : 'Сохранить поиск';
  button.setAttribute('aria-pressed', String(saved));
}

function renderLocationControls(locationState) {
  const city = CITY_LOCATIONS[locationState.cityId] || CITY_LOCATIONS.tomsk;
  document.getElementById('location-current-city').textContent = city.name;
  const area = document.getElementById('filter-area');
  area.innerHTML = `<option value="">Выбрать район</option>${getCityAreas(city.id).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}`;
  area.value = locationState.selectedAreaId || '';
  document.querySelectorAll('[data-location-mode]').forEach((button) => {
    const activeMode = locationState.mode === 'manual' ? 'nearby' : locationState.mode;
    const active = button.dataset.locationMode === activeMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    if (button.dataset.locationMode === 'city') button.textContent = `По ${city.dative || city.name}`;
  });
  if (locationState.mode !== 'city') document.getElementById('location-permission').hidden = true;
  const useLocation = document.getElementById('use-my-location');
  useLocation.disabled = false;
  useLocation.textContent = 'Использовать моё местоположение';
  sortSelect.querySelector('[value="distance"]').textContent = distanceSortLabel(locationState);
}

function renderNearbyFeed(listings, state) {
  const groups = getAdaptiveNearbyResults(listings, state.location, state.query);
  const localCount = groups.veryClose.length + groups.nearby.length + groups.notFar.length;
  const sections = [
    ['Совсем рядом', groups.veryClose],
    ['Рядом', groups.nearby],
    ['Недалеко', groups.notFar],
    [`Ещё варианты в ${CITY_LOCATIONS[state.location.cityId].prepositional}`, groups.cityFallback],
  ].filter(([, items]) => items.length);
  const fallbackNote = localCount === 0 && groups.cityFallback.length
    ? `<div class="nearby-fallback"><strong>Поблизости ничего не нашли.</strong><p>Есть ${groups.cityFallback.length} подходящих ${plural(groups.cityFallback.length)} в ${CITY_LOCATIONS[state.location.cityId].prepositional}.</p></div>`
    : '';
  return `${fallbackNote}${sections.map(([title, items]) => `<section class="nearby-group"><h2>${escapeHtml(title)}</h2><div class="listing-grid">${items.map((listing) => listingCard(listing, state.location)).join('')}</div></section>`).join('')}`;
}

export function renderListings(mode = 'replace') {
  const state = stateFromForm();
  setCurrentLocation(state.location);
  const listings = sortListings(filterListings(searchListings(getListings(), state.query), state), state.sort, state.location);
  updateUrl(state, mode);
  renderCategories(state.category);
  renderCategoryTree(state.category);
  renderBreadcrumbs(state.category);
  renderLocationControls(state.location);
  updateSaveButton(state);
  document.getElementById('catalog-count').textContent = `${listings.length} ${plural(listings.length)}`;
  const category = getCategory(state.category);
  document.getElementById('catalog-title').textContent = state.query ? `Поиск: «${state.query}»` : category ? category.name : locationTitle(state.location);
  const intro = document.getElementById('catalog-intro');
  intro.textContent = category || state.query ? '' : locationIntro(state.location);
  intro.hidden = !intro.textContent;
  grid.classList.toggle('nearby-feed', state.location.mode !== 'city');
  grid.innerHTML = listings.length
    ? state.location.mode === 'city'
      ? listings.map(listing => listingCard(listing, state.location)).join('')
      : renderNearbyFeed(listings, state)
    : `<div class="empty-state"><div class="empty-state__icon">${icon('search', 30)}</div><h2>Ничего не нашли</h2><p>Попробуйте изменить категорию или другие фильтры.</p><button class="button button--secondary" type="button" id="empty-reset">Сбросить фильтры</button></div>`;
  refreshLocationUi(false);
}

function showSkeleton() {
  grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"><div class="skeleton-card__image"></div><div class="skeleton-card__line"></div><div class="skeleton-card__line short"></div><div class="skeleton-card__line muted"></div></div>').join('');
}

function closeFilters() {
  document.getElementById('filter-sidebar').classList.remove('is-open');
  document.getElementById('filter-backdrop').hidden = true;
  document.getElementById('filter-toggle').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('filters-open');
}

function selectCategory(id, keepFiltersOpen = false) {
  categoryInput.value = id && getCategory(id) ? id : '';
  categoryLevelExpanded = false;
  renderListings('push');
  if (!keepFiltersOpen) closeFilters();
}

function resetFilters() {
  form.reset();
  searchInput.value = '';
  sortSelect.value = 'recommended';
  categoryLevelExpanded = false;
  renderListings();
  closeFilters();
}

function renderSuggestions() {
  const recent = getRecentSearches();
  const saved = getSavedSearches();
  if (!recent.length && !saved.length) { suggestions.hidden = true; return; }
  suggestions.innerHTML = `${recent.length ? `<div class="suggestion-heading">Недавние поиски</div>${recent.map(query => `<button type="button" data-recent-query="${escapeHtml(query)}">${icon('search', 15)} ${escapeHtml(query)}</button>`).join('')}` : ''}${saved.length ? `<div class="suggestion-heading">Сохранённые поиски</div>${saved.map((item, index) => `<button type="button" data-saved-index="${index}">${icon('heart', 15)} ${escapeHtml(item.query || getCategory(item.category)?.name || CITY_LOCATIONS[item.location?.cityId]?.name || item.city || 'Все объявления')}</button>`).join('')}` : ''}`;
  suggestions.hidden = false;
}

function handleCategoryLink(event, keepFiltersOpen) {
  const link = event.target.closest('a[data-category]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  selectCategory(link.dataset.category, keepFiltersOpen);
}

showSkeleton();
setTimeout(() => renderListings(), 390);

categoryNav.addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (button) selectCategory(button.dataset.category);
});
categoryTree.addEventListener('click', event => {
  const category = event.target.closest('[data-tree-category]');
  if (category) {
    selectCategory(category.dataset.treeCategory, true);
    return;
  }
  if (event.target.closest('[data-category-tree-toggle]')) {
    categoryLevelExpanded = !categoryLevelExpanded;
    renderCategoryTree(categoryInput.value);
  }
});
breadcrumbs.addEventListener('click', event => handleCategoryLink(event, false));

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderListings(), 260);
});
searchInput.addEventListener('focus', renderSuggestions);
searchInput.closest('form').addEventListener('submit', event => {
  event.preventDefault();
  clearTimeout(searchTimer);
  addRecentSearch(searchInput.value);
  suggestions.hidden = true;
  renderListings();
  searchInput.blur();
});
suggestions.addEventListener('mousedown', event => event.preventDefault());
suggestions.addEventListener('click', event => {
  const recent = event.target.closest('[data-recent-query]');
  const saved = event.target.closest('[data-saved-index]');
  if (recent) { searchInput.value = recent.dataset.recentQuery; addRecentSearch(searchInput.value); }
  if (saved) { const value = getSavedSearches()[Number(saved.dataset.savedIndex)]; if (value) setFormState(value); }
  suggestions.hidden = true;
  renderListings();
});
document.addEventListener('click', event => { if (!event.target.closest('.header-search')) suggestions.hidden = true; });
sortSelect.addEventListener('change', () => renderListings());
form.addEventListener('submit', event => { event.preventDefault(); renderListings(); closeFilters(); });
form.addEventListener('change', event => {
  if (event.target.name === 'city') {
    setCurrentLocation({ cityId: event.target.value, mode: 'city' });
    setFormState({ ...stateFromForm(), location: getCurrentLocation() });
    renderListings('push');
    return;
  }
  if (event.target.name === 'area' && event.target.value) {
    setCurrentLocation({ cityId: form.elements.city.value, mode: 'manual', selectedAreaId: event.target.value });
    setFormState({ ...stateFromForm(), location: getCurrentLocation() });
    renderListings('push');
    return;
  }
  renderListings();
});
form.addEventListener('input', event => {
  if (event.target.type === 'radio' || event.target.tagName === 'SELECT') return;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => renderListings(), 180);
});
document.addEventListener('location:changed', event => {
  const current = stateFromForm();
  setFormState({ ...current, location: event.detail.location });
  renderListings('push');
});
document.getElementById('location-change-city').addEventListener('click', event => {
  const select = document.getElementById('filter-city');
  select.hidden = !select.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!select.hidden));
  if (!select.hidden) select.focus();
});
form.querySelector('.location-mode-switch').addEventListener('click', event => {
  const button = event.target.closest('[data-location-mode]');
  if (!button) return;
  const current = getCurrentLocation();
  if (button.dataset.locationMode === 'city') {
    setCurrentLocation({ ...current, mode: 'city', selectedAreaId: null });
    setFormState({ ...stateFromForm(), location: getCurrentLocation() });
    renderListings('push');
  } else if (current.locationCell) {
    setCurrentLocation({ ...current, mode: 'nearby', selectedAreaId: null });
    setFormState({ ...stateFromForm(), location: getCurrentLocation() });
    renderListings('push');
  } else {
    document.getElementById('location-permission').hidden = false;
  }
});
document.getElementById('use-my-location').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const current = getCurrentLocation();
    const approximate = await requestUserLocation(current.cityId);
    setCurrentLocation({ ...current, ...approximate, mode: 'nearby', selectedAreaId: null });
    setFormState({ ...stateFromForm(), location: getCurrentLocation() });
    renderListings('push');
  } catch {
    button.disabled = false;
    showToast('Не удалось получить местоположение. Можно продолжить искать по городу или выбрать район вручную.');
  }
});
document.getElementById('reset-filters').addEventListener('click', resetFilters);
grid.addEventListener('click', event => { if (event.target.closest('#empty-reset')) resetFilters(); });
document.getElementById('save-search').addEventListener('click', () => { toggleSavedSearch(savedSearchState(stateFromForm())); updateSaveButton(stateFromForm()); });
document.getElementById('filter-toggle').addEventListener('click', () => {
  document.getElementById('filter-sidebar').classList.add('is-open');
  document.getElementById('filter-backdrop').hidden = false;
  document.getElementById('filter-toggle').setAttribute('aria-expanded', 'true');
  document.body.classList.add('filters-open');
});
document.getElementById('filter-close').addEventListener('click', closeFilters);
document.getElementById('filter-backdrop').addEventListener('click', closeFilters);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeFilters();
    suggestions.hidden = true;
  }
});
window.addEventListener('popstate', () => {
  setFormState(stateFromUrl());
  categoryLevelExpanded = false;
  renderListings('replace');
});
