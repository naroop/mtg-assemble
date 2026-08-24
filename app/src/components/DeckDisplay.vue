<template>
  <InputText v-show="filter" v-model="filterValue" class="mb-3!" placeholder="Filter cards..." />
  <div v-show="showDeckInfo" class="flex items-center gap-2">
    <Message size="small">Total: {{ formatUsd(deckCost) }}</Message>
    <Message size="small">Unowned: {{ formatUsd(unownedCost) }}</Message>
  </div>
  <div class="columns-1 gap-4 pt-2" :class="[!singleColumn ? 'sm:columns-2 lg:columns-3' : '']">
    <div
      v-for="section in organizedDeckRows.filter(
        (section) => section.rows.filter((row) => row.cachedCard?.raw.name.toLowerCase().includes(filterValue.toLowerCase())).length > 0
      )"
      :key="section.type"
      class="pb-6 mb-4"
      :class="[section.rows.length <= breakAvoidThreshold ? 'break-inside-avoid' : '']">
      <div class="flex items-center gap-2 text-muted-color font-semibold pb-3">
        <div>{{ section.type.toUpperCase() }}</div>
        <span class="font-light text-sm">({{ section.rows.length }})</span>
        <span class="ml-auto text-sm mr-2">{{ formatUsd(sectionCost(section.rows)) }}</span>
      </div>

      <ul v-if="section.rows?.length" class="flex flex-col" :class="[select ? 'gap-0.5' : 'gap-3']">
        <li
          v-for="row in section.rows.filter((row) => row.cachedCard?.raw.name.toLowerCase().includes(filterValue.toLowerCase()))"
          :key="row.deckCard.id"
          class="rounded transition flex justify-between"
          :class="[
            select ? 'cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 p-2' : '',
            rowHover ? 'cursor-pointer' : '',
            modelValue.includes(row.deckCard.id) ? 'bg-primary-50 dark:bg-primary-900/20' : '',
            select && modelValue.length > 0 && !modelValue.includes(row.deckCard.id) ? 'opacity-50' : ''
          ]"
          @click="handleRowClick(row.deckCard)">
          <div class="flex gap-2 items-center">
            <Checkbox
              v-if="select"
              binary
              :model-value="modelValue.includes(row.deckCard.id)"
              @update:model-value="toggleSelection(row.deckCard.id)"
              @click.stop />

            <img
              class="rounded w-12 h-9 object-cover object-top"
              :class="[row.deckCard.quantity === row.deckCard.quantityAcquired ? 'opacity-20' : '']"
              :src="determineImageUri(row.cachedCard?.raw)" />

            <span
              :class="[
                row.deckCard.quantity === row.deckCard.quantityAcquired ? 'opacity-20' : '',
                !singleColumn && row.deckCard.quantity !== row.deckCard.quantityAcquired && row.deckCard.sourceId ? 'text-primary' : ''
              ]">
              {{ row.cachedCard?.raw.name ?? 'Unknown card' }}
            </span>

            <i v-if="row.deckCard.quantity === row.deckCard.quantityAcquired" class="pi pi-check"></i>
            <i v-else-if="!singleColumn && row.deckCard.sourceId" class="pi pi-shopping-cart text-primary"></i>
          </div>
          <div class="flex items-center gap-2">
            <div v-show="row.deckCard.quantity > 1" class="rounded text-sm font-mono">
              {{ row.deckCard.quantityAcquired }} / {{ row.deckCard.quantity }}
            </div>
            <slot :deckCard="row.deckCard" name="cardActions"></slot>
          </div>
        </li>
      </ul>

      <div v-else>No cards found.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { db, type CachedCard, type CardType, type DeckCard } from '@/db';
import { determineCardType, determineImageUri, formatUsd } from '@/util/cards-util';
import { Checkbox, InputText, Message } from 'primevue';
import { computed, ref, watch } from 'vue';

interface DeckRow {
  deckCard: DeckCard;
  cachedCard: CachedCard | null;
}

const props = defineProps<{
  deckCards: DeckCard[] | undefined;
  sourceId?: string;
  singleColumn?: boolean;
  filter?: boolean;
  select?: boolean;
  rowHover?: boolean;
  showUnassigned?: boolean;
  showDeckInfo?: boolean;
}>();

const emits = defineEmits<{ rowClick: [deckCard: DeckCard] }>();

const modelValue = defineModel<string[]>({ default: [] });
const filterValue = ref('');

// Sections with more rows than this will be allowed to break across columns instead of
// being kept together, so one large section (e.g. creatures) doesn't force everything
// else into an unbalanced single column.
const breakAvoidThreshold = 15;

const deckRows = ref<DeckRow[] | undefined>();

const deckCost = computed(() => {
  return deckRows.value?.reduce((total, row) => total + (Number(row.cachedCard?.raw.prices['usd']) ?? 0) * row.deckCard.quantity, 0) ?? 0;
});

const unownedCost = computed(() => {
  return (
    deckRows.value?.reduce(
      (total, row) => total + (Number(row.cachedCard?.raw.prices['usd']) ?? 0) * (row.deckCard.quantity - row.deckCard.quantityAcquired),
      0
    ) ?? 0
  );
});

function sectionCost(rows: DeckRow[]): number {
  return rows.reduce((total, row) => total + (Number(row.cachedCard?.raw.prices['usd']) ?? 0) * row.deckCard.quantity, 0);
}

watch(
  () => props.deckCards,
  async (newValue) => {
    if (!newValue) {
      deckRows.value = [];
      return;
    }

    let filteredDeckCards = newValue;

    if (props.sourceId) {
      filteredDeckCards = newValue?.filter((dc) => dc.sourceId === props.sourceId);
    } else if (props.showUnassigned) {
      filteredDeckCards = newValue?.filter((dc) => !dc.sourceId);
    }

    if (!filteredDeckCards || !filteredDeckCards.length) {
      deckRows.value = [];
      return;
    }

    const oracleIds = [...new Set(filteredDeckCards.map((card) => card.oracleId))];
    const cachedCards = await db.cards.where('oracleId').anyOf(oracleIds).toArray();
    const cachedCardsByOracleId = new Map<string, CachedCard>(cachedCards.map((card) => [card.oracleId, card]));

    deckRows.value = filteredDeckCards.map((deckCard) => ({
      deckCard,
      cachedCard: cachedCardsByOracleId.get(deckCard.oracleId) ?? null
    }));
  },
  { immediate: true }
);

const organizedDeckRows = computed(() => {
  const map: Record<CardType, DeckRow[]> = {
    planeswalker: [],
    creature: [],
    instant: [],
    sorcery: [],
    artifact: [],
    enchantment: [],
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

  for (const rows of Object.values(map)) {
    rows.sort((a, b) => {
      const aName = a.cachedCard?.raw?.name ?? '';
      const bName = b.cachedCard?.raw?.name ?? '';

      return aName.localeCompare(bName);
    });
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

function handleRowClick(deckCard: DeckCard) {
  emits('rowClick', deckCard);
  if (!props.select) {
    return;
  }
  if (props.select) toggleSelection(deckCard.id);
}
</script>
