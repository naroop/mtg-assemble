<template>
  <div class="px-2 pb-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <RouterLink v-for="deck in decks" :key="deck.id" :to="{ name: 'deck', params: { id: deck.id } }">
      <Card class="overflow-hidden transition-all duration-300 cursor-pointer ease-in-out hover:-translate-y-2 hover:drop-shadow-lg!">
        <template #header>
          <img class="w-full h-64 object-cover object-top" alt="Commander image" :src="deck.commanderImageUri" />
        </template>
        <template #title>{{ deck.name }}</template>
        <template #subtitle>
          <div class="flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <div>Commander/EDH</div>
              <Message :severity="deck.quantityAcquired === deck.quantity ? 'success' : 'warn'"
                >{{ deck.quantityAcquired }} / {{ deck.quantity }} {{ deck.quantityAcquired === deck.quantity ? '' : 'cards acquired' }}</Message
              >
            </div>
          </div>
        </template>
      </Card>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { db } from '@/db';
import { from, useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { Card, Message } from 'primevue';

const decks = useObservable(
  from(
    liveQuery(async () => {
      const [deckList, deckCards] = await Promise.all([db.decks.toArray(), db.deckCards.toArray()]);

      const lastActivityByDeckId = new Map(deckList.map((deck) => [deck.id, deck.updatedAt]));
      const quantityByDeckId = new Map<string, number>();
      const quantityAcquiredByDeckId = new Map<string, number>();

      for (const deckCard of deckCards) {
        const lastActivity = lastActivityByDeckId.get(deckCard.deckId);

        if (!lastActivity || deckCard.updatedAt > lastActivity) {
          lastActivityByDeckId.set(deckCard.deckId, deckCard.updatedAt);
        }

        quantityByDeckId.set(deckCard.deckId, (quantityByDeckId.get(deckCard.deckId) ?? 0) + deckCard.quantity);
        quantityAcquiredByDeckId.set(deckCard.deckId, (quantityAcquiredByDeckId.get(deckCard.deckId) ?? 0) + deckCard.quantityAcquired);
      }

      return deckList
        .map((deck) => ({
          ...deck,
          quantity: quantityByDeckId.get(deck.id) ?? 0,
          quantityAcquired: quantityAcquiredByDeckId.get(deck.id) ?? 0
        }))
        .sort((a, b) => lastActivityByDeckId.get(b.id)!.localeCompare(lastActivityByDeckId.get(a.id)!));
    })
  )
);
</script>
