<template>
  <v-card>
    <v-card-item>
      <v-card-title>Add documents</v-card-title>
      <v-card-subtitle>
        PDF, Markdown or plain text, up to 10 MB. Each file is read, classified and indexed automatically.
      </v-card-subtitle>
    </v-card-item>
    <v-card-text>
      <v-select
        v-model="categoryHint"
        class="mb-3"
        density="comfortable"
        hide-details
        :items="categoryItems"
        label="Document type"
        variant="outlined"
      />
      <v-sheet
        class="dropzone d-flex flex-column align-center justify-center text-center pa-6"
        :class="{ 'dropzone--active': dragging }"
        rounded="lg"
        @click="input?.click()"
        @dragenter.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <v-icon color="primary" icon="mdi-cloud-upload-outline" size="40" />
        <div class="text-body-1 mt-2">Drop files here or <span class="text-primary font-weight-medium">browse</span></div>
        <input
          ref="input"
          :accept="ACCEPT_ATTRIBUTE"
          hidden
          multiple
          type="file"
          @change="onSelect"
        >
      </v-sheet>

      <div v-for="upload in documentsStore.uploads" :key="upload.id" class="mt-3">
        <div class="d-flex align-center text-body-2">
          <v-icon class="mr-2" :color="upload.error ? 'error' : undefined" :icon="upload.error ? 'mdi-alert-circle' : 'mdi-file-upload-outline'" size="small" />
          <span class="text-truncate">{{ upload.fileName }}</span>
          <v-spacer />
          <span v-if="!upload.error" class="text-medium-emphasis">{{ upload.progress }}%</span>
          <v-btn
            v-else
            icon="mdi-close"
            size="x-small"
            variant="text"
            @click="documentsStore.dismissUpload(upload.id)"
          />
        </div>
        <v-progress-linear
          v-if="!upload.error"
          class="mt-1"
          color="primary"
          :model-value="upload.progress"
          rounded
        />
        <div v-else class="text-caption text-error">{{ upload.error }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import type { Category } from '@/interfaces/answer'
  import { useDocumentsStore } from '@/stores/documents'
  import { useToastStore } from '@/stores/toast'
  import { CATEGORIES } from '@/utils/categories'
  import { ACCEPT_ATTRIBUTE } from '@/utils/files'

  const documentsStore = useDocumentsStore()
  const toastStore = useToastStore()

  const input = ref<HTMLInputElement | null>(null)
  const dragging = ref(false)
  const categoryHint = ref<Category | null>(null)

  const categoryItems = [
    { title: 'Detect automatically', value: null },
    ...Object.entries(CATEGORIES).map(([value, { label }]) => ({ title: label, value })),
  ]

  const uploadAll = async (files: File[]) => {
    const results = await Promise.allSettled(
      files.map(file => documentsStore.upload(file, { categoryHint: categoryHint.value })),
    )
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    if (failed.length) {
      toastStore.displayToast({
        content: failed.map(f => f.reason instanceof Error ? f.reason.message : String(f.reason)).join(' '),
        toastType: 'error',
      })
    }
  }

  const onDrop = (event: DragEvent) => {
    dragging.value = false
    uploadAll([...(event.dataTransfer?.files ?? [])])
  }

  const onSelect = (event: Event) => {
    const target = event.target as HTMLInputElement
    uploadAll([...(target.files ?? [])])
    target.value = ''
  }
</script>

<style scoped>
.dropzone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.35);
  cursor: pointer;
  transition: background-color 0.15s;
}
.dropzone--active, .dropzone:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
