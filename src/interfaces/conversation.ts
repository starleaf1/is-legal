import type { Timestamp } from 'firebase/firestore'
import type { Answer, Citation, SearchRecord, Verdict } from './answer'

export interface Conversation {
  id: string
  uid: string
  title: string
  lastVerdict: Verdict | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface UserMessage {
  id: string
  uid: string
  role: 'user'
  content: string
  createdAt: Timestamp | null
}

export interface AssistantMessage {
  id: string
  uid: string
  role: 'assistant'
  answer?: Answer
  citations?: Citation[]
  searches: SearchRecord[]
  error?: string
  model: string
  latencyMs: number
  createdAt: Timestamp | null
}

export type Message = UserMessage | AssistantMessage
