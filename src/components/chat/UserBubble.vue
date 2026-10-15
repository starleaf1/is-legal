<template>
  <div class="d-flex justify-end mb-4">
    <v-sheet class="user-bubble px-4 py-3" color="primary" rounded="xl">{{ text }}</v-sheet>
  </div>
</template>

<script setup lang="ts">
  defineProps<{ text: string }>()
</script>

<style scoped>
.user-bubble {
  max-width: 80%;
  white-space: pre-wrap;
  border-bottom-right-radius: 6px !important;
}
</style>
