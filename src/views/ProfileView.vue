<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import ListingCard from '@/components/listings/ListingCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { Review, Seller } from '@/domain/types'
import { useListingsStore } from '@/stores/listings'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const { t } = useI18n()
const listings = useListingsStore()
const session = useSessionStore()
const seller = ref<Seller | null>(null)
const reviews = ref<Review[]>([])
const loading = ref(true)
const own = computed(() => route.name === 'profile-me' || seller.value?.id === session.user?.id)
const sellerListings = computed(() =>
  seller.value
    ? listings.items
        .filter((listing) => listing.sellerId === seller.value?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [],
)

function memberDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date)
}

function reviewDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        date,
      )
}

async function load(): Promise<void> {
  loading.value = true
  await Promise.all([session.load(), listings.load()])
  const id = route.name === 'profile-me' ? session.user?.id : String(route.params.id ?? '')
  seller.value = id ? await session.getSeller(id) : null
  reviews.value = seller.value ? await session.getReviews(seller.value.id) : []
  loading.value = false
  document.title = `${seller.value?.name ?? t('profile.notFoundTitle')} — ${t('app.name')}`
}

onMounted(load)
watch(() => route.fullPath, load)
</script>

<template>
  <main class="page-container profile-page" tabindex="-1">
    <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
    <EmptyState
      v-else-if="!seller"
      :title="t('profile.notFoundTitle')"
      :text="t('profile.notFoundText')"
      ><RouterLink class="button button--primary" :to="{ name: 'catalog' }">{{
        t('notFound.action')
      }}</RouterLink></EmptyState
    >
    <template v-else>
      <nav class="breadcrumbs">
        <RouterLink :to="{ name: 'catalog' }">{{ t('nav.home') }}</RouterLink
        ><span>/</span><span>{{ own ? t('profile.ownTitle') : seller.name }}</span>
      </nav>
      <div class="page-heading profile-page__heading">
        <div>
          <p class="eyebrow">{{ t(own ? 'profile.ownEyebrow' : 'profile.sellerEyebrow') }}</p>
          <h1>{{ t(own ? 'profile.ownTitle' : 'profile.sellerTitle') }}</h1>
        </div>
      </div>
      <section class="profile-header">
        <div class="profile-avatar">
          <img v-if="seller.avatar" :src="seller.avatar" alt="" /><span v-else>{{
            seller.name.slice(0, 1).toUpperCase()
          }}</span>
        </div>
        <div class="profile-meta">
          <div class="profile-meta__title">
            <h2>{{ seller.name }}</h2>
            <span v-if="seller.verifiedPhone" class="verified-badge"
              >✓ {{ t('listing.phoneVerified') }}</span
            >
          </div>
          <div class="profile-stats">
            <span class="profile-rating">★ {{ seller.rating?.toFixed(1) ?? '—' }}</span
            ><span
              >{{ seller.reviewsCount || reviews.length }}
              {{ t('profile.reviews').toLowerCase() }}</span
            ><span>{{ seller.city }}</span>
          </div>
          <p class="profile-joined">
            {{
              memberDate(seller.registeredAt)
                ? t('profile.memberSince', { date: memberDate(seller.registeredAt) })
                : t('profile.marketplaceMember')
            }}
            · {{ seller.responseTime }}
          </p>
        </div>
        <RouterLink
          v-if="own"
          class="button button--secondary profile-header__action"
          :to="{ name: 'listing-new' }"
          >{{ t('profile.sell') }}</RouterLink
        ><RouterLink
          v-else-if="sellerListings[0]"
          class="button button--primary profile-header__action"
          :to="{ name: 'messages', query: { listing: sellerListings[0].id } }"
          >{{ t('profile.write') }}</RouterLink
        >
      </section>
      <section class="profile-listings seller-listings">
        <div class="section-heading">
          <div>
            <p class="eyebrow">{{ t('profile.onSale') }}</p>
            <h2>
              {{ t(own ? 'profile.myListings' : 'profile.sellerListings') }}
              <span class="section-count">{{ sellerListings.length }}</span>
            </h2>
          </div>
        </div>
        <div v-if="sellerListings.length" class="listing-grid">
          <ListingCard v-for="listing in sellerListings" :key="listing.id" :listing="listing" />
        </div>
        <EmptyState
          v-else
          :title="t(own ? 'profile.noListings' : 'profile.noSellerListings')"
          :text="t(own ? 'profile.addFirst' : 'profile.comeBack')"
          ><RouterLink
            class="button button--primary"
            :to="{ name: own ? 'listing-new' : 'catalog' }"
            >{{ t(own ? 'profile.sell' : 'messages.find') }}</RouterLink
          ></EmptyState
        >
      </section>
      <section class="profile-reviews">
        <div class="section-heading">
          <div>
            <p class="eyebrow">{{ t('profile.reputation') }}</p>
            <h2>
              {{ t('profile.reviews') }} <span class="section-count">{{ reviews.length }}</span>
            </h2>
          </div>
        </div>
        <div v-if="reviews.length" class="reviews-grid">
          <article v-for="review in reviews.slice(0, 6)" :key="review.id" class="review-card">
            <div class="review-card__header">
              <strong>{{ review.author }}</strong
              ><span class="review-card__stars"
                >{{ '★'.repeat(Math.round(review.rating))
                }}{{ '☆'.repeat(5 - Math.round(review.rating)) }}</span
              >
            </div>
            <p>{{ review.text }}</p>
            <time :datetime="review.createdAt">{{ reviewDate(review.createdAt) }}</time>
          </article>
        </div>
        <EmptyState v-else :title="t('profile.noReviews')" :text="t('profile.noReviewsText')" />
      </section>
    </template>
  </main>
</template>
