<template>
  <div class="columns-1 gap-4 sm:columns-2 lg:columns-3">
    <div v-for="section in organizedDeckRows" :key="section.type" class="break-inside-avoid pb-6 mb-4">
      <h1 class="text-muted-color font-semibold pb-3">
        {{ section.type.toUpperCase() }}
      </h1>

      <ul v-if="section.rows?.length" class="flex flex-col gap-3">
        <li v-for="row in section.rows" :key="row.deckCard.id" class="flex gap-2 items-center">
          <img class="rounded w-12" :src="determineImageUri(row.cachedCard?.raw)" />
          {{ row.cachedCard?.raw.name ?? 'Unknown card' }}
        </li>
      </ul>

      <div v-else>No cards found.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { db, type CachedCard, type CardType, type DeckCard } from '@/db';
import { determineImageUri } from '@/service';
import { determineCardType } from '@/util/cards-util';
import { from, useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { computed } from 'vue';

interface DeckRow {
  deckCard: DeckCard;
  cachedCard: CachedCard | null;
}

const props = defineProps<{ deckId: string }>();

const deckRows = useObservable<DeckRow[]>(
  from(
    liveQuery(async () => {
      if (!props.deckId) {
        return [];
      }

      const deckCards = await db.deckCards.where('deckId').equals(props.deckId).toArray();

      if (!deckCards.length) {
        return [];
      }

      const oracleIds = [...new Set(deckCards.map((card) => card.oracleId))];

      const cachedCards = await db.cards.where('oracleId').anyOf(oracleIds).toArray();

      const cachedCardsByOracleId = new Map<string, CachedCard>(cachedCards.map((card) => [card.oracleId, card]));

      return deckCards.map((deckCard) => ({
        deckCard,
        cachedCard: cachedCardsByOracleId.get(deckCard.oracleId) ?? null
      }));
    })
  )
);

const organizedDeckRows = computed(() => {
  const map: Record<CardType, DeckRow[]> = {
    creature: [],
    sorcery: [],
    artifact: [],
    instant: [],
    enchantment: [],
    planeswalker: [],
    battle: [],
    land: [],
    unknown: []
  };

  for (const row of deckRows.value ?? []) {
    const card = row.cachedCard?.raw;
    if (!card) continue;

    const type = determineCardType(card);
    if (type) {
      map[type].push(row);
    }
  }

  return Object.entries(map)
    .filter(([, rows]) => rows.length > 0)
    .map(([type, rows]) => ({
      type: type as CardType,
      rows
    }));
});
</script>
