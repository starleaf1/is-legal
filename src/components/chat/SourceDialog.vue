<template>
  <v-dialog max-width="720" :model-value="!!citation" scrollable @update:model-value="!$event && emit('close')">
    <v-card v-if="citation">
      <v-card-item>
        <template #prepend>
          <v-avatar color="primary" variant="tonal">{{ citation.ref }}</v-avatar>
        </template>
        <v-card-title class="text-wrap">{{ citation.title }}</v-card-title>
        <v-card-subtitle class="d-flex flex-wrap ga-2 mt-1 align-center">
          <v-chip :color="category.color" :prepend-icon="category.icon" size="small" variant="tonal">
            {{ category.label }}
          </v-chip>
          <span v-if="citation.heading">{{ citation.heading }}</span>
          <span v-if="citation.page">· page {{ citation.page }}</span>
        </v-card-subtitle>
      </v-card-item>
      <v-divider />
      <v-card-text>
        <div class="text-overline">Passage the answer relied on</div>
        <v-sheet class="excerpt pa-4" color="surface-variant" rounded="lg">{{ citation.excerpt }}</v-sheet>
      </v-card-text>
      <v-card-actions>
        <v-btn :loading="opening" prepend-icon="mdi-open-in-new" @click="openDocument">Open full document</v-btn>
        <v-spacer />
        <v-btn @click="emit('close')">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
  import type { Citation } from '@/interfaces/answer'
  import { useDocumentsStore } from '@/stores/documents'
  import { useToastStore } from '@/stores/toast'
  import { categoryStyle } from '@/utils/categories'

  const props = defineProps<{ citation: Citation | null }>()
  const emit = defineEmits<{ close: [] }>()

  const documentsStore = useDocumentsStore()
  const toastStore = useToastStore()
  const opening = ref(false)

  const category = computed(() => categoryStyle(props.citation?.category))

  const openDocument = async () => {
    if (!props.citation) return
    opening.value = true
    try {
      await documentsStore.open(props.citation.documentId, props.citation.page)
    } catch (error) {
      console.error(error)
      toastStore.displayToast({ content: 'Could not open the document. It may have been deleted.', toastType: 'error' })
    } finally {
      opening.value = false
    }
  }
</script>

<style scoped>
.excerpt {
  white-space: pre-wrap;
  font-size: 0.925rem;
  line-height: 1.55;
}
</style>
