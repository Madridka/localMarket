<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/ui/AppIcon.vue'
import type { EntityId } from '@/domain/types'
import { useFavoritesStore } from '@/stores/favorites'
import { useUiStore } from '@/stores/ui'

const props = withDefaults(defineProps<{ listingId: EntityId; detail?: boolean }>(), {
  detail: false,
})
const favorites = useFavoritesStore()
const ui = useUiStore()
const { t } = useI18n()
const active = computed(() => favorites.has(props.listingId))

onMounted(() => favorites.load())

async function toggle(): Promise<void> {
  try {
    const next = await favorites.toggle(props.listingId)
    ui.toast(t(next ? 'favorite.added' : 'favorite.removed'))
  } catch {
    ui.toast(t('toast.storage'))
  }
}
</script>

<template>
  <button
    type="button"
    :class="[
      detail ? 'button button--text detail-favorite' : 'favorite-button',
      { 'is-active': active },
    ]"
    :aria-label="t(active ? 'favorite.remove' : 'favorite.add')"
    :aria-pressed="active"
    @click.prevent="toggle"
  >
    <AppIcon name="heart" :size="20" :filled="active" />
    <span v-if="detail">{{ t('nav.favorites') }}</span>
  </button>
</template>
