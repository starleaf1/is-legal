<template>
  <v-card class="answer-card mb-6" elevation="1">
    <v-card-item>
      <div class="d-flex align-center flex-wrap ga-2">
        <VerdictChip :loading="streaming && !answer?.verdict" size="large" :verdict="answer?.verdict" />
        <v-chip v-if="answer?.confidence" size="small" variant="tonal">
          {{ answer.confidence }} confidence
        </v-chip>
        <v-spacer />
        <v-progress-circular
          v-if="streaming && answer?.verdict"
          color="primary"
          indeterminate
          size="18"
          width="2"
        />
      </div>
    </v-card-item>

    <v-card-text class="pt-1">
      <SearchActivity :searches="searches" :streaming="streaming && !answer?.summary" />

      <!-- eslint-disable vue/no-v-html -- sanitized by renderMarkdown -->
      <div
        v-if="answer?.summary"
        class="summary markdown text-body-1 font-weight-medium mb-3"
        @click="onRefClick"
        v-html="renderMarkdown(answer.summary)"
      />

      <div v-if="dimensions.length" class="d-flex flex-wrap ga-2 mb-3">
        <v-chip
          v-for="dimension in dimensions"
          :key="dimension.source"
          :color="verdictStyle(dimension.verdict).color"
          size="small"
          variant="tonal"
        >
          <v-icon class="mr-1" :icon="verdictStyle(dimension.verdict).icon" size="small" />
          {{ DIMENSION_LABELS[dimension.source ?? ''] ?? dimension.source }}:
          <span class="ml-1 font-weight-medium">{{ verdictStyle(dimension.verdict).label }}</span>
          <v-tooltip v-if="dimension.note" activator="parent" location="top" max-width="360">
            {{ stripRefs(dimension.note) }}
          </v-tooltip>
        </v-chip>
      </div>

      <v-alert
        v-if="answer?.escalation?.recommended"
        class="mb-3"
        density="compact"
        icon="mdi-account-alert"
        type="warning"
        variant="tonal"
      >
        <strong>Talk to {{ answer.escalation.contact || 'Legal or Compliance' }} before acting.</strong>
        <span v-if="answer.escalation.reason"> {{ answer.escalation.reason }}</span>
      </v-alert>

      <div v-if="conditions.length" class="mb-3">
        <div class="text-subtitle-2 mb-1">Before you proceed</div>
        <ul class="conditions">
          <li
            v-for="(condition, i) in conditions"
            :key="i"
            class="markdown"
            @click="onRefClick"
            v-html="renderMarkdown(condition)"
          />
        </ul>
      </div>

      <div v-if="answer?.analysis" class="analysis markdown text-body-2" @click="onRefClick" v-html="renderMarkdown(answer.analysis)" />
      <!-- eslint-enable vue/no-v-html -->

      <div v-if="followUps.length && !streaming" class="mt-4">
        <div class="text-subtitle-2 mb-1">To give a firmer answer, I'd need to know</div>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="(question, i) in followUps"
            :key="i"
            prepend-icon="mdi-reply"
            size="small"
            variant="outlined"
            @click="emit('follow-up', question)"
          >
            {{ question }}
          </v-chip>
        </div>
      </div>

      <div v-if="citations.length" class="mt-4">
        <div class="text-subtitle-2 mb-1">Sources</div>
        <div class="d-flex flex-column align-start ga-1">
          <CitationChip v-for="citation in citations" :key="citation.ref" :citation="citation" @open="selected = $event" />
        </div>
      </div>

      <div v-if="!streaming" class="text-caption text-medium-emphasis mt-4">
        Guidance based on your organization's documents. Not legal advice.
      </div>
    </v-card-text>

    <SourceDialog :citation="selected" @close="selected = null" />
  </v-card>
</template>

<script setup lang="ts">
  import type { Citation, PartialAnswer, SearchRecord } from '@/interfaces/answer'
  import { renderMarkdown, stripRefs } from '@/utils/markdown'
  import { DIMENSION_LABELS, verdictStyle } from '@/utils/verdicts'

  const props = withDefaults(defineProps<{
    answer: PartialAnswer | null
    citations?: Citation[]
    searches?: SearchRecord[]
    streaming?: boolean
  }>(), {
    citations: () => [],
    searches: () => [],
    streaming: false,
  })

  const emit = defineEmits<{ 'follow-up': [question: string] }>()

  const selected = ref<Citation | null>(null)

  const dimensions = computed(() => (props.answer?.dimensions ?? []).filter(d => d?.source && d?.verdict))
  const conditions = computed(() => (props.answer?.conditions ?? []).filter(Boolean))
  const followUps = computed(() => (props.answer?.followUpQuestions ?? []).filter(Boolean))

  // Citation markers in the rendered markdown carry data-ref.
  const onRefClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-ref]')
    if (!target) return
    event.preventDefault()
    const ref = Number(target.dataset.ref)
    selected.value = props.citations.find(c => c.ref === ref) ?? null
  }
</script>

<style scoped>
.markdown :deep(p) {
  margin-bottom: 0.6em;
}
.markdown :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown :deep(ul), .markdown :deep(ol) {
  padding-left: 1.4em;
  margin-bottom: 0.6em;
}
.markdown :deep(.cite) {
  white-space: nowrap;
}
.markdown :deep(.cite-ref) {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
  text-decoration: none;
}
.markdown :deep(.cite-ref:hover) {
  text-decoration: underline;
}
.conditions {
  padding-left: 1.4em;
}
.analysis {
  line-height: 1.6;
}
</style>
