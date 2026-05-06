<template>
  <div class="px-2 pb-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <RouterLink v-for="deck in decks" :key="deck.id" :to="{ name: 'deck', params: { id: deck.id } }">
      <Card class="overflow-hidden transition-all duration-300 cursor-pointer ease-in-out hover:-translate-y-2 hover:drop-shadow-lg!">
        <template #header>
          <img class="w-full h-64 object-cover object-top" alt="Commander image" :src="deck.commanderImageUri" />
        </template>
        <template #title>{{ deck.name }}</template>
        <template #subtitle>Commander/EDH</template>
      </Card>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { db } from '@/db';
import { from, useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { Card } from 'primevue';

const decks = useObservable(from(liveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray())));
</script>
