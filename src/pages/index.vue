<script setup lang="ts">
  import { useRouter } from 'vue-router'

  // The router guard sends signed-out users to /login before this runs.
  useRouter().replace('/chat')
</script>

<template>
  <div />
</template>

<route lang="yaml">
  meta:
    title: Is Legal?
</route>
