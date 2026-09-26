import {
  escapeHtml,
  getCurrentUser,
  getListings,
  getSellerById,
  listingCard,
  renderShell,
} from './common.js';
import { seedReviews } from './data.js';

renderShell('profile');

const content = document.querySelector('#profile-content');
const requestedId = new URLSearchParams(window.location.search).get('id');
const currentUser = getCurrentUser();
const isOwnProfile = requestedId === null || String(requestedId) === String(currentUser.id);
const seller = isOwnProfile ? currentUser : getSellerById(requestedId);

if (!seller) {
  document.title = 'Профиль не найден — Рядом';
  content.innerHTML = `
    <div class="empty-state profile-not-found">
      <div class="empty-state__icon" aria-hidden="true">◌</div>
      <h1>Профиль не найден</h1>
      <p>Возможно, ссылка устарела. Посмотрите другие объявления в Томской области.</p>
      <a class="button button--primary" href="index.html">Перейти в каталог</a>
    </div>`;
} else {
  renderProfile();
}

function renderProfile() {
  const sellerListings = getListings()
    .filter((listing) => String(listing.sellerId) === String(seller.id))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const reviews = Array.isArray(seedReviews)
    ? seedReviews.filter((review) => String(review.sellerId) === String(seller.id))
    : [];
  const name = escapeHtml(seller.name || 'Пользователь');
  const city = escapeHtml(seller.city || 'Томская область');
  const rating = Number(seller.rating);
  const ratingText = Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : '—';
  const reviewsCount = Number(seller.reviewsCount) || reviews.length;
  const memberSince = memberDate(seller.registeredAt);
  const avatar = seller.avatar
    ? `<img src="${escapeHtml(seller.avatar)}" alt="" loading="lazy">`
    : `<span aria-hidden="true">${escapeHtml((seller.name || '?').trim().slice(0, 1).toUpperCase())}</span>`;

  document.title = `${seller.name || 'Профиль'} — Рядом`;
  content.innerHTML = `
    <nav class="breadcrumbs" aria-label="Навигация"><a href="index.html">Главная</a><span aria-hidden="true">/</span><span>${isOwnProfile ? 'Мой профиль' : name}</span></nav>
    <div class="page-heading profile-page__heading">
      <div>
        <p class="eyebrow">${isOwnProfile ? 'Личная страница' : 'Продавец'}</p>
        <h1>${isOwnProfile ? 'Мой профиль' : 'Профиль продавца'}</h1>
      </div>
    </div>
    <section class="profile-header" aria-label="Информация о продавце">
      <div class="profile-avatar">${avatar}</div>
      <div class="profile-meta">
        <div class="profile-meta__title"><h2>${name}</h2>${seller.verifiedPhone ? '<span class="verified-badge" title="Телефон подтверждён">✓ Телефон подтверждён</span>' : ''}</div>
        <div class="profile-stats">
          <span class="profile-rating" aria-label="Рейтинг ${ratingText} из 5"><span aria-hidden="true">★</span> ${ratingText}</span>
          <span>${reviewsCount} ${pluralReviews(reviewsCount)}</span>
          <span>${city}</span>
        </div>
        <p class="profile-joined">${memberSince ? `На площадке с ${escapeHtml(memberSince)}` : 'На площадке Рядом'}${seller.responseTime ? ` · ${escapeHtml(seller.responseTime)}` : ''}</p>
      </div>
      ${isOwnProfile
        ? '<a class="button button--secondary profile-header__action" href="create.html">Разместить объявление</a>'
        : sellerListings.length ? `<a class="button button--primary profile-header__action" href="messages.html?listing=${encodeURIComponent(sellerListings[0].id)}">Написать продавцу</a>` : ''}
    </section>

    <section class="profile-listings seller-listings" aria-labelledby="profile-listings-title">
      <div class="section-heading"><div><p class="eyebrow">В продаже</p><h2 id="profile-listings-title">${isOwnProfile ? 'Мои объявления' : 'Объявления продавца'} <span class="section-count">${sellerListings.length}</span></h2></div></div>
      ${sellerListings.length
        ? `<div class="listing-grid">${sellerListings.map(listingCard).join('')}</div>`
        : `<div class="empty-state"><div class="empty-state__icon" aria-hidden="true">＋</div><h3>${isOwnProfile ? 'Пока нет объявлений' : 'Сейчас нет объявлений'}</h3><p>${isOwnProfile ? 'Добавьте первую вещь — покупатели в области увидят её.' : 'Загляните позже или посмотрите другие предложения в области.'}</p><a class="button button--primary" href="${isOwnProfile ? 'create.html' : 'index.html'}">${isOwnProfile ? 'Разместить объявление' : 'Смотреть объявления'}</a></div>`}
    </section>

    <section class="profile-reviews" aria-labelledby="profile-reviews-title">
      <div class="section-heading"><div><p class="eyebrow">Репутация</p><h2 id="profile-reviews-title">Отзывы <span class="section-count">${reviewsCount}</span></h2></div></div>
      ${reviews.length
        ? `<div class="reviews-grid">${reviews.slice(0, 6).map(reviewCard).join('')}</div>`
        : `<div class="empty-state empty-state--compact"><h3>Пока нет отзывов</h3><p>После первой сделки здесь появится мнение покупателя.</p></div>`}
    </section>`;
}

function reviewCard(review) {
  const author = escapeHtml(review.author || review.authorName || 'Покупатель');
  const date = dateLabel(review.date || review.createdAt);
  const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
  return `<article class="review-card">
    <div class="review-card__header"><strong>${author}</strong><span class="review-card__stars" aria-label="Оценка ${rating} из 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span></div>
    <p>${escapeHtml(review.text || review.comment || '')}</p>
    ${date ? `<time datetime="${escapeHtml(review.date || review.createdAt)}">${escapeHtml(date)}</time>` : ''}
  </article>`;
}

function memberDate(date) {
  if (!date || Number.isNaN(new Date(date).getTime())) return '';
  const value = new Date(date);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${months[value.getMonth()]} ${value.getFullYear()}`;
}

function dateLabel(date) {
  if (!date || Number.isNaN(new Date(date).getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
}

function pluralReviews(count) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return 'отзывов';
  if (last === 1) return 'отзыв';
  if (last > 1 && last < 5) return 'отзыва';
  return 'отзывов';
}
