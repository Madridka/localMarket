import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import ListingCard from '@/components/listings/ListingCard.vue'
import { seedListings } from '@/data/seed'
import { i18n } from '@/i18n'

describe('ListingCard', () => {
  it('renders typed listing data and an accessible favorite control', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'catalog', component: { template: '<div />' } },
        { path: '/listings/:id', name: 'listing', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(ListingCard, {
      props: { listing: seedListings[0]! },
      global: {
        plugins: [pinia, router, i18n],
      },
    })

    expect(wrapper.text()).toContain(seedListings[0]!.title)
    expect(wrapper.get('[aria-pressed]').attributes('aria-label')).toMatch(/избранное/i)

    await wrapper.get('.listing-card__link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(`/listings/${seedListings[0]!.id}`)
  })
})
