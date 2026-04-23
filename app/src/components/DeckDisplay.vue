<template>
  <div class="columns-1 gap-4 sm:columns-2 lg:columns-3">
    <div v-for="section in organizedDeckRows" :key="section.type" class="break-inside-avoid pb-6 mb-4">
      <h1 class="text-muted-color font-semibold pb-3">
        {{ section.type.toUpperCase() }}
      </h1>

      <ul v-if="section.rows?.length" class="flex flex-col gap-3">
        <li v-for="row in section.rows" :key="row.deckCard.id" class="flex gap-2 items-center">
          <img class="rounded w-12" :src="determineImageUri(row.scryfallCard)" />
          {{ row.scryfallCard?.name ?? 'Unknown card' }}
        </li>
      </ul>

      <div v-else>No cards found.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { db, type DeckCard } from '@/db';
import { determineImageUri } from '@/service';
import { determineCardType, type CardType } from '@/util/cards-util';
import { from, useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { Cards, type Card } from 'scryfall-api';
import { computed, ref, watch } from 'vue';

interface DeckRow {
  deckCard: DeckCard;
  scryfallCard: Card | null;
}

const props = defineProps<{ deckId: string }>();

const deckCards = useObservable(
  from(
    liveQuery(() => {
      return db.deckCards.where('deckId').equals(props.deckId).toArray();
    })
  )
);

const scryfallCardsByOracleId = ref<Record<string, Card>>({});
const isLoading = ref(false);

const uniqueOracleIds = computed(() => {
  return [...new Set(deckCards.value?.map((card) => card.oracleId))];
});

watch(
  uniqueOracleIds,
  async (oracleIds) => {
    if (!oracleIds.length) {
      scryfallCardsByOracleId.value = {};
      return;
    }

    isLoading.value = true;

    const cards = await Cards.collection(
      ...oracleIds.map((oracleId) => ({
        oracle_id: oracleId
      }))
    );

    const map: Record<string, Card> = {};

    for (const card of cards) {
      if (card.oracle_id) {
        map[card.oracle_id] = card;
      }
    }

    scryfallCardsByOracleId.value = map;

    isLoading.value = false;
  },
  { immediate: true }
);

const deckRows = computed<DeckRow[] | undefined>(() => {
  return deckCards.value?.map((deckCard) => ({
    deckCard,
    scryfallCard: scryfallCardsByOracleId.value[deckCard.oracleId] ?? null
  }));
});

const organizedDeckRows = computed(() => {
  const map: Record<CardType, DeckRow[]> = {
    creature: [],
    sorcery: [],
    artifact: [],
    instant: [],
    enchantment: [],
    planeswalker: [],
    battle: [],
    land: []
  };

  for (const row of deckRows.value ?? []) {
    const card = row.scryfallCard;
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
