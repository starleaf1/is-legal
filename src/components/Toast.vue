<script setup lang="ts">
  import { useToastStore } from '@/stores/toast';

  const toastStore = useToastStore();

  const handleToastAction = () => {
    if (toastStore.toastAction) {
      toastStore.toastAction.method();
      toastStore.clearToast();
    }
  };
</script>

<template>
  <v-snackbar
    v-model="toastStore.isDisplayed"
    :color="toastStore.type"
    :text="toastStore.message ?? ''"
  >
    <template v-if="toastStore.toastAction" #actions>
      <v-btn
        v-if="toastStore.toastAction"
        color="primary"
        @click="handleToastAction"
      >
        {{ toastStore.toastAction.label }}
      </v-btn>
    </template>
  </v-snackbar>
</template>
