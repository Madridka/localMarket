<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import FavoriteButton from '@/components/listings/FavoriteButton.vue'
import ListingCard from '@/components/listings/ListingCard.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { getCategory, getCategoryAttributes, getCategoryPath } from '@/data/taxonomy'
import { formatListingLocation } from '@/domain/location'
import type { Seller } from '@/domain/types'
import { useListingsStore } from '@/stores/listings'
import { useLocationStore } from '@/stores/location'
import { useMessagesStore } from '@/stores/messages'
import { useSearchHistoryStore } from '@/stores/searchHistory'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { safeImage } from '@/utils/assets'
import { formatDate, formatPrice } from '@/utils/format'

const route = useRoute()
const { t } = useI18n()
const listings = useListingsStore()
const session = useSessionStore()
const messages = useMessagesStore()
const activity = useSearchHistoryStore()
const location = useLocationStore()
const ui = useUiStore()
const seller = ref<Seller | null>(null)
const activePhoto = ref(0)
const offerOpen = ref(false)
const offerPrice = ref<number | null>(null)
const offerError = ref('')
const previousIds = ref<string[]>([])

const id = computed(() => String(route.params.id ?? ''))
const listing = computed(() => listings.items.find((item) => item.id === id.value) ?? null)
const images = computed(() =>
  (listing.value?.images.length ? listing.value.images : ['']).map(safeImage),
)
const categoryPath = computed(() => getCategoryPath(listing.value?.categoryId))
const attributeDefinitions = computed(() => getCategoryAttributes(listing.value?.categoryId))
const ownListing = computed(() => listing.value?.sellerId === session.user?.id)
const conditionLabel = computed(() =>
  listing.value ? t(`condition.${listing.value.condition}`) : '',
)
const locationLabel = computed(() =>
  listing.value ? formatListingLocation(listing.value, location.state) : '',
)
const recentListings = computed(() =>
  previousIds.value
    .map((recentId) => listings.items.find((item) => item.id === recentId))
    .filter((item) => item !== undefined)
    .slice(0, 4),
)

function showPhoto(index: number): void {
  const count = images.value.length
  activePhoto.value = (index + count) % count
}

function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && offerOpen.value) closeOffer()
  else if (!offerOpen.value && event.key === 'ArrowLeft') showPhoto(activePhoto.value - 1)
  else if (!offerOpen.value && event.key === 'ArrowRight') showPhoto(activePhoto.value + 1)
}

async function openOffer(): Promise<void> {
  offerOpen.value = true
  offerError.value = ''
  offerPrice.value = null
  document.body.classList.add('modal-open')
  await nextTick()
  document.querySelector<HTMLInputElement>('#offer-price')?.focus()
}

function closeOffer(): void {
  offerOpen.value = false
  document.body.classList.remove('modal-open')
  nextTick(() => document.querySelector<HTMLButtonElement>('#open-offer')?.focus())
}

async function submitOffer(): Promise<void> {
  if (!listing.value || !offerPrice.value || offerPrice.value >= listing.value.price) {
    offerError.value = t('listing.offerError')
    return
  }
  const chat = await messages.ensure(listing.value.id)
  if (!chat) return
  await messages.send(
    chat.id,
    t('listing.offerMessage', {
      price: formatPrice(offerPrice.value),
      title: listing.value.title,
    }),
  )
  closeOffer()
  ui.toast(t('listing.offerSent'))
}

onMounted(async () => {
  window.addEventListener('keydown', keydown)
  await Promise.all([listings.load(), session.load(), activity.load(), messages.load()])
  previousIds.value = activity.recentListings.filter((item) => item !== id.value)
  if (listing.value) {
    seller.value = await session.getSeller(listing.value.sellerId)
    await activity.markViewed(listing.value.id)
    document.title = `${listing.value.title} — ${t('app.name')}`
  } else {
    document.title = `${t('listing.notFoundTitle')} — ${t('app.name')}`
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown)
  document.body.classList.remove('modal-open')
})
</script>

<template>
  <main class="page-container detail-page">
    <div v-if="listings.loading" class="empty-state" aria-busy="true">
      {{ t('common.loading') }}
    </div>
    <EmptyState
      v-else-if="!listing"
      :title="t('listing.notFoundTitle')"
      :text="t('listing.notFoundText')"
    >
      <RouterLink class="button button--primary" :to="{ name: 'catalog' }">{{
        t('listing.toCatalog')
      }}</RouterLink>
    </EmptyState>
    <template v-else>
      <nav class="breadcrumbs" aria-label="breadcrumb">
        <RouterLink :to="{ name: 'catalog' }">{{ t('common.allListings') }}</RouterLink>
        <template v-for="part in categoryPath" :key="part.id"
          ><span>›</span
          ><RouterLink :to="{ name: 'catalog', query: { category: part.id } }">{{
            part.name
          }}</RouterLink></template
        >
        <span>›</span><span>{{ listing.title }}</span>
      </nav>
      <div class="listing-layout">
        <section class="gallery" :aria-label="t('listing.photos')">
          <div class="gallery-main">
            <img :src="images[activePhoto]" :alt="`${listing.title} — ${activePhoto + 1}`" />
            <button
              v-if="images.length > 1"
              class="gallery-arrow gallery-arrow--prev"
              type="button"
              :aria-label="t('listing.previousPhoto')"
              @click="showPhoto(activePhoto - 1)"
            >
              <AppIcon name="arrowLeft" :size="24" />
            </button>
            <button
              v-if="images.length > 1"
              class="gallery-arrow gallery-arrow--next"
              type="button"
              :aria-label="t('listing.nextPhoto')"
              @click="showPhoto(activePhoto + 1)"
            >
              <AppIcon name="arrowRight" :size="24" />
            </button>
            <span class="gallery-counter">{{ activePhoto + 1 }} / {{ images.length }}</span>
          </div>
          <div v-if="images.length > 1" class="gallery-thumbnails">
            <button
              v-for="(image, index) in images"
              :key="image + index"
              class="gallery-thumbnail"
              :class="{ 'is-active': index === activePhoto }"
              type="button"
              :aria-pressed="index === activePhoto"
              @click="showPhoto(index)"
            >
              <img :src="image" alt="" />
            </button>
          </div>
        </section>
        <aside class="listing-info">
          <p class="listing-kicker">
            {{ getCategory(listing.categoryId)?.name }} · {{ formatDate(listing.createdAt) }}
          </p>
          <div class="listing-price">{{ formatPrice(listing.price) }}</div>
          <h1 class="listing-title">{{ listing.title }}</h1>
          <div class="listing-facts">
            <div>
              <span>{{ t('listing.condition') }}</span
              ><strong>{{ conditionLabel }}</strong>
            </div>
            <div>
              <span>{{ t('listing.location') }}</span
              ><strong><AppIcon name="pin" :size="17" /> {{ locationLabel }}</strong>
            </div>
          </div>
          <div class="listing-actions">
            <template v-if="ownListing"
              ><RouterLink
                class="button button--primary"
                :to="{ name: 'listing-edit', params: { id: listing.id } }"
                >{{ t('listing.edit') }}</RouterLink
              ><span class="own-listing-note">{{ t('listing.own') }}</span></template
            >
            <template v-else
              ><RouterLink
                class="button button--primary"
                :to="{ name: 'messages', query: { listing: listing.id } }"
                ><AppIcon name="chat" :size="19" /> {{ t('listing.writeSeller') }}</RouterLink
              ><button
                id="open-offer"
                class="button button--secondary"
                type="button"
                @click="openOffer"
              >
                {{ t('listing.offer') }}
              </button></template
            >
            <FavoriteButton :listing-id="listing.id" detail />
          </div>
          <section class="seller-card" :aria-label="t('listing.seller')">
            <div class="seller-card__top">
              <div class="seller-avatar">{{ seller?.name.slice(0, 1) ?? '?' }}</div>
              <div>
                <strong>{{ seller?.name ?? t('listing.seller') }}</strong>
                <p>
                  {{
                    seller?.rating
                      ? `★ ${seller.rating} · ${seller.reviewsCount}`
                      : t('listing.newSeller')
                  }}
                </p>
              </div>
            </div>
            <div class="seller-card__details">
              <span>{{ seller?.verifiedPhone ? `✓ ${t('listing.phoneVerified')}` : '' }}</span
              ><span>{{ seller?.responseTime }}</span>
            </div>
            <RouterLink
              :to="{
                name: seller?.id === session.user?.id ? 'profile-me' : 'profile',
                params: seller?.id === session.user?.id ? {} : { id: seller?.id },
              }"
              >{{ t('listing.sellerProfile') }} <AppIcon name="arrowRight" :size="16"
            /></RouterLink>
          </section>
        </aside>
      </div>
      <section class="description-section">
        <h2>{{ t('listing.description') }}</h2>
        <p class="whitespace-pre-line">{{ listing.description }}</p>
        <div
          v-if="attributeDefinitions.some((attribute) => listing?.attributes?.[attribute.id])"
          class="listing-attributes"
        >
          <h3>{{ t('listing.attributes') }}</h3>
          <dl>
            <div
              v-for="attribute in attributeDefinitions.filter(
                (item) => listing?.attributes?.[item.id],
              )"
              :key="attribute.id"
            >
              <dt>{{ attribute.label }}</dt>
              <dd>{{ listing.attributes?.[attribute.id] }}</dd>
            </div>
          </dl>
        </div>
        <p class="meeting-note">
          {{ t('listing.meeting') }}
        </p>
        <div class="description-meta">
          <span><AppIcon name="pin" :size="17" /> {{ locationLabel }}</span
          ><span>{{ t('listing.views', { count: listing.views + 1 }) }}</span>
        </div>
      </section>
      <section v-if="recentListings.length" class="recently-viewed">
        <div class="section-heading">
          <h2>{{ t('listing.recent') }}</h2>
        </div>
        <div class="listing-grid">
          <ListingCard v-for="item in recentListings" :key="item.id" :listing="item" />
        </div>
      </section>
    </template>
  </main>

  <div
    v-if="offerOpen && listing"
    class="modal-backdrop is-open"
    role="presentation"
    @click.self="closeOffer"
  >
    <div class="modal" role="dialog" aria-modal="true" :aria-labelledby="'offer-heading'">
      <button class="modal-close" type="button" :aria-label="t('common.close')" @click="closeOffer">
        <AppIcon name="close" />
      </button>
      <h2 id="offer-heading">{{ t('listing.offerTitle') }}</h2>
      <p class="modal-intro">{{ listing.title }}</p>
      <div class="offer-original">
        <span>{{ t('listing.sellerPrice') }}</span
        ><strong>{{ formatPrice(listing.price) }}</strong>
      </div>
      <form @submit.prevent="submitOffer">
        <label for="offer-price">{{ t('listing.yourOffer') }}</label
        ><input
          id="offer-price"
          v-model.number="offerPrice"
          type="number"
          min="1"
          :max="listing.price - 1"
          required
        />
        <p class="form-error">{{ offerError }}</p>
        <div class="modal-actions">
          <button class="button button--secondary" type="button" @click="closeOffer">
            {{ t('common.cancel') }}</button
          ><button class="button button--primary" type="submit">{{ t('messages.send') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
