import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Chat, EntityId } from '@/domain/types'
import { messagingRepository } from '@/services/repositories'
import { sameId } from '@/utils/ids'

export const useMessagesStore = defineStore('messages', () => {
  const chats = ref<Chat[]>([])
  const loaded = ref(false)

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    chats.value = await messagingRepository.list()
    loaded.value = true
  }

  async function ensure(listingId: EntityId): Promise<Chat | null> {
    const chat = await messagingRepository.ensure(listingId)
    if (chat && !chats.value.some((item) => sameId(item.id, chat.id))) chats.value.unshift(chat)
    return chat
  }

  async function send(chatId: EntityId, text: string): Promise<Chat | null> {
    const updated = await messagingRepository.send(chatId, text)
    if (updated) {
      chats.value = chats.value.map((chat) => (sameId(chat.id, chatId) ? updated : chat))
    }
    return updated
  }

  return { chats, loaded, load, ensure, send }
})
