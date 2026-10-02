import { createI18n } from 'vue-i18n'

import ru from '@/i18n/ru'

export const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'ru',
  messages: { ru },
  numberFormats: {
    ru: {
      currency: { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 },
    },
  },
  datetimeFormats: {
    ru: {
      short: { day: 'numeric', month: 'long' },
      time: { hour: '2-digit', minute: '2-digit' },
    },
  },
})
