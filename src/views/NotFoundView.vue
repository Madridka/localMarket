<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import EmptyState from '@/components/ui/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <main class="page-container">
    <EmptyState :title="t('notFound.title')" :text="t('notFound.text')"
      ><RouterLink class="button button--primary" :to="{ name: 'catalog' }">{{
        t('notFound.action')
      }}</RouterLink></EmptyState
    >
  </main>
</template>
