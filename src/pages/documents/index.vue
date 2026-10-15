<template>
  <v-container class="py-6" style="max-width: 1200px">
    <div class="mb-4">
      <h1 class="text-h5 font-weight-bold">Documents</h1>
      <p class="text-body-2 text-medium-emphasis">
        The assistant answers only from what's here: your code of conduct, company policies, the laws and
        regulations that apply to you, and records of past cases.
      </p>
    </div>
    <v-row>
      <v-col cols="12" lg="4">
        <UploadDropzone />
      </v-col>
      <v-col cols="12" lg="8">
        <DocumentTable />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { useDocumentsStore } from '@/stores/documents'

  const documentsStore = useDocumentsStore()

  let unsubscribe = () => {}
  onMounted(() => {
    unsubscribe = documentsStore.listen()
  })
  onUnmounted(() => unsubscribe())
</script>

<route lang="yaml">
  meta:
    title: Documents
    requiresAdmin: true
</route>
