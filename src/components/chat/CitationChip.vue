<template>
  <v-chip
    class="citation-chip"
    :prepend-icon="category.icon"
    size="small"
    variant="tonal"
    @click="emit('open', citation)"
  >
    <span class="font-weight-bold mr-1">[{{ citation.ref }}]</span>
    <span class="text-truncate">{{ citation.title }}<template v-if="citation.heading"> › {{ citation.heading }}</template></span>
  </v-chip>
</template>

<script setup lang="ts">
  import type { Citation } from '@/interfaces/answer'
  import { categoryStyle } from '@/utils/categories'

  const props = defineProps<{ citation: Citation }>()
  const emit = defineEmits<{ open: [citation: Citation] }>()

  const category = computed(() => categoryStyle(props.citation.category))
</script>

<style scoped>
.citation-chip {
  max-width: 100%;
}
</style>
