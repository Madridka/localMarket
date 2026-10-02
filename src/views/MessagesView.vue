<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import type { Chat } from '@/domain/types'
import { useListingsStore } from '@/stores/listings'
import { useMessagesStore } from '@/stores/messages'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { safeImage } from '@/utils/assets'
import { formatPrice, shortTime } from '@/utils/format'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messages = useMessagesStore()
const listings = useListingsStore()
const session = useSessionStore()
const ui = useUiStore()
const draft = ref('')

const selectedId = computed(() => String(route.params.chatId ?? ''))
const ordered = computed(() =>
  [...messages.chats].sort((a, b) => lastTimestamp(b) - lastTimestamp(a)),
)
const activeChat = computed(
  () => messages.chats.find((chat) => chat.id === selectedId.value) ?? null,
)
const activeListing = computed(() =>
  activeChat.value
    ? (listings.items.find((listing) => listing.id === activeChat.value?.listingId) ?? null)
    : null,
)
const activeSeller = computed(() =>
  activeChat.value ? (session.sellers.get(activeChat.value.sellerId) ?? null) : null,
)

function lastTimestamp(chat: Chat): number {
  const last = chat.messages.at(-1)
  return new Date(last?.timestamp ?? chat.createdAt ?? 0).getTime() || 0
}

function select(chatId: string): void {
  void router.push({ name: 'message', params: { chatId } })
}

async function submit(): Promise<void> {
  const text = draft.value.trim()
  if (!text || !activeChat.value) return
  await messages.send(activeChat.value.id, text)
  draft.value = ''
}

async function hydrateSellers(): Promise<void> {
  await Promise.all(messages.chats.map((chat) => session.getSeller(chat.sellerId)))
}

watch(
  () => messages.chats.length,
  () => void hydrateSellers(),
)

onMounted(async () => {
  await Promise.all([messages.load(), listings.load(), session.load()])
  await hydrateSellers()
  const listingId = String(route.query.listing ?? '')
  if (listingId) {
    const listing = await listings.get(listingId)
    if (!listing) ui.toast(t('toast.listingNotFound'))
    else if (listing.sellerId === session.user?.id) ui.toast(t('toast.ownListing'))
    else {
      const chat = await messages.ensure(listingId)
      if (chat) await router.replace({ name: 'message', params: { chatId: chat.id } })
    }
  } else if (!selectedId.value && ordered.value[0]) {
    await router.replace({ name: 'message', params: { chatId: ordered.value[0].id } })
  }
})
</script>

<template>
  <main class="page-container messages-page" tabindex="-1">
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ t('messages.eyebrow') }}</p>
        <h1>{{ t('messages.title') }}</h1>
        <p class="page-subtitle">{{ t('messages.subtitle') }}</p>
      </div>
    </div>
    <div class="messages-layout" :class="{ 'is-chat-open': activeChat }">
      <aside class="conversation-list" :aria-label="t('messages.conversations')">
        <div class="conversation-list__header">
          <h2>{{ t('messages.conversations') }}</h2>
          <span>{{ ordered.length }}</span>
        </div>
        <div v-if="ordered.length" class="conversation-list__items">
          <button
            v-for="chat in ordered"
            :key="chat.id"
            class="conversation-item"
            :class="{ 'is-active': chat.id === selectedId }"
            type="button"
            @click="select(chat.id)"
          >
            <span class="conversation-item__avatar"
              ><img
                v-if="listings.byId.get(chat.listingId)?.images[0]"
                :src="safeImage(listings.byId.get(chat.listingId)?.images[0])"
                alt=""
              /><span v-else>{{
                session.sellers.get(chat.sellerId)?.name.slice(0, 1) ?? '?'
              }}</span></span
            >
            <span class="conversation-item__details"
              ><span class="conversation-item__top"
                ><strong>{{
                  session.sellers.get(chat.sellerId)?.name ?? t('listing.seller')
                }}</strong
                ><time>{{ shortTime(chat.messages.at(-1)?.timestamp ?? '') }}</time></span
              ><span class="conversation-item__product">{{
                listings.byId.get(chat.listingId)?.title ?? t('messages.deleted')
              }}</span
              ><span class="conversation-item__preview"
                >{{ chat.messages.at(-1)?.sender === 'me' ? t('messages.you') : ''
                }}{{ chat.messages.at(-1)?.text ?? t('messages.start') }}</span
              ></span
            >
          </button>
        </div>
        <div v-else class="empty-state empty-state--compact conversation-list__empty">
          <h3>{{ t('messages.emptyListTitle') }}</h3>
          <p>{{ t('messages.emptyListText') }}</p>
          <RouterLink class="button button--secondary" :to="{ name: 'catalog' }">{{
            t('favorite.action')
          }}</RouterLink>
        </div>
      </aside>
      <section class="chat-panel" :aria-label="t('messages.title')">
        <template v-if="activeChat">
          <div class="chat-header">
            <button
              class="chat-back button button--text"
              type="button"
              @click="router.push({ name: 'messages' })"
            >
              ←
            </button>
            <div class="chat-header__seller">
              <RouterLink
                class="chat-header__title"
                :to="{ name: 'profile', params: { id: activeChat.sellerId } }"
                >{{ activeSeller?.name ?? t('listing.seller') }}</RouterLink
              ><span class="chat-header__meta">{{ activeSeller?.city }}</span>
            </div>
            <RouterLink
              v-if="activeListing"
              class="chat-product"
              :to="{ name: 'listing', params: { id: activeListing.id } }"
              ><img :src="safeImage(activeListing.images[0])" alt="" /><span
                ><strong>{{ activeListing.title }}</strong
                ><small>{{ formatPrice(activeListing.price) }}</small></span
              ></RouterLink
            ><span v-else class="chat-product chat-product--missing">{{
              t('messages.deleted')
            }}</span>
          </div>
          <div class="chat-messages" role="log" aria-live="polite">
            <div v-if="!activeChat.messages.length" class="chat-messages__intro">
              <strong>{{ t('messages.start') }}</strong>
              <p>{{ t('messages.startText') }}</p>
            </div>
            <div
              v-for="(message, index) in activeChat.messages"
              :key="message.timestamp + index"
              class="message-bubble"
              :class="message.sender === 'me' ? 'message-bubble--mine' : 'message-bubble--seller'"
            >
              <p class="whitespace-pre-line">{{ message.text }}</p>
              <time :datetime="message.timestamp">{{ shortTime(message.timestamp) }}</time>
            </div>
          </div>
          <form class="chat-composer" @submit.prevent="submit">
            <label class="sr-only" for="chat-input">{{ t('messages.placeholder') }}</label
            ><input
              id="chat-input"
              v-model="draft"
              type="text"
              maxlength="1000"
              :placeholder="t('messages.placeholder')"
            /><button class="button button--primary" type="submit">{{ t('messages.send') }}</button>
          </form>
        </template>
        <div v-else class="chat-empty">
          <h2>{{ t('messages.emptyTitle') }}</h2>
          <p>{{ t('messages.emptyText') }}</p>
          <RouterLink class="button button--primary" :to="{ name: 'catalog' }">{{
            t('messages.find')
          }}</RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>
