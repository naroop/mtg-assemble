<template>
  <InputText v-show="filter" v-model="filterValue" class="mb-5!" size="small" />
  <div class="columns-1 gap-4" :class="[!singleColumn ? 'sm:columns-2 lg:columns-3' : '']">
    <div
      v-for="section in organizedDeckRows.filter(
        (section) => section.rows.filter((row) => row.cachedCard?.raw.name.toLowerCase().includes(filterValue.toLowerCase())).length > 0
      )"
      :key="section.type"
      class="break-inside-avoid pb-6 mb-4">
      <h1 class="text-muted-color font-semibold pb-3">
        {{ section.type.toUpperCase() }}
      </h1>

      <ul v-if="section.rows?.length" class="flex flex-col" :class="[select ? 'gap-0.5' : 'gap-3']">
        <li
          v-for="row in section.rows.filter((row) => row.cachedCard?.raw.name.toLowerCase().includes(filterValue.toLowerCase()))"
          :key="row.deckCard.id"
          class="flex gap-2 items-center rounded transition"
          :class="[
            select ? 'cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 p-2' : '',
            modelValue.includes(row.deckCard.id) ? 'bg-primary-50 dark:bg-primary-900/20' : '',
            select && modelValue.length > 0 && !modelValue.includes(row.deckCard.id) ? 'opacity-50' : ''
          ]"
          @click="handleRowClick(row.deckCard.id)">
          <Checkbox
            v-if="select"
            binary
            :model-value="modelValue.includes(row.deckCard.id)"
            @update:model-value="toggleSelection(row.deckCard.id)"
            @click.stop />

          <img
            class="rounded w-12"
            :class="[row.deckCard.quantity === row.deckCard.quantityAcquired ? 'opacity-20' : '']"
            :src="determineImageUri(row.cachedCard?.raw)" />
          <span :class="[row.deckCard.quantity === row.deckCard.quantityAcquired ? 'opacity-20' : '']">{{
            row.cachedCard?.raw.name ?? 'Unknown card'
          }}</span>
          <i v-show="row.deckCard.quantity === row.deckCard.quantityAcquired" class="pi pi-check"></i>
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
import { Checkbox, InputText } from 'primevue';
import { computed, ref } from 'vue';

interface DeckRow {
  deckCard: DeckCard;
  cachedCard: CachedCard | null;
}

const props = defineProps<{
  deckId: string;
  sourceId?: string;
  singleColumn?: boolean;
  filter?: boolean;
  select?: boolean;
  showUnassigned?: boolean;
}>();

const modelValue = defineModel<string[]>({ default: [] });
const filterValue = ref('');

const deckRows = useObservable<DeckRow[]>(
  from(
    liveQuery(async () => {
      if (!props.deckId) {
        return [];
      }

      let deckCards;

      if (props.sourceId) {
        deckCards = await db.deckCards.where({ deckId: props.deckId, sourceId: props.sourceId }).toArray();
      } else if (props.showUnassigned) {
        deckCards = (await db.deckCards.where('deckId').equals(props.deckId).toArray()).filter((deckCard) => !deckCard.sourceId);
      } else {
        deckCards = await db.deckCards.where('deckId').equals(props.deckId).toArray();
      }

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

function toggleSelection(deckCardId: string) {
  const current = new Set(modelValue.value);

  if (current.has(deckCardId)) {
    current.delete(deckCardId);
  } else {
    current.add(deckCardId);
  }

  modelValue.value = [...current];
}

function handleRowClick(deckCardId: string) {
  if (!props.select) {
    return;
  }

  toggleSelection(deckCardId);
}
</script>
