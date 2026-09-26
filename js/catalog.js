import { conditions } from './data.js';
import {
  categories as rootCategories, getCategory, getCategoryChildren,
  getCategoryPath, getDescendantCategoryIds, searchCategories,
} from './categories.js';
import {
  addRecentSearch, escapeHtml, getListings, getRecentSearches, getSavedSearches,
  icon, listingCard, refreshLocationUi, renderShell, showToast, toggleSavedSearch,
} from './common.js';
import {
  CITY_LOCATIONS, distanceSortLabel, getCurrentLocation, listingDistanceKm, locationIntro,
  locationTitle, matchesLocation, normalizeLocationState, requestUserLocation,
  setCurrentLocation, setUserCoordinates,
} from './location.js';

renderShell('index');

const form = document.getElementById('filter-form');
const grid = document.getElementById('listing-grid');
const searchInput = document.getElementById('global-search');
const sortSelect = document.getElementById('sort-select');
const categoryNav = document.getElementById('category-nav');
const categoryInput = document.getElementById('filter-category');
const categoryOpen = document.getElementById('category-open');
const categoryCurrent = document.getElementById('category-current');
const categoryAction = document.getElementById('category-action');
const categorySelector = document.getElementById('category-selector');
const categorySelectorBackdrop = document.getElementById('category-selector-backdrop');
const categorySearch = document.getElementById('category-search');
const categoryBranch = document.getElementById('category-branch');
const breadcrumbs = document.getElementById('catalog-breadcrumbs');
const suggestions = document.getElementById('recent-searches');
let searchTimer;
let filterTimer;
let browsedCategory = '';

form.elements.city.innerHTML = Object.entries(CITY_LOCATIONS).map(([id, city]) => `<option value="${escapeHtml(id)}">${escapeHtml(city.name)}</option>`).join('');
document.getElementById('condition-options').innerHTML = conditions.map(condition => `<label><input type="checkbox" name="condition" value="${condition.id}"> ${escapeHtml(condition.label)}</label>`).join('');

function stateFromUrl() {
  const params = new URLSearchParams(location.search);
  const current = getCurrentLocation();
  return {
    query: params.get('q') || '',
    category: params.get('category') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    conditions: (params.get('condition') || '').split(',').filter(Boolean),
    location: normalizeLocationState({
      city: params.get('city') || current.cityId,
      origin: params.get('origin') || (current.mode === 'user' ? 'user' : 'center'),
      scope: params.get('scope') || (params.has('radius') ? 'radius' : current.scope),
      radius: params.has('radius') ? params.get('radius') : current.radiusKm,
    }),
    sort: params.get('sort') || 'recommended',
  };
}

function stateFromForm() {
  const radius = form.querySelector('[name="radius"]:checked')?.value || 'region';
  return {
    query: searchInput.value.trim(),
    category: categoryInput.value,
    min: form.elements.min.value,
    max: form.elements.max.value,
    conditions: [...form.querySelectorAll('[name="condition"]:checked')].map(input => input.value),
    location: normalizeLocationState({
      city: form.elements.city.value,
      origin: form.querySelector('[name="origin"]:checked')?.value || 'center',
      scope: radius === 'region' ? 'region' : 'radius',
      radius: radius === 'region' ? null : radius,
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
  const origin = form.querySelector(`[name="origin"][value="${selectedLocation.mode === 'user' ? 'user' : 'center'}"]`);
  if (origin) origin.checked = true;
  const radiusValue = selectedLocation.scope === 'region' ? 'region' : String(selectedLocation.radiusKm);
  const radius = [...form.querySelectorAll('[name="radius"]')].find(input => input.value === radiusValue);
  if (radius) radius.checked = true;
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
    default: return locationState?.scope === 'region'
      ? items.sort(recent)
      : items.sort((a, b) => (distance(a) * 0.65 + (Date.now() - new Date(a.createdAt)) / 86400000) - (distance(b) * 0.65 + (Date.now() - new Date(b.createdAt)) / 86400000));
  }
}

function updateUrl(state, mode = 'replace') {
  if (mode === 'none') return;
  const url = new URL(location.href);
  ['q', 'category', 'min', 'max', 'condition', 'radius', 'city', 'origin', 'scope', 'sort'].forEach(key => url.searchParams.delete(key));
  if (state.query) url.searchParams.set('q', state.query);
  if (state.category) url.searchParams.set('category', state.category);
  if (state.min) url.searchParams.set('min', state.min);
  if (state.max) url.searchParams.set('max', state.max);
  if (state.conditions.length) url.searchParams.set('condition', state.conditions.join(','));
  url.searchParams.set('city', state.location.cityId);
  url.searchParams.set('origin', state.location.mode === 'user' ? 'user' : 'center');
  if (state.location.scope === 'radius') url.searchParams.set('radius', String(state.location.radiusKm));
  else url.searchParams.set('scope', 'region');
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

function renderCategorySummary(active) {
  const path = getCategoryPath(active);
  categoryCurrent.textContent = path.length ? path.map(node => node.name).join(' › ') : 'Все категории';
  categoryAction.textContent = path.length ? 'Изменить' : 'Выбрать';
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

function branchLink(node) {
  const hasChildren = getCategoryChildren(node.id).length > 0;
  return `<button class="category-branch__item" type="button" ${hasChildren ? 'data-browse-category' : 'data-select-category'}="${escapeHtml(node.id)}"><span>${escapeHtml(node.name)}</span>${hasChildren ? '<span aria-hidden="true">›</span>' : ''}</button>`;
}

function renderCategoryBranch(active = browsedCategory) {
  const query = categorySearch.value.trim();
  if (query) {
    const matches = searchCategories(query, 25);
    categoryBranch.innerHTML = matches.length
      ? matches.map(node => `<button class="category-branch__result" type="button" data-select-category="${escapeHtml(node.id)}">${getCategoryPath(node.id).map(part => escapeHtml(part.name)).join(' <span aria-hidden="true">›</span> ')}</button>`).join('')
      : '<p class="category-branch__empty">Категория не найдена</p>';
    return;
  }
  const path = getCategoryPath(active);
  const current = path[path.length - 1];
  const parent = path[path.length - 2];
  const children = current ? getCategoryChildren(current.id) : rootCategories;
  const trail = current ? `<div class="category-branch__path"><button type="button" data-browse-category="">Все категории</button>${path.map((node, index) => `<span aria-hidden="true">›</span>${index === path.length - 1 ? `<span aria-current="location">${escapeHtml(node.name)}</span>` : `<button type="button" data-browse-category="${escapeHtml(node.id)}">${escapeHtml(node.name)}</button>`}`).join('')}</div>` : '';
  const back = current ? `<button class="category-branch__back" type="button" data-browse-category="${escapeHtml(parent?.id || '')}">← ${escapeHtml(parent?.name || 'Все категории')}</button>` : '';
  const select = current
    ? `<button class="category-branch__all" type="button" data-select-category="${escapeHtml(current.id)}">Все объявления в категории ${escapeHtml(current.name)}</button>`
    : categoryInput.value ? '<button class="category-branch__all" type="button" data-select-category="">Все категории</button>' : '';
  categoryBranch.innerHTML = `${back}${trail}${select}<div class="category-branch__options">${children.map(node => branchLink(node)).join('')}</div>`;
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'объявление';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'объявления';
  return 'объявлений';
}

function savedSearchState(state) {
  const { latitude, longitude, ...location } = state.location;
  return { ...state, location };
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
  document.getElementById('center-origin-label').textContent = `Центр ${city.genitive || city.name}`;
  const note = document.getElementById('distance-origin-note');
  note.hidden = locationState.scope === 'region';
  note.textContent = locationState.mode === 'user'
    ? 'Расстояние считается от вас'
    : `Расстояние считается от центра ${city.genitive || city.name}`;
  sortSelect.querySelector('[value="distance"]').textContent = distanceSortLabel(locationState);
}

export function renderListings(mode = 'replace') {
  const state = stateFromForm();
  setCurrentLocation(state.location);
  const listings = sortListings(filterListings(searchListings(getListings(), state.query), state), state.sort, state.location);
  updateUrl(state, mode);
  renderCategories(state.category);
  renderCategorySummary(state.category);
  renderBreadcrumbs(state.category);
  renderLocationControls(state.location);
  updateSaveButton(state);
  document.getElementById('catalog-count').textContent = `${listings.length} ${plural(listings.length)}`;
  const category = getCategory(state.category);
  document.getElementById('catalog-title').textContent = state.query ? `Поиск: «${state.query}»` : category ? category.name : locationTitle(state.location);
  const intro = document.getElementById('catalog-intro');
  intro.textContent = category || state.query ? '' : locationIntro(state.location);
  intro.hidden = !intro.textContent;
  grid.innerHTML = listings.length
    ? listings.map(listing => listingCard(listing, state.location)).join('')
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

function openCategorySelector() {
  browsedCategory = categoryInput.value;
  categorySearch.value = '';
  renderCategoryBranch();
  categorySelector.hidden = false;
  categorySelectorBackdrop.hidden = false;
  categoryOpen.setAttribute('aria-expanded', 'true');
  document.body.classList.add('category-selector-open');
  categorySearch.focus();
}

function closeCategorySelector() {
  if (categorySelector.hidden) return;
  categorySelector.hidden = true;
  categorySelectorBackdrop.hidden = true;
  categoryOpen.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('category-selector-open');
  categoryOpen.focus();
}

function selectCategory(id, keepFiltersOpen = false) {
  categoryInput.value = id && getCategory(id) ? id : '';
  categorySearch.value = '';
  closeCategorySelector();
  renderListings('push');
  if (!keepFiltersOpen) closeFilters();
}

function resetFilters() {
  form.reset();
  searchInput.value = '';
  sortSelect.value = 'recommended';
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
categoryOpen.addEventListener('click', openCategorySelector);
document.getElementById('category-selector-close').addEventListener('click', closeCategorySelector);
categorySelectorBackdrop.addEventListener('click', closeCategorySelector);
categoryBranch.addEventListener('click', event => {
  const select = event.target.closest('[data-select-category]');
  if (select) {
    selectCategory(select.dataset.selectCategory, true);
    return;
  }
  const browse = event.target.closest('[data-browse-category]');
  if (browse) {
    browsedCategory = browse.dataset.browseCategory;
    categorySearch.value = '';
    renderCategoryBranch();
    categoryBranch.scrollTop = 0;
  }
});
breadcrumbs.addEventListener('click', event => handleCategoryLink(event, false));
categorySearch.addEventListener('input', () => renderCategoryBranch());

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
form.addEventListener('change', async event => {
  if (event.target === categorySearch) return;
  if (event.target.name === 'origin' && event.target.value === 'user') {
    try {
      const point = await requestUserLocation();
      setUserCoordinates(point);
      if (form.querySelector('[name="radius"]:checked')?.value === 'region') {
        form.querySelector('[name="radius"][value="30"]').checked = true;
      }
    } catch {
      form.querySelector('[name="origin"][value="center"]').checked = true;
      const city = CITY_LOCATIONS[form.elements.city.value] || CITY_LOCATIONS.tomsk;
      showToast(`Не удалось получить местоположение. Будем считать расстояние от центра ${city.genitive || city.name}.`);
    }
  }
  if (event.target.name === 'city') form.querySelector('[name="origin"][value="center"]').checked = true;
  renderListings();
});
form.addEventListener('input', event => {
  if (event.target === categorySearch || event.target.type === 'radio' || event.target.tagName === 'SELECT') return;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => renderListings(), 180);
});
document.addEventListener('location:changed', event => {
  const current = stateFromForm();
  setFormState({ ...current, location: event.detail.location });
  renderListings('push');
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
    if (!categorySelector.hidden) closeCategorySelector();
    else closeFilters();
    suggestions.hidden = true;
  }
  if (event.key !== 'Tab' || categorySelector.hidden) return;
  const focusable = [...categorySelector.querySelectorAll('button:not([disabled]), input:not([disabled])')];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!categorySelector.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
window.addEventListener('popstate', () => {
  closeCategorySelector();
  setFormState(stateFromUrl());
  categorySearch.value = '';
  renderListings('replace');
});
