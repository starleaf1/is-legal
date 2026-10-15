import type { Timestamp } from 'firebase/firestore'
import type { Category, Scope } from './answer'

export type DocumentStatus = 'processing' | 'indexed' | 'error'
export type DocumentStage = 'extracting' | 'classifying' | 'embedding'

export interface Classification {
  title: string
  category: Category
  scope: Scope
  jurisdiction: string | null
  issuingBody: string | null
  effectiveDate: string | null
  topics: string[]
  summary: string
  language: string
}

export interface OrgDocument {
  id: string
  title: string
  fileName: string
  storagePath: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string | null
  status: DocumentStatus
  stage?: DocumentStage
  error?: string
  classification?: Classification
  chunkCount?: number
  pageCount?: number | null
  createdAt: Timestamp | null
  indexedAt?: Timestamp | null
}
