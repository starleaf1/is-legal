<template>
  <div v-if="active" class="search-activity mb-3">
    <div v-for="(search, i) in searches" :key="i" class="d-flex align-center text-body-2 text-medium-emphasis py-1">
      <v-icon class="mr-2" icon="mdi-magnify" size="small" />
      <span>
        Searched {{ scopeLabel(search.scope) }} for <q class="font-italic">{{ search.query }}</q>
        <span class="ml-1">· {{ countLabel(search) }}</span>
      </span>
    </div>
    <div v-if="streaming" class="d-flex align-center text-body-2 text-medium-emphasis py-1">
      <v-progress-circular class="mr-2" indeterminate size="16" width="2" />
      {{ searches.length ? 'Reviewing passages…' : 'Searching your organization\'s documents…' }}
    </div>
  </div>
  <v-expansion-panels v-else-if="searches.length" class="mb-3" flat>
    <v-expansion-panel bg-color="transparent">
      <v-expansion-panel-title class="px-0 py-1 text-body-2 text-medium-emphasis" style="min-height: 0">
        <v-icon class="mr-2" icon="mdi-magnify" size="small" />
        Searched {{ searches.length }} time{{ searches.length === 1 ? '' : 's' }}
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <div v-for="(search, i) in searches" :key="i" class="text-body-2 text-medium-emphasis py-1">
          {{ scopeLabel(search.scope) }}: <q class="font-italic">{{ search.query }}</q> · {{ countLabel(search) }}
        </div>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
  import type { SearchRecord } from '@/interfaces/answer'
  import { SCOPE_LABELS } from '@/utils/categories'

  const props = withDefaults(defineProps<{
    searches: SearchRecord[]
    streaming?: boolean
  }>(), { streaming: false })

  // Show the live list while streaming; collapse it once answered.
  const active = computed(() => props.streaming)

  const scopeLabel = (scope: SearchRecord['scope']) =>
    scope ? SCOPE_LABELS[scope] : 'all documents'

  const countLabel = (search: SearchRecord) => {
    const count = search.results?.length ?? search.resultCount ?? 0
    return count ? `${count} passage${count === 1 ? '' : 's'}` : 'nothing relevant'
  }
</script>
