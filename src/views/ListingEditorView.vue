<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import EmptyState from '@/components/ui/EmptyState.vue'
import { conditions } from '@/data/seed'
import {
  categories,
  getCategory,
  getCategoryAttributes,
  getCategoryChildren,
  getCategoryPath,
  isLeafCategory,
  searchCategories,
} from '@/data/taxonomy'
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from '@/domain/constants'
import { CITY_LOCATIONS, createLocationCell } from '@/domain/location'
import type { ConditionId, ListingDraft } from '@/domain/types'
import { compressImage } from '@/services/imageProcessor'
import { useListingsStore } from '@/stores/listings'
import { useLocationStore } from '@/stores/location'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

interface PhotoDraft {
  name: string
  dataUrl: string
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const listings = useListingsStore()
const session = useSessionStore()
const location = useLocationStore()
const ui = useUiStore()
const fileInput = ref<HTMLInputElement | null>(null)
const editingId = computed(() => String(route.params.id ?? ''))
const editing = computed(() => Boolean(editingId.value))
const unavailable = ref(false)
const processing = ref(false)
const submitting = ref(false)
const currentCategoryId = ref<string | null>(null)
const categorySearch = ref('')
const searchOpen = ref(false)
const photos = ref<PhotoDraft[]>([])
const attributes = reactive<Record<string, string>>({})
const errors = reactive<Record<string, string>>({})
const form = reactive({
  title: '',
  categoryId: '',
  description: '',
  condition: '' as ConditionId | '',
  price: '' as number | '',
  cityId: location.state.cityId,
  address: '',
})

const currentCategory = computed(() =>
  currentCategoryId.value ? getCategory(currentCategoryId.value) : null,
)
const categoryPath = computed(() =>
  currentCategory.value ? getCategoryPath(currentCategory.value.id) : [],
)
const categoryOptions = computed(() =>
  currentCategory.value ? getCategoryChildren(currentCategory.value.id) : categories,
)
const attributeDefinitions = computed(() => getCategoryAttributes(form.categoryId))
const categoryMatches = computed(() =>
  categorySearch.value.trim() ? searchCategories(categorySearch.value, 20) : [],
)

function browseCategory(id: string | null): void {
  currentCategoryId.value = id && getCategory(id) ? id : null
}

function chooseCategory(id: string): void {
  if (isLeafCategory(id)) {
    form.categoryId = id
    currentCategoryId.value = getCategoryPath(id).at(-2)?.id ?? null
    clearError('category')
    categorySearch.value = ''
    searchOpen.value = false
    return
  }
  browseCategory(id)
}

function goBackCategory(): void {
  browseCategory(categoryPath.value.at(-2)?.id ?? null)
}

function clearError(field: string): void {
  errors[field] = ''
}

async function addPhotos(fileList: FileList | File[]): Promise<void> {
  if (processing.value) return
  const files = [...fileList]
  if (!files.length) return
  if (photos.value.length >= MAX_PHOTOS) {
    ui.toast(t('editor.errors.maxPhotos'))
    return
  }
  processing.value = true
  try {
    for (const file of files.slice(0, MAX_PHOTOS - photos.value.length)) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        ui.toast(t('editor.errors.format'))
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        ui.toast(t('editor.errors.tooLarge', { name: file.name }))
        continue
      }
      try {
        photos.value.push({ name: file.name, dataUrl: await compressImage(file) })
        clearError('photos')
      } catch {
        ui.toast(t('editor.errors.failed', { name: file.name }))
      }
    }
  } finally {
    processing.value = false
  }
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files) void addPhotos(input.files)
  input.value = ''
}

function onDrop(event: DragEvent): void {
  if (event.dataTransfer?.files) void addPhotos(event.dataTransfer.files)
}

function validate(): boolean {
  Object.assign(errors, {
    title: form.title.trim() ? '' : t('editor.errors.title'),
    category: isLeafCategory(form.categoryId) ? '' : t('editor.errors.category'),
    photos: photos.value.length ? '' : t('editor.errors.photos'),
    description: form.description.trim() ? '' : t('editor.errors.description'),
    condition: form.condition ? '' : t('editor.errors.condition'),
    price:
      form.price !== '' && Number.isFinite(Number(form.price)) && Number(form.price) >= 0
        ? ''
        : t('editor.errors.price'),
    cityId: form.cityId ? '' : t('editor.errors.city'),
    address: form.address.trim() ? '' : t('editor.errors.address'),
  })
  const invalid = Object.values(errors).some(Boolean)
  if (invalid) ui.toast(t('editor.errors.form'))
  return !invalid
}

async function submit(): Promise<void> {
  if (processing.value) {
    ui.toast(t('editor.errors.processing'))
    return
  }
  if (!validate()) return
  const city = CITY_LOCATIONS[form.cityId]!
  const draft: ListingDraft = {
    title: form.title.trim(),
    categoryId: form.categoryId,
    attributes: Object.fromEntries(
      Object.entries(attributes).filter(([, value]) => value.trim() !== ''),
    ),
    description: form.description.trim(),
    condition: form.condition as ConditionId,
    price: Number(form.price),
    cityId: city.id,
    city: city.name,
    regionId: city.regionId,
    address: form.address.trim(),
    locationCell: createLocationCell(city.centerLat, city.centerLng, city.id),
    images: photos.value.map((photo) => photo.dataUrl),
  }
  submitting.value = true
  try {
    const result = editing.value
      ? await listings.update(editingId.value, draft)
      : await listings.create(draft)
    if (!result) {
      unavailable.value = true
      return
    }
    ui.toast(t(editing.value ? 'editor.saved' : 'editor.published'))
    await router.push({ name: 'listing', params: { id: result.id } })
  } catch {
    ui.toast(t('toast.storage'))
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([listings.load(), session.load()])
  if (!editing.value) return
  const item = await listings.get(editingId.value)
  if (!item || item.sellerId !== session.user?.id) {
    unavailable.value = true
    return
  }
  Object.assign(form, {
    title: item.title,
    categoryId: item.categoryId,
    description: item.description,
    condition: item.condition,
    price: item.price,
    cityId: item.cityId,
    address: item.address,
  })
  Object.assign(attributes, item.attributes ?? {})
  photos.value = item.images.map((dataUrl, index) => ({
    name: t('editor.photoName', { number: index + 1 }),
    dataUrl,
  }))
  currentCategoryId.value = getCategoryPath(item.categoryId).at(-2)?.id ?? null
})
</script>

<template>
  <main class="page-container create-page" tabindex="-1">
    <div class="page-heading create-heading">
      <div>
        <p class="eyebrow">{{ t(editing ? 'editor.editEyebrow' : 'editor.createEyebrow') }}</p>
        <h1>{{ t(editing ? 'editor.editTitle' : 'editor.createTitle') }}</h1>
        <p class="page-subtitle">{{ t('editor.createSubtitle') }}</p>
      </div>
    </div>
    <EmptyState v-if="unavailable" :title="t('editor.unavailable')"
      ><RouterLink class="button button--primary" :to="{ name: 'profile-me' }">{{
        t('nav.profile')
      }}</RouterLink></EmptyState
    >
    <form v-else class="create-form" novalidate @submit.prevent="submit">
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label for="listing-title">{{ t('editor.title') }} *</label
          ><input
            id="listing-title"
            v-model="form.title"
            type="text"
            maxlength="100"
            :placeholder="t('editor.titlePlaceholder')"
            @input="clearError('title')"
          /><small class="form-hint">{{ t('editor.titleHint') }}</small
          ><span class="form-error">{{ errors.title }}</span>
        </div>
        <div class="form-field form-field--full">
          <label for="category-search">{{ t('editor.category') }} *</label>
          <input
            id="category-search"
            v-model="categorySearch"
            type="search"
            :placeholder="t('editor.categorySearch')"
            @focus="searchOpen = true"
          />
          <div v-if="searchOpen && categorySearch" class="category-search-results">
            <button
              v-for="match in categoryMatches"
              :key="match.id"
              type="button"
              @click="chooseCategory(match.id)"
            >
              <strong>{{ match.name }}</strong
              ><small>{{
                getCategoryPath(match.id)
                  .map((part) => part.name)
                  .join(' › ')
              }}</small>
            </button>
          </div>
          <nav class="category-picker__breadcrumbs">
            <button type="button" @click="browseCategory(null)">
              {{ t('editor.allCategories') }}</button
            ><template v-for="part in categoryPath" :key="part.id"
              ><span>›</span
              ><button type="button" @click="browseCategory(part.id)">
                {{ part.name }}
              </button></template
            >
          </nav>
          <div class="category-picker__toolbar">
            <span>{{ currentCategory?.name ?? t('editor.chooseCategory') }}</span
            ><button v-if="currentCategory" type="button" @click="goBackCategory">
              {{ t('common.back') }}
            </button>
          </div>
          <div class="category-picker__options">
            <button
              v-for="option in categoryOptions"
              :key="option.id"
              type="button"
              class="category-picker__option"
              :class="{ 'is-selected': form.categoryId === option.id }"
              @click="chooseCategory(option.id)"
            >
              <span>{{ option.name }}</span
              ><span>{{ isLeafCategory(option.id) ? '✓' : '›' }}</span>
            </button>
          </div>
          <span class="form-error">{{ errors.category }}</span>
        </div>
        <div
          v-if="attributeDefinitions.length"
          class="form-field form-field--full category-attributes"
        >
          <h2>{{ t('editor.attributes') }}</h2>
          <p class="form-hint">{{ t('editor.attributesHint') }}</p>
          <div class="category-attributes__grid">
            <div v-for="attribute in attributeDefinitions" :key="attribute.id" class="form-field">
              <label :for="`attribute-${attribute.id}`">{{ attribute.label }}</label
              ><select
                v-if="attribute.type === 'select'"
                :id="`attribute-${attribute.id}`"
                v-model="attributes[attribute.id]"
              >
                <option value="">{{ t('common.notSpecified') }}</option>
                <option v-for="option in attribute.options" :key="option" :value="option">
                  {{ option }}
                </option></select
              ><input
                v-else
                :id="`attribute-${attribute.id}`"
                v-model="attributes[attribute.id]"
                :type="attribute.type === 'number' ? 'number' : 'text'"
              />
            </div>
          </div>
        </div>
        <div class="form-field form-field--full">
          <label>{{ t('editor.photos') }} *</label
          ><input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            @change="onFileChange"
          /><button
            v-if="photos.length < MAX_PHOTOS"
            class="photo-upload__dropzone"
            type="button"
            :disabled="processing"
            @click="fileInput?.click()"
            @dragover.prevent
            @drop.prevent="onDrop"
          >
            <span class="photo-upload__icon">＋</span><strong>{{ t('editor.addPhotos') }}</strong
            ><small>{{ t('editor.photoHint') }}</small>
          </button>
          <div class="photo-upload__previews photo-preview">
            <div v-for="(photo, index) in photos" :key="photo.dataUrl" class="photo-preview__item">
              <img :src="photo.dataUrl" :alt="photo.name" /><span
                v-if="index === 0"
                class="photo-preview__cover"
                >{{ t('editor.cover') }}</span
              ><button type="button" @click="photos.splice(index, 1)">×</button>
            </div>
          </div>
          <span class="form-error">{{ errors.photos }}</span>
        </div>
        <div class="form-field form-field--full">
          <label for="description">{{ t('editor.description') }} *</label
          ><textarea
            id="description"
            v-model="form.description"
            rows="5"
            maxlength="2000"
            :placeholder="t('editor.descriptionPlaceholder')"
            @input="clearError('description')"
          /><span class="form-error">{{ errors.description }}</span>
        </div>
        <div class="form-field">
          <label for="condition">{{ t('editor.condition') }} *</label
          ><select id="condition" v-model="form.condition" @change="clearError('condition')">
            <option value="">{{ t('editor.chooseCondition') }}</option>
            <option v-for="condition in conditions" :key="condition.id" :value="condition.id">
              {{ t(`condition.${condition.id}`) }}
            </option></select
          ><span class="form-error">{{ errors.condition }}</span>
        </div>
        <div class="form-field">
          <label for="price">{{ t('editor.price') }} *</label>
          <div class="price-input">
            <input
              id="price"
              v-model="form.price"
              type="number"
              min="0"
              @input="clearError('price')"
            /><span>₽</span>
          </div>
          <span class="form-error">{{ errors.price }}</span>
        </div>
        <div class="form-field form-field--full listing-location-field">
          <h2>{{ t('editor.where') }}</h2>
          <label for="city">{{ t('editor.city') }} *</label
          ><select id="city" v-model="form.cityId">
            <option v-for="city in Object.values(CITY_LOCATIONS)" :key="city.id" :value="city.id">
              {{ city.name }}
            </option></select
          ><label for="address">{{ t('editor.address') }} *</label
          ><input
            id="address"
            v-model="form.address"
            type="text"
            :placeholder="t('editor.addressPlaceholder')"
            autocomplete="street-address"
            @input="clearError('address')"
          />
          <p class="location-hint">{{ t('editor.addressHint') }}</p>
          <span class="form-error">{{ errors.cityId || errors.address }}</span>
        </div>
      </div>
      <div class="create-form__footer">
        <p>{{ t('editor.free') }}</p>
        <button class="button button--primary" type="submit" :disabled="submitting || processing">
          {{ t(editing ? 'editor.save' : 'editor.publish') }}
        </button>
      </div>
    </form>
  </main>
</template>
