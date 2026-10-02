import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastMessage {
  id: number
  text: string
}

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<ToastMessage[]>([])
  let nextId = 0

  function toast(text: string): void {
    const item = { id: ++nextId, text }
    toasts.value.push(item)
    window.setTimeout(() => removeToast(item.id), 3200)
  }

  function removeToast(id: number): void {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  return { toasts, toast, removeToast }
})
