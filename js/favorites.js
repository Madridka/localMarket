import { getFavorites, getListingById, icon, listingCard, renderShell } from './common.js';

renderShell('favorites');

function renderFavorites() {
  const listings = getFavorites().map(getListingById).filter(Boolean);
  document.getElementById('favorites-count').textContent = listings.length ? `${listings.length} сохранённых объявлений` : '';
  document.getElementById('favorites-grid').innerHTML = listings.length
    ? listings.map(listingCard).join('')
    : `<div class="empty-state"><div class="empty-state__icon">${icon('heart', 30)}</div><h2>Здесь пока пусто</h2><p>Нажимайте ♡ на объявлениях, которые хотите сохранить.</p><a class="button button--primary" href="index.html">Найти объявления</a></div>`;
}

document.addEventListener('favorites:changed', renderFavorites);
renderFavorites();
