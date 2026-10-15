<template>
  <v-card>
    <v-card-item>
      <v-card-title>Knowledge base</v-card-title>
      <v-card-subtitle>
        {{ indexedCount }} of {{ documentsStore.documents.length }} documents indexed and available to the assistant
      </v-card-subtitle>
      <template #append>
        <v-text-field
          v-model="search"
          density="compact"
          hide-details
          placeholder="Filter"
          prepend-inner-icon="mdi-magnify"
          style="min-width: 220px"
          variant="outlined"
        />
      </template>
    </v-card-item>
    <v-data-table
      v-model:expanded="expanded"
      :headers="headers"
      item-value="id"
      :items="rows"
      :loading="!documentsStore.loaded"
      no-data-text="No documents yet. Upload your code of conduct, policies, relevant laws and past cases."
      :search="search"
      show-expand
    >
      <template #[`item.title`]="{ item }">
        <div class="py-2">
          <div class="font-weight-medium">{{ item.title }}</div>
          <div class="text-caption text-medium-emphasis">{{ item.fileName }} · {{ formatBytes(item.sizeBytes) }}</div>
        </div>
      </template>
      <template #[`item.category`]="{ item }">
        <CategoryChip v-if="item.classification" :category="item.classification.category" />
        <span v-else class="text-medium-emphasis">–</span>
      </template>
      <template #[`item.status`]="{ item }">
        <StatusChip :error="item.error" :stage="item.stage" :status="item.status" />
      </template>
      <template #[`item.actions`]="{ item }">
        <div class="d-flex justify-end">
          <v-btn
            icon="mdi-open-in-new"
            size="small"
            title="Open file"
            variant="text"
            @click="open(item.id)"
          />
          <v-btn
            :disabled="item.status === 'processing'"
            icon="mdi-refresh"
            :loading="busy === item.id"
            size="small"
            title="Re-index"
            variant="text"
            @click="reindex(item.id)"
          />
          <v-btn
            color="error"
            icon="mdi-delete-outline"
            size="small"
            title="Delete"
            variant="text"
            @click="toDelete = item"
          />
        </div>
      </template>
      <template #expanded-row="{ columns, item }">
        <tr>
          <td class="py-3" :colspan="columns.length">
            <div v-if="item.classification">
              <p class="text-body-2 mb-2">{{ item.classification.summary }}</p>
              <div class="text-caption text-medium-emphasis mb-2">
                <span v-if="item.classification.issuingBody">Issued by {{ item.classification.issuingBody }} · </span>
                <span v-if="item.classification.effectiveDate">Effective {{ item.classification.effectiveDate }} · </span>
                {{ item.chunkCount ?? 0 }} passages indexed
                <span v-if="item.pageCount"> · {{ item.pageCount }} pages</span>
              </div>
              <div class="d-flex flex-wrap ga-1">
                <v-chip v-for="topic in item.classification.topics" :key="topic" size="x-small">{{ topic }}</v-chip>
              </div>
            </div>
            <div v-else-if="item.error" class="text-body-2 text-error">{{ item.error }}</div>
            <div v-else class="text-body-2 text-medium-emphasis">Not classified yet.</div>
          </td>
        </tr>
      </template>
    </v-data-table>

    <ConfirmationDialog
      color="error"
      confirm-text="Delete"
      :loading="deleting"
      :model-value="!!toDelete"
      title="Delete document?"
      @confirm="confirmDelete"
      @update:model-value="!$event && (toDelete = null)"
    >
      <strong>{{ toDelete?.title }}</strong> and its indexed passages will be removed. The assistant will no
      longer use or cite it.
    </ConfirmationDialog>
  </v-card>
</template>

<script setup lang="ts">
  import type { OrgDocument } from '@/interfaces/document'
  import { useDocumentsStore } from '@/stores/documents'
  import { useToastStore } from '@/stores/toast'
  import { formatBytes } from '@/utils/files'

  const documentsStore = useDocumentsStore()
  const toastStore = useToastStore()

  const search = ref('')
  const expanded = ref<string[]>([])
  const busy = ref<string | null>(null)
  const toDelete = ref<OrgDocument | null>(null)
  const deleting = ref(false)

  const headers = [
    { title: 'Title', key: 'title' },
    { title: 'Type', key: 'category', sortable: false },
    { title: 'Jurisdiction', key: 'jurisdiction' },
    { title: 'Status', key: 'status' },
    { title: '', key: 'actions', sortable: false, align: 'end' as const },
  ]

  // Flatten fields the table sorts and filters on.
  const rows = computed(() => documentsStore.documents.map(d => ({
    ...d,
    jurisdiction: d.classification?.jurisdiction ?? '',
    categoryLabel: d.classification?.category ?? '',
  })))

  const indexedCount = computed(() => documentsStore.documents.filter(d => d.status === 'indexed').length)

  const open = async (id: string) => {
    try {
      await documentsStore.open(id)
    } catch (error) {
      console.error(error)
      toastStore.displayToast({ content: 'Could not open the file.', toastType: 'error' })
    }
  }

  const reindex = async (id: string) => {
    busy.value = id
    try {
      const { data } = await documentsStore.reindex(id)
      toastStore.displayToast({
        content: data.status === 'indexed' ? 'Document re-indexed.' : `Re-indexing failed: ${data.error}`,
        toastType: data.status === 'indexed' ? 'success' : 'error',
      })
    } catch (error) {
      console.error(error)
      toastStore.displayToast({ content: 'Re-indexing failed.', toastType: 'error' })
    } finally {
      busy.value = null
    }
  }

  const confirmDelete = async () => {
    if (!toDelete.value) return
    deleting.value = true
    try {
      await documentsStore.remove(toDelete.value.id)
      toastStore.displayToast({ content: 'Document deleted.', toastType: 'success' })
      toDelete.value = null
    } catch (error) {
      console.error(error)
      toastStore.displayToast({ content: 'Could not delete the document.', toastType: 'error' })
    } finally {
      deleting.value = false
    }
  }
</script>
