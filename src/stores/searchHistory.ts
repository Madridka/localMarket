import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { EntityId, SavedSearch } from '@/domain/types'
import { activityRepository } from '@/services/repositories'

export const useSearchHistoryStore = defineStore('searchHistory', () => {
  const recent = ref<string[]>([])
  const saved = ref<SavedSearch[]>([])
  const recentListings = ref<EntityId[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    if (loaded.value) return
    ;[recent.value, saved.value, recentListings.value] = await Promise.all([
      activityRepository.recentSearches(),
      activityRepository.savedSearches(),
      activityRepository.recent(),
    ])
    loaded.value = true
  }

  async function markViewed(id: EntityId): Promise<void> {
    recentListings.value = await activityRepository.markViewed(id)
  }

  async function addRecent(query: string): Promise<void> {
    recent.value = await activityRepository.addRecentSearch(query)
  }

  function has(search: SavedSearch): boolean {
    const value = JSON.stringify(search)
    return saved.value.some((item) => JSON.stringify(item) === value)
  }

  async function toggle(search: SavedSearch): Promise<boolean> {
    const active = !has(search)
    saved.value = await activityRepository.setSavedSearch(search, active)
    return active
  }

  return { recent, saved, recentListings, loaded, load, addRecent, markViewed, has, toggle }
})
