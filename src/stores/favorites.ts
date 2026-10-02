import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { EntityId } from '@/domain/types'
import { activityRepository } from '@/services/repositories'
import { sameId } from '@/utils/ids'

export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref<EntityId[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    if (loaded.value) return
    ids.value = await activityRepository.favorites()
    loaded.value = true
  }

  function has(id: EntityId): boolean {
    return ids.value.some((item) => sameId(item, id))
  }

  async function toggle(id: EntityId): Promise<boolean> {
    const active = !has(id)
    ids.value = await activityRepository.setFavorite(id, active)
    return active
  }

  return { ids, loaded, load, has, toggle }
})
