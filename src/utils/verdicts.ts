import type { Verdict } from '@/interfaces/answer'

interface VerdictStyle {
  label: string
  color: string
  icon: string
}

export const VERDICTS: Record<Verdict, VerdictStyle> = {
  permitted: { label: 'Permitted', color: 'success', icon: 'mdi-check-circle' },
  permitted_with_conditions: { label: 'Permitted with conditions', color: 'amber-darken-3', icon: 'mdi-alert-circle-check' },
  prohibited: { label: 'Prohibited', color: 'error', icon: 'mdi-close-octagon' },
  needs_more_info: { label: 'Need more information', color: 'info', icon: 'mdi-help-circle' },
  unclear: { label: 'Unclear', color: 'blue-grey', icon: 'mdi-scale-unbalanced' },
  not_applicable: { label: 'Not applicable', color: 'grey', icon: 'mdi-minus-circle' },
}

export const verdictStyle = (verdict?: string | null): VerdictStyle =>
  VERDICTS[verdict as Verdict] ?? { label: 'Thinking…', color: 'grey', icon: 'mdi-dots-horizontal' }

export const DIMENSION_LABELS: Record<string, string> = {
  law: 'Law',
  company_policy: 'Company policy',
  precedent: 'Past cases',
}
