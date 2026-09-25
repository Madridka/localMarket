import { cities, conditions } from './data.js';
import {
  categories as rootCategories, getCategory, getCategoryChildren,
  getCategoryPath, getDescendantCategoryIds, searchCategories,
} from './categories.js';
import {
  addRecentSearch, escapeHtml, getListings, getRecentSearches, getSavedSearches,
  icon, listingCard, renderShell, toggleSavedSearch,
} from './common.js';

renderShell('index');

const form = document.getElementById('filter-form');
const grid = document.getElementById('listing-grid');
const searchInput = document.getElementById('global-search');
const sortSelect = document.getElementById('sort-select');
const categoryNav = document.getElementById('category-nav');
const categoryInput = document.getElementById('filter-category');
const categorySearch = document.getElementById('category-search');
const categoryBranch = document.getElementById('category-branch');
const breadcrumbs = document.getElementById('catalog-breadcrumbs');
const suggestions = document.getElementById('recent-searches');
let searchTimer;
let filterTimer;

form.elements.city.innerHTML += cities.map(city => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join('');
document.getElementById('condition-options').innerHTML = conditions.map(condition => `<label><input type="checkbox" name="condition" value="${condition.id}"> ${escapeHtml(condition.label)}</label>`).join('');

function stateFromUrl() {
  const params = new URLSearchParams(location.search);
  return {
    query: params.get('q') || '',
    category: params.get('category') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    conditions: (params.get('condition') || '').split(',').filter(Boolean),
    radius: params.get('radius') || '',
    city: params.get('city') || '',
    sort: params.get('sort') || 'recommended',
  };
}

function stateFromForm() {
  return {
    query: searchInput.value.trim(),
    category: categoryInput.value,
    min: form.elements.min.value,
    max: form.elements.max.value,
    conditions: [...form.querySelectorAll('[name="condition"]:checked')].map(input => input.value),
    radius: form.querySelector('[name="radius"]:checked')?.value || '',
    city: form.elements.city.value,
    sort: sortSelect.value,
  };
}

function setFormState(state) {
  searchInput.value = state.query || '';
  categoryInput.value = getCategory(state.category)?.id || '';
  form.elements.min.value = state.min || '';
  form.elements.max.value = state.max || '';
  form.elements.city.value = state.city || '';
  sortSelect.value = state.sort || 'recommended';
  if (!sortSelect.value) sortSelect.value = 'recommended';
  form.querySelectorAll('[name="condition"]').forEach(input => {
    input.checked = (state.conditions || []).includes(input.value);
  });
  const radius = [...form.querySelectorAll('[name="radius"]')].find(input => input.value === (state.radius || ''));
  if (radius) radius.checked = true;
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
    if (state.radius && Number(listing.distance) > Number(state.radius)) return false;
    if (state.city && listing.city !== state.city) return false;
    return true;
  });
}

export function sortListings(listings, sort) {
  const items = [...listings];
  switch (sort) {
    case 'distance': return items.sort((a, b) => a.distance - b.distance || new Date(b.createdAt) - new Date(a.createdAt));
    case 'newest': return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'price-asc': return items.sort((a, b) => a.price - b.price);
    case 'price-desc': return items.sort((a, b) => b.price - a.price);
    default: return items.sort((a, b) => (a.distance * 0.65 + (Date.now() - new Date(a.createdAt)) / 86400000) - (b.distance * 0.65 + (Date.now() - new Date(b.createdAt)) / 86400000));
  }
}

function updateUrl(state, mode = 'replace') {
  if (mode === 'none') return;
  const url = new URL(location.href);
  ['q', 'category', 'min', 'max', 'condition', 'radius', 'city', 'sort'].forEach(key => url.searchParams.delete(key));
  if (state.query) url.searchParams.set('q', state.query);
  if (state.category) url.searchParams.set('category', state.category);
  if (state.min) url.searchParams.set('min', state.min);
  if (state.max) url.searchParams.set('max', state.max);
  if (state.conditions.length) url.searchParams.set('condition', state.conditions.join(','));
  if (state.radius) url.searchParams.set('radius', state.radius);
  if (state.city) url.searchParams.set('city', state.city);
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

function renderBreadcrumbs(active) {
  const path = getCategoryPath(active);
  breadcrumbs.hidden = !path.length;
  if (!path.length) {
    breadcrumbs.innerHTML = '';
    return;
  }
  breadcrumbs.innerHTML = `<a href="${escapeHtml(categoryHref(''))}" data-category="">Все категории</a>${path.map((node, index) => `<span aria-hidden="true">›</span>${index === path.length - 1 ? `<span aria-current="page">${escapeHtml(node.name)}</span>` : `<a href="${escapeHtml(categoryHref(node.id))}" data-category="${escapeHtml(node.id)}">${escapeHtml(node.name)}</a>`}`).join('')}`;
}

function branchLink(node) {
  return `<a class="category-branch__item" href="${escapeHtml(categoryHref(node.id))}" data-category="${escapeHtml(node.id)}"><span>${escapeHtml(node.name)}</span><span aria-hidden="true">›</span></a>`;
}

function renderCategoryBranch(active) {
  const query = categorySearch.value.trim();
  if (query) {
    const matches = searchCategories(query, 25);
    categoryBranch.innerHTML = matches.length
      ? matches.map(node => `<a class="category-branch__result" href="${escapeHtml(categoryHref(node.id))}" data-category="${escapeHtml(node.id)}">${getCategoryPath(node.id).map(part => escapeHtml(part.name)).join(' <span aria-hidden="true">›</span> ')}</a>`).join('')
      : '<p class="category-branch__empty">Категория не найдена</p>';
    return;
  }
  const path = getCategoryPath(active);
  const current = path[path.length - 1];
  const parent = path[path.length - 2];
  const children = current ? getCategoryChildren(current.id) : rootCategories;
  categoryBranch.innerHTML = `${current ? `<a class="category-branch__back" href="${escapeHtml(categoryHref(parent?.id || ''))}" data-category="${escapeHtml(parent?.id || '')}">‹ ${escapeHtml(parent?.name || 'Все категории')}</a><div class="category-branch__current" aria-current="page">${escapeHtml(current.name)}<small>Все объявления в категории</small></div>` : ''}${children.map(node => branchLink(node)).join('')}`;
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'объявление';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'объявления';
  return 'объявлений';
}

function updateSaveButton(state) {
  const saved = getSavedSearches().some(item => JSON.stringify(item) === JSON.stringify(state));
  const button = document.getElementById('save-search');
  button.classList.toggle('is-active', saved);
  button.querySelector('span').textContent = saved ? 'Поиск сохранён' : 'Сохранить поиск';
  button.setAttribute('aria-pressed', String(saved));
}

export function renderListings(mode = 'replace') {
  const state = stateFromForm();
  const listings = sortListings(filterListings(searchListings(getListings(), state.query), state), state.sort);
  updateUrl(state, mode);
  renderCategories(state.category);
  renderBreadcrumbs(state.category);
  renderCategoryBranch(state.category);
  updateSaveButton(state);
  document.getElementById('catalog-count').textContent = `${listings.length} ${plural(listings.length)}`;
  const category = getCategory(state.category);
  document.getElementById('catalog-title').textContent = state.query ? `Поиск: «${state.query}»` : category ? category.name : state.city ? `Объявления в городе ${state.city}` : 'Рядом с вами';
  grid.innerHTML = listings.length
    ? listings.map(listingCard).join('')
    : `<div class="empty-state"><div class="empty-state__icon">${icon('search', 30)}</div><h2>Ничего не нашли</h2><p>Попробуйте изменить фильтры или увеличить радиус поиска.</p><button class="button button--secondary" type="button" id="empty-reset">Сбросить фильтры</button></div>`;
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
  categorySearch.value = '';
  renderListings('push');
  if (!keepFiltersOpen || (id && !getCategoryChildren(id).length)) closeFilters();
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
  suggestions.innerHTML = `${recent.length ? `<div class="suggestion-heading">Недавние поиски</div>${recent.map(query => `<button type="button" data-recent-query="${escapeHtml(query)}">${icon('search', 15)} ${escapeHtml(query)}</button>`).join('')}` : ''}${saved.length ? `<div class="suggestion-heading">Сохранённые поиски</div>${saved.map((item, index) => `<button type="button" data-saved-index="${index}">${icon('heart', 15)} ${escapeHtml(item.query || getCategory(item.category)?.name || item.city || 'Все объявления')}</button>`).join('')}` : ''}`;
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
categoryBranch.addEventListener('click', event => handleCategoryLink(event, true));
breadcrumbs.addEventListener('click', event => handleCategoryLink(event, false));
categorySearch.addEventListener('input', () => renderCategoryBranch(categoryInput.value));

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
form.addEventListener('change', event => { if (event.target !== categorySearch) renderListings(); });
form.addEventListener('input', event => {
  if (event.target === categorySearch) return;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => renderListings(), 180);
});
document.getElementById('reset-filters').addEventListener('click', resetFilters);
grid.addEventListener('click', event => { if (event.target.closest('#empty-reset')) resetFilters(); });
document.getElementById('save-search').addEventListener('click', () => { toggleSavedSearch(stateFromForm()); updateSaveButton(stateFromForm()); });
document.getElementById('filter-toggle').addEventListener('click', () => {
  document.getElementById('filter-sidebar').classList.add('is-open');
  document.getElementById('filter-backdrop').hidden = false;
  document.getElementById('filter-toggle').setAttribute('aria-expanded', 'true');
  document.body.classList.add('filters-open');
});
document.getElementById('filter-close').addEventListener('click', closeFilters);
document.getElementById('filter-backdrop').addEventListener('click', closeFilters);
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeFilters(); suggestions.hidden = true; } });
window.addEventListener('popstate', () => {
  setFormState(stateFromUrl());
  categorySearch.value = '';
  renderListings('none');
});
