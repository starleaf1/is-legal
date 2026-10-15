<template>
  <v-form @submit.prevent="submit">
    <v-textarea
      ref="input"
      v-model="model"
      auto-grow
      bg-color="surface"
      :disabled="disabled"
      hide-details
      max-rows="8"
      placeholder="Describe what you're planning to do, e.g. &quot;A supplier offered me concert tickets. Can I accept?&quot;"
      rounded="lg"
      rows="1"
      variant="outlined"
      @keydown.enter.exact.prevent="submit"
    >
      <template #append-inner>
        <v-btn
          color="primary"
          :disabled="!canSubmit"
          icon="mdi-arrow-up"
          :loading="loading"
          size="small"
          type="submit"
          variant="flat"
        />
      </template>
    </v-textarea>
  </v-form>
</template>

<script setup lang="ts">
  const model = defineModel<string>({ required: true })

  const props = withDefaults(defineProps<{
    loading?: boolean
    disabled?: boolean
  }>(), { loading: false, disabled: false })

  const emit = defineEmits<{ submit: [value: string] }>()

  const input = ref<{ focus: () => void } | null>(null)

  const canSubmit = computed(() => !props.loading && !props.disabled && model.value.trim().length > 0)

  const submit = () => {
    if (canSubmit.value) emit('submit', model.value.trim())
  }

  defineExpose({ focus: () => input.value?.focus() })
</script>
