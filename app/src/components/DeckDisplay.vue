<template>
  <SelectButton v-show="filter" class="mb-3! mr-2" v-model="viewType" :options="viewTypes" />
  <InputText v-show="filter" v-model="filterValue" class="mb-3! mr-2" placeholder="Filter cards..." />
  <MultiSelect
    v-show="filter"
    v-model="selectedRarities"
    class="mb-3!"
    placeholder="Rarity"
    :options="rarities"
    option-label="label"
    option-value="value"
    show-clear />
  <div v-show="showDeckInfo" class="flex items-center gap-2">
    <Message size="small">Total: {{ formatUsd(deckCost) }}</Message>
    <Message size="small">Unowned: {{ formatUsd(unownedCost) }}</Message>
  </div>
  <div class="columns-1 gap-4 pt-2" :class="[!singleColumn ? 'sm:columns-2 lg:columns-3' : '']">
    <div
      v-for="section in filteredDeckSections"
      :key="section.key"
      class="pb-6 mb-4"
      :class="[section.rows.length <= breakAvoidThreshold ? 'break-inside-avoid' : '']">
      <div class="flex items-center gap-2 text-muted-color font-semibold pb-3">
        <div class="flex items-center gap-1.5">
          <img v-for="iconUri in symbolIconUris(section.iconSymbols)" :key="iconUri" class="w-4 h-4" :src="iconUri" alt="mana symbol" />
          <div>{{ section.label.toUpperCase() }}</div>
        </div>
        <span class="font-light text-sm">({{ section.rows.length }})</span>
        <span class="ml-auto text-sm mr-2">{{ formatUsd(sectionCost(section.rows)) }}</span>
      </div>

      <ul v-if="section.rows?.length" class="flex flex-col" :class="[select ? 'gap-0.5' : 'gap-3']">
        <li
          v-for="row in section.rows"
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
import { Checkbox, InputText, Message, MultiSelect, SelectButton } from 'primevue';
import { SymbologyApi } from 'scryfall-api';
import { computed, onMounted, ref, watch } from 'vue';

interface DeckRow {
  deckCard: DeckCard;
  cachedCard: CachedCard | null;
}

type ColorGroupKey = 'white' | 'blue' | 'black' | 'red' | 'green' | 'multicolor' | 'colorless' | 'lands';

interface DeckSection {
  key: string;
  label: string;
  rows: DeckRow[];
  iconSymbols: string[];
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

const modelValue = defineModel<string[]>({ default: () => [] });
const filterValue = ref('');

const viewType = ref('Card Type');
const viewTypes = ref(['Card Type', 'Color']);

const selectedRarities = ref<string[]>([]);
const rarities = ref([
  { label: 'Common', value: 'common' },
  { label: 'Uncommon', value: 'uncommon' },
  { label: 'Rare', value: 'rare' },
  { label: 'Mythic', value: 'mythic' }
]);

const symbologyBySymbol = ref<Record<string, string>>({});

const colorGroupOrder: ColorGroupKey[] = ['white', 'blue', 'black', 'red', 'green', 'multicolor', 'colorless', 'lands'];

const colorGroupMetadata: Record<ColorGroupKey, { label: string; iconSymbols: string[] }> = {
  white: { label: 'White', iconSymbols: ['{W}'] },
  blue: { label: 'Blue', iconSymbols: ['{U}'] },
  black: { label: 'Black', iconSymbols: ['{B}'] },
  red: { label: 'Red', iconSymbols: ['{R}'] },
  green: { label: 'Green', iconSymbols: ['{G}'] },
  multicolor: { label: 'Multicolor', iconSymbols: ['{W}', '{U}', '{B}', '{R}', '{G}'] },
  colorless: { label: 'Colorless', iconSymbols: ['{C}'] },
  lands: { label: 'Lands', iconSymbols: ['{T}'] }
};

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

onMounted(async () => {
  try {
    const symbols = await SymbologyApi.all();
    const bySymbol: Record<string, string> = {};

    for (const symbol of symbols) {
      if (symbol.symbol && symbol.svg_uri) {
        bySymbol[symbol.symbol] = symbol.svg_uri;
      }
    }

    symbologyBySymbol.value = bySymbol;
  } catch (error) {
    console.error('Failed to load Scryfall symbology.', error);
  }
});

function symbolIconUris(symbols: string[]): string[] {
  return symbols.map((symbol) => symbologyBySymbol.value[symbol]).filter((iconUri): iconUri is string => Boolean(iconUri));
}

function sortRowsByName(rows: DeckRow[]): void {
  rows.sort((a, b) => {
    const aName = a.cachedCard?.raw?.name ?? '';
    const bName = b.cachedCard?.raw?.name ?? '';

    return aName.localeCompare(bName);
  });
}

function buildTypeSections(rows: DeckRow[]): DeckSection[] {
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

  for (const row of rows) {
    const card = row.cachedCard?.raw;
    if (!card) continue;

    const type = determineCardType(card);
    if (type) {
      map[type].push(row);
    }
  }

  for (const typeRows of Object.values(map)) {
    sortRowsByName(typeRows);
  }

  return Object.entries(map)
    .filter(([, typeRows]) => typeRows.length > 0)
    .map(([type, typeRows]) => ({
      key: type,
      label: type,
      rows: typeRows,
      iconSymbols: []
    }));
}

function determineColorGroup(row: DeckRow): ColorGroupKey {
  const card = row.cachedCard?.raw;
  if (!card) {
    return 'colorless';
  }

  if (determineCardType(card) === 'land') {
    return 'lands';
  }

  const colors = card.colors ?? [];

  if (colors.length === 0) {
    return 'colorless';
  }

  if (colors.length > 1) {
    return 'multicolor';
  }

  switch (colors[0]) {
    case 'W':
      return 'white';
    case 'U':
      return 'blue';
    case 'B':
      return 'black';
    case 'R':
      return 'red';
    case 'G':
      return 'green';
    default:
      return 'colorless';
  }
}

function buildColorSections(rows: DeckRow[]): DeckSection[] {
  const map: Record<ColorGroupKey, DeckRow[]> = {
    white: [],
    blue: [],
    black: [],
    red: [],
    green: [],
    multicolor: [],
    colorless: [],
    lands: []
  };

  for (const row of rows) {
    const group = determineColorGroup(row);
    map[group].push(row);
  }

  for (const groupRows of Object.values(map)) {
    sortRowsByName(groupRows);
  }

  return colorGroupOrder
    .filter((group) => map[group].length > 0)
    .map((group) => ({
      key: group,
      label: colorGroupMetadata[group].label,
      rows: map[group],
      iconSymbols: colorGroupMetadata[group].iconSymbols
    }));
}

const groupedDeckSections = computed(() => {
  const rows = deckRows.value ?? [];

  if (viewType.value === 'Color') {
    return buildColorSections(rows);
  }

  return buildTypeSections(rows);
});

function rowMatchesFilters(row: DeckRow): boolean {
  const card = row.cachedCard?.raw;
  if (!card) {
    return false;
  }

  const normalizedFilter = filterValue.value.trim().toLowerCase();
  const nameMatches = !normalizedFilter || card.name.toLowerCase().includes(normalizedFilter);
  const normalizedCardRarity = card.rarity?.toLowerCase() ?? '';
  const normalizedSelectedRarities = selectedRarities.value.map((rarity) => rarity.toLowerCase());
  const rarityMatches = !normalizedSelectedRarities.length || normalizedSelectedRarities.includes(normalizedCardRarity);

  return nameMatches && rarityMatches;
}

const filteredDeckSections = computed(() => {
  return groupedDeckSections.value
    .map((section) => ({
      ...section,
      rows: section.rows.filter(rowMatchesFilters)
    }))
    .filter((section) => section.rows.length > 0);
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
