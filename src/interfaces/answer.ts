// Hand-written mirror of functions/src/shared/schemas.ts. Keep in sync.

export type Verdict =
  | 'permitted'
  | 'permitted_with_conditions'
  | 'prohibited'
  | 'needs_more_info'
  | 'unclear'
  | 'not_applicable'

export type Category =
  | 'code_of_conduct'
  | 'company_policy'
  | 'guidance'
  | 'law'
  | 'regulation'
  | 'case_record'
  | 'other'

export type Scope = 'policy' | 'law' | 'precedent' | 'other'

export interface Answer {
  verdict: Verdict
  confidence: 'high' | 'medium' | 'low'
  summary: string
  dimensions: Array<{
    source: 'law' | 'company_policy' | 'precedent'
    verdict: Verdict
    note: string
  }>
  analysis: string
  conditions: string[]
  escalation: {
    recommended: boolean
    contact: string | null
    reason: string | null
  }
  followUpQuestions: string[]
  citedSources: number[]
}

// While streaming, any field (and any nested field) may still be missing.
export type PartialAnswer = {
  [K in keyof Answer]?: Answer[K] extends Array<infer T>
    ? Array<Partial<T>>
    : Answer[K] extends object ? Partial<Answer[K]> : Answer[K]
}

export interface Citation {
  ref: number
  documentId: string
  chunkId: string
  title: string
  category: Category
  heading: string | null
  page: number | null
  excerpt: string
}

export interface SearchRecord {
  query: string
  scope: Scope | null
  documentId?: string | null
  resultCount?: number
  results?: Array<{ ref: number, title: string }>
}

export interface AskInput {
  message: string
  conversationId?: string
}

export type AskChunk =
  | { type: 'meta', conversationId: string }
  | { type: 'search', query: string, scope: Scope | null, results: Array<{ ref: number, title: string }> }
  | { type: 'answer', partial: PartialAnswer }

export interface AskResult {
  conversationId: string
  messageId: string
  answer: Answer
  citations: Citation[]
  disclaimer: string
}
