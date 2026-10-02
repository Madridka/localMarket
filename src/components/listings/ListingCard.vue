<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FavoriteButton from '@/components/listings/FavoriteButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { getCategory } from '@/data/taxonomy'
import { formatListingLocation } from '@/domain/location'
import type { Listing } from '@/domain/types'
import { useLocationStore } from '@/stores/location'
import { safeImage } from '@/utils/assets'
import { formatDate, formatPrice } from '@/utils/format'

const props = defineProps<{ listing: Listing }>()
const { t } = useI18n()
const location = useLocationStore()
const image = computed(() => safeImage(props.listing.images[0]))
const meta = computed(() => formatListingLocation(props.listing, location.state))
</script>

<template>
  <article class="listing-card" :data-listing-id="listing.id">
    <div class="listing-card__image">
      <RouterLink :to="{ name: 'listing', params: { id: listing.id } }" :aria-label="listing.title">
        <img :src="image" :alt="listing.title" loading="lazy" />
      </RouterLink>
      <FavoriteButton :listing-id="listing.id" />
      <span v-if="listing.images.length > 1" class="image-count">
        <AppIcon name="camera" :size="13" /> {{ listing.images.length }}
      </span>
    </div>
    <div class="listing-card__body">
      <RouterLink :to="{ name: 'listing', params: { id: listing.id } }" class="listing-card__link">
        <strong class="listing-card__price">{{ formatPrice(listing.price) }}</strong>
        <span class="listing-card__title">{{ listing.title }}</span>
        <span class="listing-card__meta">{{
          getCategory(listing.categoryId)?.name ?? t('common.notSpecified')
        }}</span>
        <span class="listing-card__meta" data-location-meta>{{ meta }}</span>
        <span class="listing-card__meta listing-card__date">{{
          formatDate(listing.createdAt)
        }}</span>
      </RouterLink>
    </div>
  </article>
</template>
