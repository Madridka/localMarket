import {
  escapeHtml,
  formatPrice,
  getChats,
  getCurrentUser,
  getListingById,
  getSellerById,
  renderShell,
  safeImage,
  saveChats,
  showToast,
} from './common.js';

renderShell('messages');

const listElement = document.querySelector('#conversation-list');
const panelElement = document.querySelector('#chat-panel');
const layoutElement = document.querySelector('#messages-layout');
const params = new URLSearchParams(window.location.search);
let chats = getChats();
let selectedChatId = null;

const listingId = params.get('listing');
if (listingId !== null) {
  const listing = getListingById(listingId);
  if (!listing) {
    showToast('Объявление не найдено');
  } else if (String(listing.sellerId) === String(getCurrentUser().id)) {
    showToast('Это ваше объявление');
  } else {
    let chat = chats.find((item) => String(item.listingId) === String(listing.id));
    if (!chat) {
      chat = {
        id: `chat-${Date.now()}`,
        listingId: listing.id,
        sellerId: listing.sellerId,
        messages: [],
      };
      const nextChats = [chat, ...chats];
      if (saveChats(nextChats)) chats = nextChats;
      else chat = null;
    }
    if (chat) selectedChatId = String(chat.id);
  }
}

if (!selectedChatId) {
  const requestedChatId = params.get('chat');
  selectedChatId = requestedChatId && chats.some((chat) => String(chat.id) === requestedChatId)
    ? requestedChatId
    : (orderedChats()[0] ? String(orderedChats()[0].id) : null);
}

render();

listElement.addEventListener('click', (event) => {
  const button = event.target.closest('[data-chat-id]');
  if (!button) return;
  selectedChatId = button.dataset.chatId;
  layoutElement.classList.add('is-chat-open');
  history.replaceState(null, '', `messages.html?chat=${encodeURIComponent(selectedChatId)}`);
  render();
});

panelElement.addEventListener('click', (event) => {
  if (event.target.closest('[data-back-to-list]')) {
    layoutElement.classList.remove('is-chat-open');
  }
});

panelElement.addEventListener('submit', (event) => {
  if (event.target.id !== 'chat-form') return;
  event.preventDefault();
  const input = event.target.querySelector('#chat-input');
  const message = input.value.trim();
  if (!message) {
    input.focus();
    return;
  }
  const chat = chats.find((item) => String(item.id) === selectedChatId);
  if (!chat) return;
  const nextChats = chats.map((item) => String(item.id) === selectedChatId
    ? { ...item, messages: [...(item.messages || []), { sender: 'me', text: message, timestamp: new Date().toISOString() }] }
    : item);
  if (!saveChats(nextChats)) return;
  chats = nextChats;
  render();
  panelElement.querySelector('#chat-input')?.focus();
});

function orderedChats() {
  return [...chats].sort((a, b) => lastTimestamp(b) - lastTimestamp(a));
}

function lastTimestamp(chat) {
  const messages = chat.messages || [];
  const lastMessage = messages[messages.length - 1];
  return new Date(lastMessage?.timestamp || chat.createdAt || 0).getTime() || 0;
}

function render() {
  const ordered = orderedChats();
  const activeChat = chats.find((chat) => String(chat.id) === selectedChatId);
  listElement.innerHTML = `
    <div class="conversation-list__header"><h2>Диалоги</h2><span>${ordered.length}</span></div>
    ${ordered.length ? `<div class="conversation-list__items">${ordered.map(conversationItem).join('')}</div>` : `
      <div class="empty-state empty-state--compact conversation-list__empty">
        <div class="empty-state__icon" aria-hidden="true">✉</div>
        <h3>Пока нет диалогов</h3>
        <p>Нашли интересную вещь? Напишите продавцу прямо из объявления.</p>
        <a class="button button--secondary" href="index.html">Найти объявление</a>
      </div>`}`;
  panelElement.innerHTML = activeChat ? chatPanel(activeChat) : `
    <div class="chat-empty">
      <div class="chat-empty__icon" aria-hidden="true">✉</div>
      <h2>Здесь будет ваша переписка</h2>
      <p>Выберите диалог слева или найдите вещь, которая вам понравится.</p>
      <a class="button button--primary" href="index.html">Смотреть объявления</a>
    </div>`;
  const messageContainer = panelElement.querySelector('.chat-messages');
  if (messageContainer) messageContainer.scrollTop = messageContainer.scrollHeight;
  if (activeChat && params.has('listing')) layoutElement.classList.add('is-chat-open');
}

function conversationItem(chat) {
  const listing = getListingById(chat.listingId);
  const seller = getSellerById(chat.sellerId);
  const messages = chat.messages || [];
  const lastMessage = messages[messages.length - 1];
  const selected = String(chat.id) === selectedChatId;
  const name = seller?.name || 'Продавец';
  const preview = lastMessage
    ? `${lastMessage.sender === 'me' ? 'Вы: ' : ''}${lastMessage.text}`
    : 'Начните разговор';
  const time = lastMessage ? shortTime(lastMessage.timestamp) : '';
  const image = listing?.images?.[0];
  return `<button class="conversation-item ${selected ? 'is-active' : ''}" type="button" data-chat-id="${escapeHtml(chat.id)}" aria-current="${selected ? 'true' : 'false'}">
    <span class="conversation-item__avatar">${image ? `<img src="${escapeHtml(safeImage(image))}" alt="" loading="lazy">` : `<span aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span>`}</span>
      <span class="conversation-item__details">
      <span class="conversation-item__top"><strong class="conversation-item__name">${escapeHtml(name)}</strong><time class="conversation-item__time">${escapeHtml(time)}</time></span>
      <span class="conversation-item__product">${escapeHtml(listing?.title || 'Объявление удалено')}</span>
      <span class="conversation-item__preview">${escapeHtml(preview)}</span>
    </span>
  </button>`;
}

function chatPanel(chat) {
  const listing = getListingById(chat.listingId);
  const seller = getSellerById(chat.sellerId);
  const sellerName = seller?.name || 'Продавец';
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  return `
    <div class="chat-header">
      <button class="chat-back button button--text" type="button" data-back-to-list aria-label="К списку диалогов">←</button>
      <div class="chat-header__seller"><a class="chat-header__title" href="profile.html?id=${encodeURIComponent(chat.sellerId)}">${escapeHtml(sellerName)}</a><span class="chat-header__meta">${escapeHtml(seller?.city || 'Томская область')}</span></div>
      ${listing ? `<a class="chat-product" href="listing.html?id=${encodeURIComponent(listing.id)}">
        <img src="${escapeHtml(safeImage(listing.images?.[0]))}" alt="" loading="lazy">
        <span><strong>${escapeHtml(listing.title)}</strong><small>${escapeHtml(formatPrice(listing.price))}</small></span>
      </a>` : '<span class="chat-product chat-product--missing">Объявление удалено</span>'}
    </div>
    <div class="chat-messages" role="log" aria-label="Сообщения с ${escapeHtml(sellerName)}" aria-live="polite">
      ${messages.length ? messages.map(messageBubble).join('') : `<div class="chat-messages__intro"><strong>Начните разговор</strong><p>Поздоровайтесь и уточните детали товара. Общайтесь вежливо и встречайтесь в удобном месте.</p></div>`}
    </div>
    <form class="chat-composer" id="chat-form">
      <label class="sr-only" for="chat-input">Сообщение для ${escapeHtml(sellerName)}</label>
      <input id="chat-input" type="text" maxlength="1000" placeholder="Напишите сообщение…" autocomplete="off" required>
      <button class="button button--primary" type="submit">Отправить</button>
    </form>`;
}

function messageBubble(message) {
  const mine = message.sender === 'me';
  const text = escapeHtml(message.text || '').replace(/\n/g, '<br>');
  const time = shortTime(message.timestamp);
  return `<div class="message-bubble ${mine ? 'message-bubble--mine' : 'message-bubble--seller'}"><p>${text}</p><time datetime="${escapeHtml(message.timestamp || '')}">${escapeHtml(time)}</time></div>`;
}

function shortTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
}
