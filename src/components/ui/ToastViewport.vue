<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="toast-container" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <button
        v-for="toast in ui.toasts"
        :key="toast.id"
        type="button"
        class="toast"
        @click="ui.removeToast(toast.id)"
      >
        {{ toast.text }}
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
