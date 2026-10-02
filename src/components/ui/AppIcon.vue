<script setup lang="ts">
import { computed } from 'vue'

type IconName =
  | 'heart'
  | 'search'
  | 'pin'
  | 'chat'
  | 'user'
  | 'plus'
  | 'home'
  | 'chevron'
  | 'arrowLeft'
  | 'arrowRight'
  | 'close'
  | 'camera'

const props = withDefaults(defineProps<{ name: IconName; size?: number; filled?: boolean }>(), {
  size: 20,
  filled: false,
})

const paths: Record<IconName, string> = {
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  chat: '<path d="M20 11.5a7.8 7.8 0 0 1-8 7.5 9 9 0 0 1-3.2-.6L4 20l1.6-4.2A7.2 7.2 0 0 1 4 11.5 7.8 7.8 0 0 1 12 4a7.8 7.8 0 0 1 8 7.5Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="m3 10 9-7 9 7v10H3V10Z"/><path d="M9 20v-7h6v7"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowRight: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  camera: '<path d="M4 7h4l2-2h4l2 2h4v12H4V7Z"/><circle cx="12" cy="13" r="3"/>',
}

const markup = computed(() => paths[props.name])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  />
</template>
