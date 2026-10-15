<template>
  <v-chip :color="style.color" :prepend-icon="style.icon" size="small" variant="tonal">{{ style.label }}</v-chip>
</template>

<script setup lang="ts">
  import { categoryStyle } from '@/utils/categories'

  const props = defineProps<{ category?: string | null }>()
  const style = computed(() => categoryStyle(props.category))
</script>
