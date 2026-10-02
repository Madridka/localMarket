<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ListingCard from '@/components/listings/ListingCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  categories,
  getCategory,
  getCategoryParent,
  getCategoryPath,
  getCategorySidebarState,
} from '@/data/taxonomy'
import { conditions } from '@/data/seed'
import { selectListings } from '@/domain/catalog'
import {
  CITY_LOCATIONS,
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  normalizeLocationState,
} from '@/domain/location'
import type { CatalogQuery, ConditionId, SavedSearch, SortMode } from '@/domain/types'
import { useListingsStore } from '@/stores/listings'
import { useLocationStore } from '@/stores/location'
import { useSearchHistoryStore } from '@/stores/searchHistory'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const listingsStore = useListingsStore()
const locationStore = useLocationStore()
const searchHistory = useSearchHistoryStore()
const ui = useUiStore()
const filtersOpen = ref(false)
const expanded = ref(false)
let inputTimer: number | undefined

interface FilterForm {
  query: string
  category: string
  min: string
  max: string
  conditions: ConditionId[]
  cityId: string
  radiusKm: number
  sort: SortMode
}

const form = reactive<FilterForm>({
  query: '',
  category: '',
  min: '',
  max: '',
  conditions: [],
  cityId: locationStore.state.cityId,
  radiusKm: locationStore.state.radiusKm,
  sort: 'recommended',
})

function asString(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

function stateFromRoute(): CatalogQuery {
  const cityId = asString(route.query.city) || locationStore.state.cityId
  return {
    query: asString(route.query.q),
    category: getCategory(asString(route.query.category))?.id ?? '',
    min: asString(route.query.min),
    max: asString(route.query.max),
    conditions: asString(route.query.condition)
      .split(',')
      .filter((item): item is ConditionId => conditions.some((condition) => condition.id === item)),
    location: normalizeLocationState({ cityId, radius: asString(route.query.radius) }),
    sort: ['distance', 'newest', 'price-asc', 'price-desc'].includes(asString(route.query.sort))
      ? (asString(route.query.sort) as SortMode)
      : 'recommended',
  }
}

function syncForm(): void {
  const state = stateFromRoute()
  Object.assign(form, {
    query: state.query,
    category: state.category,
    min: state.min,
    max: state.max,
    conditions: [...state.conditions],
    cityId: state.location.cityId,
    radiusKm: state.location.radiusKm,
    sort: state.sort,
  })
  locationStore.set(state.location)
}

watch(() => route.fullPath, syncForm, { immediate: true })

const state = computed<CatalogQuery>(() => ({
  query: form.query.trim(),
  category: form.category,
  min: form.min,
  max: form.max,
  conditions: form.conditions,
  location: locationStore.state,
  sort: form.sort,
}))
const results = computed(() => selectListings(listingsStore.items, state.value))
const activeCategory = computed(() => getCategory(form.category))
const categoryPath = computed(() => getCategoryPath(form.category))
const sidebar = computed(() => getCategorySidebarState(form.category))
const city = computed(() => CITY_LOCATIONS[locationStore.state.cityId] ?? CITY_LOCATIONS.tomsk!)
const categoryOptions = computed(() => {
  if (!sidebar.value.current) return categories
  if (sidebar.value.children.length) return sidebar.value.children
  return getCategoryParent(sidebar.value.current.id)?.children ?? categories
})
const visibleCategoryOptions = computed(() =>
  expanded.value ? categoryOptions.value : categoryOptions.value.slice(0, 7),
)
const title = computed(() => {
  if (form.query) return t('catalog.searchTitle', { query: form.query })
  if (activeCategory.value) return activeCategory.value.name
  return t('catalog.radiusTitle', {
    radius: locationStore.state.radiusKm,
    city: city.value.genitive,
  })
})
const intro = computed(() => {
  if (form.query || activeCategory.value) return ''
  return t('catalog.radiusIntro', {
    radius: locationStore.state.radiusKm,
    city: city.value.genitive,
  })
})
const countLabel = computed(() => t('catalog.count', results.value.length))
const saved = computed(() => searchHistory.has(state.value as SavedSearch))

function queryFromState(): Record<string, string | undefined> {
  return {
    q: form.query.trim() || undefined,
    category: form.category || undefined,
    min: form.min || undefined,
    max: form.max || undefined,
    condition: form.conditions.length ? form.conditions.join(',') : undefined,
    city: locationStore.state.cityId,
    radius: String(locationStore.state.radiusKm),
    sort: form.sort === 'recommended' ? undefined : form.sort,
  }
}

function apply(push = false): void {
  const method = push ? router.push : router.replace
  void method({ name: 'catalog', query: queryFromState() })
}

function applyLater(): void {
  window.clearTimeout(inputTimer)
  inputTimer = window.setTimeout(() => apply(), 220)
}

function submitFilters(): void {
  apply()
  filtersOpen.value = false
}

function selectCategory(id: string): void {
  form.category = id
  expanded.value = false
  apply(true)
}

function reset(): void {
  Object.assign(form, {
    query: '',
    category: '',
    min: '',
    max: '',
    conditions: [],
    radiusKm: DEFAULT_RADIUS_KM,
    sort: 'recommended',
  })
  locationStore.set({ cityId: form.cityId, radiusKm: form.radiusKm })
  filtersOpen.value = false
  apply()
}

function changeCity(): void {
  locationStore.set({ cityId: form.cityId, radiusKm: form.radiusKm })
  apply(true)
}

function changeRadius(): void {
  locationStore.set({ cityId: form.cityId, radiusKm: form.radiusKm })
  applyLater()
}

async function toggleSaved(): Promise<void> {
  try {
    const active = await searchHistory.toggle(state.value as SavedSearch)
    ui.toast(t(active ? 'search.savedToast' : 'search.removedToast'))
  } catch {
    ui.toast(t('toast.storage'))
  }
}

onMounted(() => {
  void listingsStore.load()
  void searchHistory.load()
})
</script>

<template>
  <main class="page-container catalog-page">
    <nav class="category-nav" :aria-label="t('catalog.categories')">
      <button
        type="button"
        class="category-chip"
        :class="{ 'is-active': !form.category }"
        @click="selectCategory('')"
      >
        {{ t('catalog.forYou') }}
      </button>
      <button
        v-for="root in categories"
        :key="root.id"
        type="button"
        class="category-chip"
        :class="{ 'is-active': categoryPath[0]?.id === root.id }"
        @click="selectCategory(root.id)"
      >
        {{ root.name }}
      </button>
    </nav>

    <div class="catalog-layout">
      <button
        v-if="filtersOpen"
        class="filter-backdrop"
        type="button"
        :aria-label="t('catalog.closeFilters')"
        @click="filtersOpen = false"
      />
      <aside
        class="filter-sidebar"
        :class="{ 'is-open': filtersOpen }"
        :aria-label="t('catalog.filters')"
      >
        <div class="filter-sidebar__heading">
          <h2>{{ t('catalog.filters') }}</h2>
          <button
            class="filter-close"
            type="button"
            :aria-label="t('catalog.closeFilters')"
            @click="filtersOpen = false"
          >
            ×
          </button>
        </div>
        <form @submit.prevent="submitFilters">
          <div class="filter-section category-filter">
            <h3>{{ t('catalog.categories') }}</h3>
            <nav class="category-tree" :aria-label="t('catalog.categories')">
              <button
                class="category-tree__all"
                :class="{ 'category-current': !form.category }"
                type="button"
                @click="selectCategory('')"
              >
                {{ t('catalog.allCategories') }}
              </button>
              <div v-if="sidebar.current" class="category-tree__path">
                <button
                  v-for="(part, index) in sidebar.children.length
                    ? [...sidebar.ancestors, sidebar.current]
                    : sidebar.ancestors"
                  :key="part.id"
                  class="category-tree__item category-tree__path-item"
                  :class="{ 'category-current': part.id === form.category }"
                  :style="{ '--category-indent': `${Math.min(index, 3) * 16}px` }"
                  @click="selectCategory(part.id)"
                >
                  {{ part.name }}
                </button>
              </div>
              <div class="category-tree__level">
                <button
                  v-for="option in visibleCategoryOptions"
                  :key="option.id"
                  class="category-tree__item"
                  :class="{ 'category-current': option.id === form.category }"
                  type="button"
                  @click="selectCategory(option.id)"
                >
                  {{ option.name }}
                </button>
              </div>
              <button
                v-if="categoryOptions.length > 7"
                class="category-tree__toggle"
                type="button"
                @click="expanded = !expanded"
              >
                {{ t(expanded ? 'catalog.collapse' : 'catalog.showAll') }}
              </button>
            </nav>
          </div>
          <div class="filter-section">
            <span class="filter-label">{{ t('catalog.price') }}</span>
            <div class="price-fields">
              <input
                v-model="form.min"
                type="number"
                min="0"
                :placeholder="t('catalog.priceFrom')"
                @input="applyLater"
              />
              <input
                v-model="form.max"
                type="number"
                min="0"
                :placeholder="t('catalog.priceTo')"
                @input="applyLater"
              />
            </div>
          </div>
          <fieldset class="filter-section">
            <legend>{{ t('catalog.condition') }}</legend>
            <div class="filter-options">
              <label v-for="condition in conditions" :key="condition.id"
                ><input
                  v-model="form.conditions"
                  type="checkbox"
                  :value="condition.id"
                  @change="apply()"
                />
                {{ t(`condition.${condition.id}`) }}</label
              >
            </div>
          </fieldset>
          <div class="filter-section location-filter">
            <h3>{{ t('catalog.location') }}</h3>
            <select v-model="form.cityId" @change="changeCity">
              <option v-for="item in Object.values(CITY_LOCATIONS)" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
            <div class="radius-filter">
              <label for="location-radius">
                <span>{{ t('catalog.radius') }}</span>
                <strong>{{ t('catalog.radiusValue', { radius: form.radiusKm }) }}</strong>
              </label>
              <input
                id="location-radius"
                v-model.number="form.radiusKm"
                type="range"
                :min="MIN_RADIUS_KM"
                :max="MAX_RADIUS_KM"
                step="10"
                :aria-valuetext="t('catalog.radiusValue', { radius: form.radiusKm })"
                @input="changeRadius"
              />
              <div class="radius-filter__limits" aria-hidden="true">
                <span>{{ MIN_RADIUS_KM }} {{ t('catalog.km') }}</span>
                <span>{{ MAX_RADIUS_KM }} {{ t('catalog.km') }}</span>
              </div>
            </div>
            <p class="location-hint">{{ t('catalog.radiusHint', { city: city.genitive }) }}</p>
          </div>
          <div class="filter-actions">
            <button class="button button--primary" type="submit">
              {{ t('catalog.showResults') }}</button
            ><button class="button button--text" type="button" @click="reset">
              {{ t('catalog.reset') }}
            </button>
          </div>
        </form>
      </aside>

      <section class="catalog-content" aria-labelledby="catalog-title">
        <div class="catalog-heading">
          <div>
            <nav
              v-if="categoryPath.length"
              class="breadcrumb catalog-breadcrumbs"
              :aria-label="t('catalog.categories')"
            >
              <button type="button" @click="selectCategory('')">
                {{ t('catalog.allCategories') }}
              </button>
              <template v-for="part in categoryPath" :key="part.id"
                ><span>›</span
                ><button type="button" @click="selectCategory(part.id)">
                  {{ part.name }}
                </button></template
              >
            </nav>
            <h1 id="catalog-title">{{ title }}</h1>
            <p class="catalog-count" aria-live="polite">{{ countLabel }}</p>
            <p v-if="intro" class="catalog-intro">{{ intro }}</p>
          </div>
        </div>
        <div class="catalog-toolbar">
          <div class="catalog-toolbar__left">
            <button
              class="filter-toggle button button--secondary"
              type="button"
              @click="filtersOpen = true"
            >
              {{ t('catalog.filters') }}
            </button>
          </div>
          <div class="catalog-toolbar__right">
            <button
              type="button"
              class="save-search-button"
              :class="{ 'is-active': saved }"
              :aria-pressed="saved"
              @click="toggleSaved"
            >
              ♡ <span>{{ t(saved ? 'search.savedLabel' : 'search.save') }}</span>
            </button>
            <label for="sort-select">{{ t('catalog.sort') }}</label>
            <select id="sort-select" v-model="form.sort" class="sort-select" @change="apply()">
              <option value="recommended">{{ t('catalog.recommended') }}</option>
              <option value="distance">{{ t('catalog.distance') }}</option>
              <option value="newest">{{ t('catalog.newest') }}</option>
              <option value="price-asc">{{ t('catalog.priceAsc') }}</option>
              <option value="price-desc">{{ t('catalog.priceDesc') }}</option>
            </select>
          </div>
        </div>

        <div v-if="listingsStore.loading" class="listing-grid" aria-busy="true">
          <div v-for="index in 8" :key="index" class="skeleton-card">
            <div class="skeleton-card__image" />
            <div class="skeleton-card__line" />
            <div class="skeleton-card__line short" />
            <div class="skeleton-card__line muted" />
          </div>
        </div>
        <EmptyState
          v-else-if="!results.length"
          :title="t('catalog.emptyTitle')"
          :text="t('catalog.emptyText')"
          icon="search"
          ><button class="button button--secondary" type="button" @click="reset">
            {{ t('catalog.reset') }}
          </button></EmptyState
        >
        <div v-else class="listing-grid" aria-live="polite">
          <ListingCard v-for="listing in results" :key="listing.id" :listing="listing" />
        </div>
      </section>
    </div>
  </main>
</template>
