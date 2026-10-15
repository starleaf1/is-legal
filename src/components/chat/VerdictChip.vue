<template>
  <v-chip
    :color="style.color"
    :prepend-icon="loading ? undefined : style.icon"
    :size="size"
    variant="flat"
  >
    <v-progress-circular
      v-if="loading"
      class="mr-2"
      indeterminate
      size="14"
      width="2"
    />
    <span class="font-weight-medium">{{ loading ? 'Researching…' : style.label }}</span>
  </v-chip>
</template>

<script setup lang="ts">
  import { verdictStyle } from '@/utils/verdicts'

  const props = withDefaults(defineProps<{
    verdict?: string | null
    size?: string
    loading?: boolean
  }>(), {
    verdict: null,
    size: 'default',
    loading: false,
  })

  const style = computed(() => verdictStyle(props.verdict))
</script>
