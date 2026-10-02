import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { EntityId, Review, Seller } from '@/domain/types'
import { profilesRepository } from '@/services/repositories'

export const useSessionStore = defineStore('session', () => {
  const user = ref<Seller | null>(null)
  const loading = ref(false)
  const sellers = reactive(new Map<EntityId, Seller>())
  const reviews = reactive(new Map<EntityId, Review[]>())

  async function load(): Promise<void> {
    if (user.value || loading.value) return
    loading.value = true
    try {
      user.value = await profilesRepository.current()
      sellers.set(user.value.id, user.value)
    } finally {
      loading.value = false
    }
  }

  async function getSeller(id: EntityId): Promise<Seller | null> {
    await load()
    if (sellers.has(id)) return sellers.get(id) ?? null
    const seller = await profilesRepository.get(id)
    if (seller) sellers.set(seller.id, seller)
    return seller
  }

  async function getReviews(id: EntityId): Promise<Review[]> {
    if (reviews.has(id)) return reviews.get(id) ?? []
    const items = await profilesRepository.reviews(id)
    reviews.set(id, items)
    return items
  }

  return { user, loading, sellers, reviews, load, getSeller, getReviews }
})
