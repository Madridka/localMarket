<script setup lang="ts">
import { onMounted } from 'vue'

import AppHeader from '@/components/layout/AppHeader.vue'
import MobileNav from '@/components/layout/MobileNav.vue'
import ToastViewport from '@/components/ui/ToastViewport.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const favorites = useFavoritesStore()

onMounted(() => {
  void session.load()
  void favorites.load()
})
</script>

<template>
  <AppHeader />
  <RouterView />
  <MobileNav />
  <ToastViewport />
</template>
