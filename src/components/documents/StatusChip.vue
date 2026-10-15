<template>
  <v-chip :color="style.color" size="small" variant="tonal">
    <v-progress-circular
      v-if="status === 'processing'"
      class="mr-2"
      indeterminate
      size="12"
      width="2"
    />
    <v-icon v-else class="mr-1" :icon="style.icon" size="small" />
    {{ style.label }}
    <v-tooltip v-if="status === 'error' && error" activator="parent" location="top" max-width="360">{{ error }}</v-tooltip>
  </v-chip>
</template>

<script setup lang="ts">
  import type { DocumentStage, DocumentStatus } from '@/interfaces/document'

  const props = defineProps<{
    status: DocumentStatus
    stage?: DocumentStage
    error?: string
  }>()

  const STAGES: Record<DocumentStage, string> = {
    extracting: 'Reading text…',
    classifying: 'Classifying…',
    embedding: 'Indexing passages…',
  }

  const style = computed(() => {
    switch (props.status) {
      case 'indexed': {
        return { label: 'Indexed', color: 'success', icon: 'mdi-check' }
      }
      case 'error': {
        return { label: 'Failed', color: 'error', icon: 'mdi-alert-circle-outline' }
      }
      default: {
        return { label: (props.stage && STAGES[props.stage]) || 'Processing…', color: 'info', icon: '' }
      }
    }
  })
</script>
