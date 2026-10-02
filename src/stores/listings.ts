import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { EntityId, Listing, ListingDraft } from '@/domain/types'
import { listingsRepository } from '@/services/repositories'
import { sameId } from '@/utils/ids'

export const useListingsStore = defineStore('listings', () => {
  const items = ref<Listing[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const byId = computed(() => new Map(items.value.map((listing) => [listing.id, listing])))

  async function load(force = false): Promise<void> {
    if ((loaded.value && !force) || loading.value) return
    loading.value = true
    error.value = null
    try {
      items.value = await listingsRepository.list()
      loaded.value = true
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'unknown'
    } finally {
      loading.value = false
    }
  }

  async function get(id: EntityId): Promise<Listing | null> {
    await load()
    return items.value.find((listing) => sameId(listing.id, id)) ?? null
  }

  async function create(draft: ListingDraft): Promise<Listing> {
    const created = await listingsRepository.create(draft)
    items.value = [created, ...items.value]
    return created
  }

  async function update(id: EntityId, draft: ListingDraft): Promise<Listing | null> {
    const updated = await listingsRepository.update(id, draft)
    if (updated) {
      items.value = items.value.map((listing) => (sameId(listing.id, id) ? updated : listing))
    }
    return updated
  }

  return { items, loading, loaded, error, byId, load, get, create, update }
})
