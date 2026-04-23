<template>
  <Select
    v-bind="attrs"
    v-model="model"
    :options="cardOptions"
    option-label="name"
    filter
    @filter="handleFilter"
    :empty-filter-message="emptyFilterMessage"
    :empty-message="emptyMessage">
    <template v-for="(_, slotName) in slots" :key="slotName" #[slotName]="slotProps">
      <slot :name="slotName" v-bind="slotProps ?? {}" />
    </template>
    <template #option="slotProps">
      <div class="flex items-center w-full">
        <img :alt="slotProps.option.name" :src="slotProps.option.artCrop" class="mr-2 rounded shrink-0" style="width: 50px" />
        <div class="whitespace-normal wrap-break-words leading-tight">
          {{ slotProps.option.name }}
        </div>
      </div>
    </template>
  </Select>
</template>

<script setup lang="ts">
import { determineImageUri } from '@/service';
import { Select, type SelectFilterEvent } from 'primevue';
import { Cards } from 'scryfall-api';
import { ref, useAttrs, useSlots } from 'vue';

defineOptions({
  inheritAttrs: false
});

const model = defineModel<unknown>();

const attrs = useAttrs();
const slots = useSlots();

const props = withDefaults(
  defineProps<{
    searchSuffix?: string;
  }>(),
  {
    searchSuffix: ''
  }
);

const cardOptions = ref<{ name: string; oracleId?: string | null; artCrop?: string | null }[]>([]);
const emptyFilterMessage = ref('Enter at least 3 characters to search.');
const emptyMessage = ref('Enter at least 3 characters to search.');
const latestQuery = ref('');

function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      fn(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced as ((...args: Parameters<T>) => void) & { cancel: () => void };
}

const fetchCardsDebounced = debounce(async (query: string) => {
  const cards = await Cards.search(`${query} ${props.searchSuffix}`).all();

  if (query !== latestQuery.value) return;

  cardOptions.value = cards.map((c) => ({
    name: c.name,
    oracleId: c.oracle_id,
    artCrop: determineImageUri(c)
  }));
  emptyFilterMessage.value = emptyMessage.value = 'No results found.';
}, 600);

function handleFilter(event: SelectFilterEvent) {
  const query = String(event.value ?? '');
  latestQuery.value = query;

  if (query.length < 3) {
    fetchCardsDebounced.cancel();
    cardOptions.value = [];
    emptyFilterMessage.value = emptyMessage.value = `Enter at least ${3 - query.length} character(s) to search.`;
    return;
  }

  emptyFilterMessage.value = emptyMessage.value = 'Loading...';
  fetchCardsDebounced(query);
}
</script>
