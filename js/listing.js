import {
  addChatMessage, escapeHtml, formatDate, formatDistance, formatPrice,
  getCategory, getCondition, getListingById, getRecent, getSellerById,
  icon, isFavorite, listingCard, markViewed, renderShell, safeImage, showToast,
} from './common.js';
import { getCategoryAttributes, getCategoryPath } from './categories.js';

renderShell('');

const main = document.getElementById('listing-main');
const listing = getListingById(new URLSearchParams(location.search).get('id'));
if (!listing) {
  document.title = 'Объявление не найдено — Рядом';
  main.innerHTML = `<div class="empty-state"><h1>Объявление не найдено</h1><p>Возможно, ссылка устарела или объявление удалено.</p><a class="button button--primary" href="index.html">К объявлениям</a></div>`;
} else {
  const seller = getSellerById(listing.sellerId);
  const category = getCategory(listing.categoryId);
  const categoryPath = getCategoryPath(listing.categoryId);
  const attributeDefinitions = getCategoryAttributes(listing.categoryId);
  const condition = getCondition(listing.condition);
  const viewedBefore = getRecent().filter(id => String(id) !== String(listing.id));
  markViewed(listing.id);
  document.title = `${listing.title} — Рядом`;
  const images = (listing.images?.length ? listing.images : ['./assets/placeholder.svg']).map(safeImage);
  const ownListing = Number(listing.sellerId) === 0;
  main.innerHTML = `
    <nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="index.html">Все объявления</a>${categoryPath.map((node) => `<span aria-hidden="true">›</span><a href="index.html?category=${encodeURIComponent(node.id)}">${escapeHtml(node.name)}</a>`).join('')}<span aria-hidden="true">›</span><span>${escapeHtml(listing.title)}</span></nav>
    <div class="listing-layout">
      <section class="gallery" aria-label="Фотографии товара">
        <div class="gallery-main"><img id="gallery-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(listing.title)} — фото 1"><button type="button" class="gallery-arrow gallery-arrow--prev" id="gallery-prev" aria-label="Предыдущее фото" ${images.length === 1 ? 'hidden' : ''}>${icon('arrowLeft', 24)}</button><button type="button" class="gallery-arrow gallery-arrow--next" id="gallery-next" aria-label="Следующее фото" ${images.length === 1 ? 'hidden' : ''}>${icon('arrowRight', 24)}</button><span class="gallery-counter" id="gallery-counter">1 / ${images.length}</span></div>
        ${images.length > 1 ? `<div class="gallery-thumbnails" id="gallery-thumbnails">${images.map((image, index) => `<button class="gallery-thumbnail ${index === 0 ? 'is-active' : ''}" type="button" data-photo-index="${index}" aria-label="Показать фото ${index + 1}" aria-pressed="${index === 0}"><img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)} — миниатюра ${index + 1}"></button>`).join('')}</div>` : ''}
      </section>
      <aside class="listing-info">
        <p class="listing-kicker">${escapeHtml(category?.name || 'Объявление')} · ${escapeHtml(formatDate(listing.createdAt))}</p>
        <div class="listing-price">${formatPrice(listing.price)}</div>
        <h1 class="listing-title">${escapeHtml(listing.title)}</h1>
        <div class="listing-facts"><div><span>Состояние</span><strong>${escapeHtml(condition?.label || 'Не указано')}</strong></div><div><span>Местоположение</span><strong>${icon('pin', 17)} ${escapeHtml(formatDistance(listing))} от вас</strong></div></div>
        <div class="listing-actions">${ownListing ? `<a class="button button--primary" href="create.html?edit=${encodeURIComponent(listing.id)}">Редактировать объявление</a><span class="own-listing-note">Это ваше объявление</span>` : `<a class="button button--primary" href="messages.html?listing=${encodeURIComponent(listing.id)}">${icon('chat', 19)} Написать продавцу</a><button class="button button--secondary" type="button" id="open-offer">Предложить цену</button>`}<button class="button button--text detail-favorite ${isFavorite(listing.id) ? 'is-active' : ''}" type="button" data-favorite-id="${escapeHtml(listing.id)}" aria-pressed="${isFavorite(listing.id)}" aria-label="${isFavorite(listing.id) ? 'Убрать из избранного' : 'Добавить в избранное'}">${icon('heart', 20)} <span>В избранное</span></button></div>
        <section class="seller-card" aria-label="Продавец"><div class="seller-card__top"><div class="seller-avatar">${escapeHtml((seller?.name || 'П').slice(0, 1))}</div><div><strong>${escapeHtml(seller?.name || 'Продавец')}</strong><p>${seller?.rating ? `★ ${seller.rating} · ${seller.reviewsCount} отзывов` : 'Новый продавец'}</p></div></div><div class="seller-card__details"><span>${seller?.verifiedPhone ? '✓ Телефон подтверждён' : 'Пользователь площадки'}</span><span>${escapeHtml(seller?.responseTime || 'Отвечает в течение дня')}</span></div><a href="profile.html?id=${encodeURIComponent(seller?.id ?? 0)}">Профиль продавца ${icon('arrowRight', 16)}</a></section>
      </aside>
    </div>
    <section class="description-section"><h2>Описание</h2><p>${escapeHtml(listing.description).replace(/\n/g, '<br>')}</p>${attributeDefinitions.some((attribute) => listing.attributes?.[attribute.id] !== undefined && listing.attributes[attribute.id] !== '') ? `<div class="listing-attributes"><h3>Характеристики</h3><dl>${attributeDefinitions.filter((attribute) => listing.attributes?.[attribute.id] !== undefined && listing.attributes[attribute.id] !== '').map((attribute) => `<div><dt>${escapeHtml(attribute.label)}</dt><dd>${escapeHtml(listing.attributes[attribute.id])}</dd></div>`).join('')}</dl></div>` : ''}<div class="description-meta"><span>${icon('pin', 17)} ${escapeHtml(formatDistance(listing))}</span><span>${Number(listing.views || 0) + 1} просмотров</span></div></section>
    ${viewedBefore.length ? `<section class="recently-viewed"><div class="section-heading"><h2>Вы недавно смотрели</h2><a href="index.html">Все объявления ${icon('arrowRight', 16)}</a></div><div class="listing-grid">${viewedBefore.map(getListingById).filter(Boolean).slice(0, 4).map(listingCard).join('')}</div></section>` : ''}`;

  let activePhoto = 0;
  function showPhoto(index) {
    activePhoto = (index + images.length) % images.length;
    const image = document.getElementById('gallery-image');
    image.src = images[activePhoto];
    image.alt = `${listing.title} — фото ${activePhoto + 1}`;
    document.getElementById('gallery-counter').textContent = `${activePhoto + 1} / ${images.length}`;
    document.querySelectorAll('[data-photo-index]').forEach(button => {
      const active = Number(button.dataset.photoIndex) === activePhoto;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  document.getElementById('gallery-prev')?.addEventListener('click', () => showPhoto(activePhoto - 1));
  document.getElementById('gallery-next')?.addEventListener('click', () => showPhoto(activePhoto + 1));
  document.getElementById('gallery-thumbnails')?.addEventListener('click', event => {
    const button = event.target.closest('[data-photo-index]');
    if (button) showPhoto(Number(button.dataset.photoIndex));
  });
  document.addEventListener('keydown', event => {
    if (document.getElementById('offer-modal-root').hasChildNodes()) return;
    if (event.key === 'ArrowLeft') showPhoto(activePhoto - 1);
    if (event.key === 'ArrowRight') showPhoto(activePhoto + 1);
  });

  function closeOffer() {
    document.getElementById('offer-modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
    document.getElementById('open-offer')?.focus();
  }
  document.getElementById('open-offer')?.addEventListener('click', () => {
    const root = document.getElementById('offer-modal-root');
    root.innerHTML = `<div class="modal-backdrop is-open" id="offer-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="offer-heading"><button class="modal-close" id="close-offer" type="button" aria-label="Закрыть">${icon('close', 20)}</button><h2 id="offer-heading">Предложить свою цену</h2><p class="modal-intro">${escapeHtml(listing.title)}</p><div class="offer-original"><span>Цена продавца</span><strong>${formatPrice(listing.price)}</strong></div><form id="offer-form"><label for="offer-price">Ваше предложение, ₽</label><input id="offer-price" type="number" inputmode="numeric" min="1" max="${Math.max(1, listing.price - 1)}" placeholder="Например, ${Math.round(listing.price * 0.9 / 100) * 100}" required><p class="form-error" id="offer-error" aria-live="polite"></p><div class="modal-actions"><button type="button" class="button button--secondary" id="cancel-offer">Отмена</button><button type="submit" class="button button--primary">Отправить</button></div></form></div></div>`;
    document.body.classList.add('modal-open');
    document.getElementById('offer-price').focus();
    document.getElementById('close-offer').addEventListener('click', closeOffer);
    document.getElementById('cancel-offer').addEventListener('click', closeOffer);
    document.getElementById('offer-backdrop').addEventListener('click', event => { if (event.target.id === 'offer-backdrop') closeOffer(); });
    document.getElementById('offer-form').addEventListener('submit', event => {
      event.preventDefault();
      const price = Number(document.getElementById('offer-price').value);
      if (!Number.isFinite(price) || price <= 0 || price >= listing.price) {
        document.getElementById('offer-error').textContent = 'Укажите сумму меньше цены продавца.';
        return;
      }
      addChatMessage(listing.id, `Здравствуйте! Предлагаю ${formatPrice(price)} за «${listing.title}».`);
      closeOffer();
      showToast('Предложение отправлено продавцу');
    });
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.getElementById('offer-modal-root').hasChildNodes()) closeOffer(); });
}
