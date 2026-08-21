<template>
  <Toast />
  <RouterView />
</template>

<script setup lang="ts">
import { Toast } from 'primevue';
import { onMounted } from 'vue';
import { useAuth } from './composables/useAuth';
import { syncEvents } from './service/syncService';

const { initializeAuth } = useAuth();

onMounted(async () => {
  await initializeAuth();
  await syncEvents();
});
</script>
