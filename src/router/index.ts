import {
  createRouter,
  createWebHistory,
  type LocationQueryRaw,
  type RouteLocationRaw,
} from 'vue-router'

import CatalogView from '@/views/CatalogView.vue'
import FavoritesView from '@/views/FavoritesView.vue'
import ListingDetailView from '@/views/ListingDetailView.vue'
import ListingEditorView from '@/views/ListingEditorView.vue'
import MessagesView from '@/views/MessagesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import ProfileView from '@/views/ProfileView.vue'
import { i18n } from '@/i18n'

function legacyRedirect(name: string, query: LocationQueryRaw): RouteLocationRaw {
  return { name, query }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.fullPath !== from.fullPath) return { top: 0 }
  },
  routes: [
    { path: '/', name: 'catalog', component: CatalogView },
    {
      path: '/listings/new',
      name: 'listing-new',
      component: ListingEditorView,
    },
    {
      path: '/listings/:id/edit',
      name: 'listing-edit',
      component: ListingEditorView,
    },
    {
      path: '/listings/:id',
      name: 'listing',
      component: ListingDetailView,
    },
    { path: '/favorites', name: 'favorites', component: FavoritesView },
    { path: '/messages', name: 'messages', component: MessagesView },
    {
      path: '/messages/:chatId',
      name: 'message',
      component: MessagesView,
    },
    {
      path: '/profiles/me',
      name: 'profile-me',
      component: ProfileView,
    },
    { path: '/profiles/:id', name: 'profile', component: ProfileView },
    { path: '/index.html', redirect: (to) => legacyRedirect('catalog', to.query) },
    {
      path: '/listing.html',
      redirect: (to) => ({ name: 'listing', params: { id: String(to.query.id ?? '') } }),
    },
    {
      path: '/create.html',
      redirect: (to) =>
        to.query.edit
          ? { name: 'listing-edit', params: { id: String(to.query.edit) } }
          : { name: 'listing-new' },
    },
    { path: '/favorites.html', redirect: { name: 'favorites' } },
    {
      path: '/messages.html',
      redirect: (to) =>
        to.query.chat
          ? { name: 'message', params: { chatId: String(to.query.chat) }, query: to.query }
          : legacyRedirect('messages', to.query),
    },
    {
      path: '/profile.html',
      redirect: (to) =>
        to.query.id
          ? { name: 'profile', params: { id: String(to.query.id) } }
          : { name: 'profile-me' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
})

router.onError((error, to) => {
  console.error(`[router] Navigation to ${to.fullPath} failed`, error)
})

router.afterEach((to) => {
  if (to.name === 'catalog') {
    document.title = `${i18n.global.t('app.name')} — ${i18n.global.t('app.tagline')}`
  }
})
