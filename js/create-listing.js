import { cities, conditions } from './data.js';
import {
  categories, getCategory, getCategoryAttributes, getCategoryChildren,
  getCategoryPath, isLeafCategory, searchCategories,
} from './categories.js';
import {
  addListing, escapeHtml, getCurrentUser, getListingById,
  renderShell, showToast, updateListing,
} from './common.js';

renderShell('create');

const form = document.querySelector('#create-form');
const photoInput = document.querySelector('#listing-photos');
const photoDropzone = document.querySelector('#photo-dropzone');
const photoPreviews = document.querySelector('#photo-previews');
const publishButton = document.querySelector('#publish-button');
const categoryInput = document.querySelector('#listing-category');
const categorySearch = document.querySelector('#listing-category-search');
const categorySearchResults = document.querySelector('#category-search-results');
const categoryBreadcrumbs = document.querySelector('#category-breadcrumbs');
const categoryOptions = document.querySelector('#category-options');
const categoryCurrentTitle = document.querySelector('#category-current-title');
const categoryBack = document.querySelector('#category-back');
const categoryAttributes = document.querySelector('#category-attributes');
const MAX_PHOTOS = 6;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const photos = [];
const editId = new URLSearchParams(window.location.search).get('edit');
const editing = editId ? getListingById(editId) : null;
let currentCategoryId = null;
let processingPhotos = false;

fillSelect('listing-condition', conditions, 'Выберите состояние');
fillSelect('listing-city', cities, 'Выберите город');
document.querySelector('#listing-city').value = getCurrentUser().city || 'Томск';
renderCategoryPicker();

if (editId) {
  if (!editing || Number(editing.sellerId) !== getCurrentUser().id) {
    document.querySelector('.create-form').innerHTML = '<div class="empty-state"><h2>Объявление недоступно для редактирования</h2><a class="button button--primary" href="profile.html">В профиль</a></div>';
  } else {
    document.title = 'Редактировать объявление — Рядом';
    document.querySelector('.create-heading h1').textContent = 'Редактировать объявление';
    document.querySelector('.create-heading .eyebrow').textContent = 'Моё объявление';
    publishButton.textContent = 'Сохранить изменения';
    form.elements.title.value = editing.title || '';
    form.elements.description.value = editing.description || '';
    form.elements.condition.value = editing.condition || '';
    form.elements.price.value = editing.price ?? '';
    form.elements.city.value = editing.city || getCurrentUser().city;
    (editing.images || []).forEach((dataUrl, index) => photos.push({ name: `Фото ${index + 1}`, dataUrl }));
    renderPhotos();
    if (getCategory(editing.categoryId)) selectCategory(editing.categoryId, editing.attributes || {});
  }
}

categorySearch.addEventListener('input', renderCategorySearch);
categorySearchResults.addEventListener('click', (event) => {
  const button = event.target.closest('[data-search-category]');
  if (!button) return;
  chooseCategory(button.dataset.searchCategory);
  categorySearch.value = '';
  categorySearchResults.hidden = true;
});
categoryOptions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-choose-category]');
  if (button) chooseCategory(button.dataset.chooseCategory);
});
categoryBreadcrumbs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-browse-category]');
  if (button) browseCategory(button.dataset.browseCategory || null);
});
categoryBack.addEventListener('click', () => {
  const path = currentCategoryId ? getCategoryPath(currentCategoryId) : [];
  browseCategory(path.length > 1 ? path[path.length - 2].id : null);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('#category-search-results') && event.target !== categorySearch) categorySearchResults.hidden = true;
});

photoDropzone.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', async () => {
  await addPhotos(photoInput.files);
  photoInput.value = '';
});

for (const eventName of ['dragenter', 'dragover']) {
  photoDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    photoDropzone.classList.add('is-dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  photoDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    photoDropzone.classList.remove('is-dragging');
  });
}
photoDropzone.addEventListener('drop', async (event) => {
  await addPhotos(event.dataTransfer?.files || []);
});

photoPreviews.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove-photo]');
  if (!removeButton) return;
  photos.splice(Number(removeButton.dataset.removePhoto), 1);
  renderPhotos();
});

form.addEventListener('input', (event) => {
  if (event.target.name) clearError(event.target.name);
});
form.addEventListener('change', (event) => {
  if (event.target.name) clearError(event.target.name);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (processingPhotos) {
    showToast('Подождите, фотографии ещё обрабатываются');
    return;
  }
  if (!validate()) return;

  const data = new FormData(form);
  const city = String(data.get('city')).trim();
  const payload = {
    title: String(data.get('title')).trim(),
    categoryId: String(data.get('categoryId')),
    attributes: Object.fromEntries([...categoryAttributes.querySelectorAll('[data-attribute-id]')]
      .map((control) => [control.dataset.attributeId, control.value.trim()])
      .filter(([, value]) => value !== '')),
    description: String(data.get('description')).trim(),
    condition: String(data.get('condition')),
    price: Number(data.get('price')),
    city,
    distance: cityDistance(city),
    images: photos.map((photo) => photo.dataUrl),
  };
  const listing = editing ? updateListing(editing.id, payload) : addListing(payload);
  if (!listing) return;
  publishButton.disabled = true;
  publishButton.textContent = editing ? 'Сохранено ✓' : 'Опубликовано ✓';
  showToast(editing ? 'Изменения сохранены' : 'Объявление опубликовано');
  window.setTimeout(() => {
    window.location.href = `listing.html?id=${encodeURIComponent(listing.id)}`;
  }, 850);
});

function renderCategoryPicker() {
  const current = currentCategoryId ? getCategory(currentCategoryId) : null;
  const path = current ? getCategoryPath(current.id) : [];
  const children = current ? getCategoryChildren(current.id) : categories;
  categoryCurrentTitle.textContent = current?.name || 'Выберите категорию';
  categoryBack.hidden = !current;
  categoryBreadcrumbs.innerHTML = `<button type="button" data-browse-category="">Все категории</button>${path.map((node) => `<span aria-hidden="true">›</span><button type="button" data-browse-category="${escapeHtml(node.id)}">${escapeHtml(node.name)}</button>`).join('')}`;
  categoryOptions.innerHTML = children.length
    ? children.map((node) => `<button type="button" data-choose-category="${escapeHtml(node.id)}" class="category-picker__option ${categoryInput.value === node.id ? 'is-selected' : ''}"><span>${escapeHtml(node.name)}</span><span aria-hidden="true">${isLeafCategory(node.id) ? '✓' : '›'}</span></button>`).join('')
    : '<p class="form-hint">Выбрана конечная категория.</p>';
}

function browseCategory(id) {
  currentCategoryId = id && getCategory(id) ? id : null;
  if (categoryInput.value && currentCategoryId && !getCategoryPath(categoryInput.value).some((node) => node.id === currentCategoryId)) {
    categoryInput.value = '';
    renderAttributes();
  }
  renderCategoryPicker();
}

function chooseCategory(id) {
  if (!getCategory(id)) return;
  if (isLeafCategory(id)) selectCategory(id);
  else browseCategory(id);
}

function selectCategory(id, storedAttributes = {}) {
  if (!isLeafCategory(id)) return;
  categoryInput.value = id;
  currentCategoryId = getCategoryPath(id).at(-2)?.id || null;
  renderCategoryPicker();
  renderAttributes(storedAttributes);
  clearError('category');
}

function renderCategorySearch() {
  const query = categorySearch.value.trim();
  if (!query) {
    categorySearchResults.hidden = true;
    return;
  }
  const matches = searchCategories(query, 20);
  categorySearchResults.innerHTML = matches.length
    ? matches.map((node) => `<button type="button" data-search-category="${escapeHtml(node.id)}"><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(getCategoryPath(node.id).map((part) => part.name).join(' › '))}</small></button>`).join('')
    : '<p>Категория не найдена. Посмотрите соседние разделы или выберите «Другое».</p>';
  categorySearchResults.hidden = false;
}

function renderAttributes(values = {}) {
  const definitions = categoryInput.value ? getCategoryAttributes(categoryInput.value) : [];
  categoryAttributes.hidden = !definitions.length;
  if (!definitions.length) {
    categoryAttributes.innerHTML = '';
    return;
  }
  categoryAttributes.innerHTML = `<h2>Характеристики товара</h2><p class="form-hint">Помогут покупателю быстрее найти вашу вещь.</p><div class="category-attributes__grid">${definitions.map((attribute) => {
    const id = `attribute-${attribute.id}`;
    const value = values[attribute.id] ?? '';
    const control = attribute.type === 'select'
      ? `<select id="${escapeHtml(id)}" data-attribute-id="${escapeHtml(attribute.id)}"><option value="">Не указано</option>${(attribute.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`
      : `<input id="${escapeHtml(id)}" data-attribute-id="${escapeHtml(attribute.id)}" type="${attribute.type === 'number' ? 'number' : 'text'}" ${attribute.type === 'number' ? 'min="0" step="any"' : 'maxlength="100"'} value="${escapeHtml(value)}">`;
    return `<div class="form-field"><label for="${escapeHtml(id)}">${escapeHtml(attribute.label)}</label>${control}</div>`;
  }).join('')}</div>`;
}

function fillSelect(id, entries, placeholder) {
  const select = document.getElementById(id);
  const options = (Array.isArray(entries) ? entries : []).map((entry) => {
    const value = typeof entry === 'string' ? entry : entry.id ?? entry.value ?? entry.name;
    const label = typeof entry === 'string' ? entry : entry.name ?? entry.label ?? entry.title ?? value;
    return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  });
  select.innerHTML = `<option value="">${placeholder}</option>${options.join('')}`;
}

async function addPhotos(fileList) {
  if (processingPhotos) return;
  const files = [...fileList];
  if (!files.length) return;
  if (photos.length >= MAX_PHOTOS) {
    showToast('Можно добавить до 6 фотографий');
    return;
  }
  if (files.length + photos.length > MAX_PHOTOS) showToast('Добавим только первые 6 фотографий');

  processingPhotos = true;
  photoDropzone.disabled = true;
  photoDropzone.classList.add('is-processing');
  try {
    for (const file of files.slice(0, MAX_PHOTOS - photos.length)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showToast('Подойдут фотографии JPG, PNG или WebP');
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        showToast(`Файл «${file.name}» слишком большой`);
        continue;
      }
      try {
        photos.push({ name: file.name, dataUrl: await compressImage(file) });
        renderPhotos();
        clearError('photos');
      } catch {
        showToast(`Не удалось загрузить «${file.name}»`);
      }
    }
  } finally {
    processingPhotos = false;
    photoDropzone.disabled = false;
    photoDropzone.classList.remove('is-processing');
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')); };
    image.src = url;
  });
}

function renderPhotos() {
  photoPreviews.innerHTML = photos.map((photo, index) => `<div class="photo-preview__item">
    <img src="${photo.dataUrl}" alt="Фотография ${index + 1}: ${escapeHtml(photo.name)}">
    ${index === 0 ? '<span class="photo-preview__cover">Обложка</span>' : ''}
    <button type="button" data-remove-photo="${index}" aria-label="Удалить фотографию ${index + 1}">×</button>
  </div>`).join('');
  photoDropzone.hidden = photos.length >= MAX_PHOTOS;
}

function validate() {
  const values = Object.fromEntries(new FormData(form));
  const errors = {
    title: String(values.title || '').trim() ? '' : 'Укажите название вещи',
    category: values.categoryId && isLeafCategory(values.categoryId) ? '' : 'Выберите конечную категорию',
    photos: photos.length ? '' : 'Добавьте хотя бы одну фотографию',
    description: String(values.description || '').trim() ? '' : 'Расскажите о вещи',
    condition: values.condition ? '' : 'Выберите состояние',
    price: values.price === '' || values.price === undefined || Number(values.price) < 0 || !Number.isFinite(Number(values.price)) ? 'Укажите цену от 0 ₽' : '',
    city: values.city ? '' : 'Выберите город',
  };
  Object.entries(errors).forEach(([field, message]) => setError(field, message));
  const firstError = Object.keys(errors).find((field) => errors[field]);
  if (firstError) {
    const target = firstError === 'photos' ? photoDropzone : firstError === 'category' ? categorySearch : form.elements[firstError];
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Проверьте обязательные поля');
    return false;
  }
  return true;
}

function setError(field, message) {
  const error = form.querySelector(`[data-error-for="${field}"]`);
  if (error) error.textContent = message;
  const control = field === 'photos' ? photoDropzone : field === 'category' ? categorySearch : form.elements[field];
  if (control) control.setAttribute('aria-invalid', String(Boolean(message)));
}

function clearError(field) { setError(field, ''); }

function cityDistance(city) {
  const known = {
    'Томск': 1.2,
    'Северск': 17,
    'Асино': 105,
    'Колпашево': 275,
    'Стрежевой': 860,
    'Кедровый': 540,
    'Мельниково': 60,
  };
  return known[city] ?? 17;
}
