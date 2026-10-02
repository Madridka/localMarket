<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppIcon from '@/components/ui/AppIcon.vue'

const { t } = useI18n()
const links = [
  { to: { name: 'catalog' }, icon: 'home' as const, label: 'nav.home' },
  { to: { name: 'favorites' }, icon: 'heart' as const, label: 'nav.favorites' },
  { to: { name: 'listing-new' }, icon: 'plus' as const, label: 'nav.sell' },
  { to: { name: 'messages' }, icon: 'chat' as const, label: 'nav.messages' },
  { to: { name: 'profile-me' }, icon: 'user' as const, label: 'nav.profile' },
]
</script>

<template>
  <nav class="mobile-nav" :aria-label="t('nav.home')">
    <RouterLink v-for="link in links" :key="link.label" :to="link.to" class="mobile-nav__link">
      <AppIcon :name="link.icon" :size="21" />
      <span>{{ t(link.label) }}</span>
    </RouterLink>
  </nav>
</template>
