<template>
  <div
    class="fixed inset-x-0 top-0 z-10 h-14 bg-linear-to-b dark:from-surface-900/90 from-surface-100/90 from-90% to-transparent pointer-events-none"></div>

  <div class="lg:px-28 2xl:px-64">
    <div class="sticky flex items-center w-full top-0 z-20 p-1 pt-2 pb-4">
      <Button class="sm:hidden!" size="large" icon="pi pi-bars" text @click="visible = true" />
      <span class="text-primary font-semibold text-lg font-mono ml-2">MTG Assemble</span>
      <div class="hidden sm:flex items-center ml-8 gap-5">
        <Button as="RouterLink" to="/decks" active-class="font-bold" text severity="contrast">My Decks</Button>
        <Button as="RouterLink" to="/decks/import" active-class="font-bold" text severity="contrast">Import</Button>
      </div>
    </div>

    <RouterView v-slot="{ Component, route }">
      <Transition :name="transitionName" mode="out-in">
        <div :key="(route.meta.group as string | undefined) ?? route.path">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>

    <Drawer v-model:visible="visible" pt:header="p-2!">
      <h1 class="text-muted-color font-semibold py-4">Decks</h1>
      <div class="flex flex-col gap-4">
        <RouterLink to="/decks" class="flex items-center gap-4 text-lg font-semibold" @click="visible = false">
          <i class="pi pi-list text-gray-500"></i>
          <span>View</span>
        </RouterLink>
        <RouterLink to="/decks/import" class="flex items-center gap-4 text-lg font-semibold" @click="visible = false">
          <i class="pi pi-plus text-gray-500"></i>
          <span>Import</span>
        </RouterLink>
      </div>
      <h1 class="text-muted-color font-semibold py-4">Advanced</h1>
      <div class="flex flex-col gap-4">
        <RouterLink to="/dev" class="flex items-center gap-4 text-lg font-semibold" @click="visible = false">
          <i class="pi pi-list text-gray-500"></i>
          <span>Developer Tools</span>
        </RouterLink>
      </div>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { transitionName } from '@/router/transition';
import { Button, Drawer } from 'primevue';
import { ref } from 'vue';

const visible = ref(false);
</script>
