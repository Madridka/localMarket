import { defineStore } from 'pinia'
import { ref } from 'vue'

import { STORAGE_KEYS } from '@/domain/constants'
import { normalizeLocationState } from '@/domain/location'
import type { LocationState } from '@/domain/types'
import { storage } from '@/services/storage'

export const useLocationStore = defineStore('location', () => {
  const state = ref<LocationState>(
    normalizeLocationState(storage.read<unknown>(STORAGE_KEYS.location, {})),
  )
  function set(input: unknown): LocationState {
    state.value = normalizeLocationState(input)
    storage.write(STORAGE_KEYS.location, state.value)
    storage.remove(STORAGE_KEYS.legacyLocation)
    return state.value
  }

  return { state, set }
})
