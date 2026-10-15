<template>
  <v-dialog v-model="model" max-width="440">
    <v-card :title="title">
      <v-card-text>
        <slot>{{ message }}</slot>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="loading" @click="model = false">Cancel</v-btn>
        <v-btn :color="color" :loading="loading" variant="flat" @click="emit('confirm')">{{ confirmText }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
  const model = defineModel<boolean>({ required: true })

  withDefaults(defineProps<{
    title: string
    message?: string
    confirmText?: string
    color?: string
    loading?: boolean
  }>(), {
    message: '',
    confirmText: 'Confirm',
    color: 'primary',
    loading: false,
  })

  const emit = defineEmits<{ confirm: [] }>()
</script>
