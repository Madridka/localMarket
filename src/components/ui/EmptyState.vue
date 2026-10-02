<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{
  title: string
  text?: string
  icon?: 'heart' | 'search' | 'chat' | 'plus'
}>()
</script>

<template>
  <div class="empty-state">
    <div v-if="icon" class="empty-state__icon"><AppIcon :name="icon" :size="30" /></div>
    <h2>{{ title }}</h2>
    <p v-if="text">{{ text }}</p>
    <slot />
  </div>
</template>
