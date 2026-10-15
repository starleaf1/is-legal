import type { Category } from '@/interfaces/answer'
import type { OrgDocument } from '@/interfaces/document'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getBlob, ref as storageRef, uploadBytesResumable } from 'firebase/storage'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, functions, storage } from '@/plugins/firebase'
import { contentTypeFor, MAX_UPLOAD_BYTES } from '@/utils/files'
import { useAuthStore } from './auth'

export interface UploadTask {
  id: string
  fileName: string
  progress: number
  error: string | null
}

const deleteDocumentCall = httpsCallable<{ documentId: string }, { deleted: boolean }>(
  functions, 'deleteDocument')
const reindexDocumentCall = httpsCallable<{ documentId: string }, { status: string, error: string | null }>(
  functions, 'reindexDocument', { timeout: 540_000 })

export const useDocumentsStore = defineStore('documents', () => {
  const authStore = useAuthStore()

  const documents = ref<OrgDocument[]>([])
  const loaded = ref(false)
  const uploads = ref<UploadTask[]>([])

  const documentsPath = () => `orgs/${authStore.orgId}/documents`

  /** Live list of the org's documents. Returns unsubscribe. */
  const listen = () => {
    if (!authStore.orgId) return () => {}
    const q = query(collection(db, documentsPath()), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snapshot => {
      documents.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as OrgDocument)
      loaded.value = true
    }, error => console.warn('[documents] listener stopped', error))
  }

  /**
   * Uploads a file to orgs/{orgId}/documents/{docId}/{fileName}. The
   * onDocumentUploaded function then creates the document record and indexes
   * it; the live list shows its progress.
   */
  const upload = async (file: File, options: { title?: string, categoryHint?: Category | null } = {}) => {
    const contentType = contentTypeFor(file.name)
    if (!contentType) throw new Error(`${file.name}: only PDF, text and Markdown files are supported.`)
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: files must be under 10 MB.`)

    // A client-generated id; nothing is written to Firestore here.
    const docId = doc(collection(db, documentsPath())).id
    const task: UploadTask = { id: docId, fileName: file.name, progress: 0, error: null }
    uploads.value.push(task)
    const tracked = uploads.value[uploads.value.length - 1]

    // Without a title, the indexer uses the title the classifier finds.
    const metadata: Record<string, string> = { uploadedBy: authStore.uid ?? '' }
    if (options.title?.trim()) metadata.title = options.title.trim()
    if (options.categoryHint) metadata.categoryHint = options.categoryHint

    // Storage object names can't contain some characters; keep it simple.
    const safeName = file.name.replace(/[^\w.\- ]+/g, '_')
    const path = `${documentsPath()}/${docId}/${safeName}`
    try {
      await new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef(storage, path), file, {
          contentType,
          customMetadata: metadata,
        })
        uploadTask.on('state_changed', snapshot => {
          tracked.progress = Math.round(100 * snapshot.bytesTransferred / snapshot.totalBytes)
        }, reject, () => resolve())
      })
      uploads.value = uploads.value.filter(u => u.id !== docId)
    } catch (error) {
      tracked.error = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  const dismissUpload = (id: string) => {
    uploads.value = uploads.value.filter(u => u.id !== id)
  }

  const remove = (documentId: string) => deleteDocumentCall({ documentId })

  const reindex = (documentId: string) => reindexDocumentCall({ documentId })

  /** Opens a document's file in a new tab, read through the Storage rules. */
  const open = async (documentId: string, page?: number | null) => {
    // Open the tab synchronously so popup blockers allow it.
    const tab = window.open('', '_blank')
    try {
      const snapshot = await getDoc(doc(db, documentsPath(), documentId))
      const path = snapshot.get('storagePath') as string | undefined
      if (!path) throw new Error('Document not found')
      const blob = await getBlob(storageRef(storage, path))
      const type = snapshot.get('mimeType') === 'text/markdown' ? 'text/plain' : blob.type
      const url = URL.createObjectURL(new Blob([blob], { type: `${type};charset=utf-8` }))
      const target = page && type === 'application/pdf' ? `${url}#page=${page}` : url
      if (tab) tab.location.href = target
      else window.open(target, '_blank')
    } catch (error) {
      tab?.close()
      throw error
    }
  }

  const reset = () => {
    documents.value = []
    loaded.value = false
    uploads.value = []
  }

  return { documents, loaded, uploads, listen, upload, dismissUpload, remove, reindex, open, reset }
})
