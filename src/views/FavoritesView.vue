<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import ListingCard from '@/components/listings/ListingCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { useListingsStore } from '@/stores/listings'

const { t } = useI18n()
const favorites = useFavoritesStore()
const listings = useListingsStore()
const items = computed(() =>
  favorites.ids
    .map((id) => listings.items.find((listing) => listing.id === id))
    .filter((listing) => listing !== undefined),
)

onMounted(() => Promise.all([favorites.load(), listings.load()]))
</script>

<template>
  <main class="page-container favorites-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ t('favorite.eyebrow') }}</p>
        <h1>{{ t('favorite.title') }}</h1>
        <p v-if="items.length" class="muted">{{ t('favorite.count', { count: items.length }) }}</p>
      </div>
    </div>
    <div v-if="listings.loading" class="empty-state">{{ t('common.loading') }}</div>
    <div v-else-if="items.length" class="listing-grid">
      <ListingCard v-for="listing in items" :key="listing.id" :listing="listing" />
    </div>
    <EmptyState
      v-else
      :title="t('favorite.emptyTitle')"
      :text="t('favorite.emptyText')"
      icon="heart"
      ><RouterLink class="button button--primary" :to="{ name: 'catalog' }">{{
        t('favorite.action')
      }}</RouterLink></EmptyState
    >
  </main>
</template>
