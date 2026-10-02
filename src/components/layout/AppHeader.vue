<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '@/components/ui/AppIcon.vue'
import { CITY_LOCATIONS } from '@/domain/location'
import { useLocationStore } from '@/stores/location'
import { useSearchHistoryStore } from '@/stores/searchHistory'

const route = useRoute()
const router = useRouter()
const location = useLocationStore()
const history = useSearchHistoryStore()
const { t } = useI18n()
const query = ref(String(route.query.q ?? ''))
const cityOpen = ref(false)
const citiesOpen = ref(false)
const suggestionsOpen = ref(false)
const city = computed(() => CITY_LOCATIONS[location.state.cityId] ?? CITY_LOCATIONS.tomsk!)

watch(
  () => route.query.q,
  (value) => {
    query.value = String(value ?? '')
  },
)

onMounted(() => history.load())

async function search(value = query.value): Promise<void> {
  query.value = value
  await history.addRecent(value)
  suggestionsOpen.value = false
  await router.push({ name: 'catalog', query: { ...route.query, q: value || undefined } })
}

function chooseCity(cityId: string): void {
  location.set({ cityId, radiusKm: location.state.radiusKm })
  cityOpen.value = false
  void router.push({
    name: 'catalog',
    query: {
      ...route.query,
      city: cityId,
      radius: String(location.state.radiusKm),
      location: undefined,
      area: undefined,
    },
  })
}
</script>

<template>
  <header class="site-header">
    <div class="header-inner page-container">
      <RouterLink class="logo" :to="{ name: 'catalog' }" :aria-label="t('app.name')">
        <span class="logo-mark" aria-hidden="true" />{{ t('app.name') }}
      </RouterLink>
      <form class="header-search" role="search" @submit.prevent="search()">
        <AppIcon name="search" :size="20" />
        <input
          v-model="query"
          type="search"
          :placeholder="t('search.placeholder')"
          :aria-label="t('search.placeholder')"
          autocomplete="off"
          @focus="suggestionsOpen = true"
        />
        <div
          v-if="suggestionsOpen && (history.recent.length || history.saved.length)"
          class="search-suggestions"
        >
          <div v-if="history.recent.length" class="suggestion-heading">
            {{ t('search.recent') }}
          </div>
          <button v-for="item in history.recent" :key="item" type="button" @click="search(item)">
            <AppIcon name="search" :size="15" /> {{ item }}
          </button>
        </div>
      </form>
      <div class="header-actions">
        <div class="city-picker">
          <button
            class="header-city"
            type="button"
            :aria-expanded="cityOpen"
            @click="cityOpen = !cityOpen"
          >
            <AppIcon name="pin" :size="18" /><span>{{ city.name }}</span
            ><AppIcon name="chevron" :size="16" />
          </button>
          <div v-if="cityOpen" class="city-menu">
            <p class="city-menu__heading">{{ t('catalog.whereSearch') }}</p>
            <strong class="city-menu__current">{{ city.name }}</strong>
            <p class="city-menu__radius">
              {{ t('catalog.radiusValue', { radius: location.state.radiusKm }) }}
            </p>
            <button class="city-menu__change" type="button" @click="citiesOpen = !citiesOpen">
              {{ t('catalog.otherCity') }}
            </button>
            <div v-if="citiesOpen" class="city-menu__cities">
              <button
                v-for="item in Object.values(CITY_LOCATIONS)"
                :key="item.id"
                type="button"
                @click="chooseCity(item.id)"
              >
                {{ item.name }}
              </button>
            </div>
          </div>
        </div>
        <RouterLink class="header-icon" :to="{ name: 'favorites' }" :aria-label="t('nav.favorites')"
          ><AppIcon name="heart" :size="21"
        /></RouterLink>
        <RouterLink class="header-icon" :to="{ name: 'messages' }" :aria-label="t('nav.messages')"
          ><AppIcon name="chat" :size="21"
        /></RouterLink>
        <RouterLink class="header-profile" :to="{ name: 'profile-me' }">{{
          t('nav.profile')
        }}</RouterLink>
        <RouterLink class="sell-button" :to="{ name: 'listing-new' }"
          ><AppIcon name="plus" :size="19" />{{ t('nav.sell') }}</RouterLink
        >
      </div>
    </div>
  </header>
</template>
