import type { Category, Scope } from '@/interfaces/answer'

export const CATEGORIES: Record<Category, { label: string, icon: string, color: string }> = {
  code_of_conduct: { label: 'Code of conduct', icon: 'mdi-handshake-outline', color: 'indigo' },
  company_policy: { label: 'Company policy', icon: 'mdi-file-document-outline', color: 'blue' },
  guidance: { label: 'Guidance', icon: 'mdi-lightbulb-outline', color: 'cyan-darken-2' },
  law: { label: 'Law', icon: 'mdi-gavel', color: 'deep-purple' },
  regulation: { label: 'Regulation', icon: 'mdi-bank-outline', color: 'purple' },
  case_record: { label: 'Case record', icon: 'mdi-folder-account-outline', color: 'brown' },
  other: { label: 'Other', icon: 'mdi-file-outline', color: 'grey' },
}

export const categoryStyle = (category?: string | null) =>
  CATEGORIES[category as Category] ?? CATEGORIES.other

export const SCOPE_LABELS: Record<Scope, string> = {
  policy: 'company policy',
  law: 'law',
  precedent: 'past cases',
  other: 'other documents',
}
