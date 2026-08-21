<template>
  <Toast />
  <RouterView />
</template>

<script setup lang="ts">
import { Toast } from 'primevue';
import { onMounted } from 'vue';
import { useAuth } from './composables/useAuth';

const { initializeAuth } = useAuth();

onMounted(() => {
  initializeAuth();
});
</script>
