import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import CatalogView from '@/views/CatalogView.vue'
import { i18n } from '@/i18n'

describe('CatalogView', () => {
  it('restores filters from the route and keeps sort in the URL', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'catalog', component: CatalogView },
        { path: '/listings/:id', name: 'listing', component: { template: '<div />' } },
      ],
    })
    await router.push('/?city=tomsk&radius=120&category=kitchen-chairs')
    await router.isReady()

    const wrapper = mount(CatalogView, {
      global: { plugins: [pinia, router, i18n] },
    })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Кухонные стулья')
    expect(wrapper.findAll('.listing-card')).toHaveLength(1)
    expect((wrapper.get('#location-radius').element as HTMLInputElement).value).toBe('120')

    await wrapper.get('#location-radius').setValue('140')
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    await flushPromises()
    expect(router.currentRoute.value.query.radius).toBe('140')

    await wrapper.get('#sort-select').setValue('price-asc')
    await flushPromises()
    expect(router.currentRoute.value.query.sort).toBe('price-asc')
  })
})
