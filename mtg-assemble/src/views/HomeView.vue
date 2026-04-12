<template>
  <div>
    <div class="flex items-center w-full sticky top-0 p-1">
      <Button size="large" icon="pi pi-bars" text @click="visible = true" />
      <span class="text-primary font-semibold text-lg ml-2">MTG Assemble</span>
    </div>
  </div>

  <RouterView />

  <Drawer v-model:visible="visible" pt:header="p-2!">
    <h1 class="text-muted-color font-semibold py-4">Decks</h1>
    <div class="flex flex-col gap-4">
      <RouterLink to="/decks/view" class="flex items-center gap-4 text-lg font-semibold">
        <i class="pi pi-list text-gray-500"></i>
        <span>View</span>
      </RouterLink>
      <RouterLink to="/decks/import" class="flex items-center gap-4 text-lg font-semibold">
        <i class="pi pi-plus text-gray-500"></i>
        <span>Import</span>
      </RouterLink>
    </div>
  </Drawer>
</template>

<script setup lang="ts">
import { Button, Drawer } from 'primevue';
import { ref } from 'vue';

const visible = ref(false);
</script>
