<template>
  <div>
    <div class="flex items-center justify-between mx-2 mr-4">
      <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 w-fit p-2 hover:opacity-50 transition-opacity">
        <i class="pi pi-chevron-left"></i>
        <div class="text-xl font-semibold mb-1">{{ deck?.name }}</div>
      </RouterLink>
      <div class="flex items-center gap-2">
        <Button label="Export" severity="info" size="small" @click="handleShowDeckExport" />
        <Button label="Import" size="small" severity="success" @click="handleShowDeckImport" />
      </div>
    </div>
    <Tabs v-model:value="tabValue">
      <TabList class="dark:bg-inherit!">
        <Tab value="deck" class="p-0!">
          <RouterLink :to="{ name: 'deck' }" class="block px-4 py-4.5 w-full h-full">Deck</RouterLink>
        </Tab>
        <Tab value="sources" class="p-0!">
          <RouterLink :to="{ name: 'deckSources' }" class="block px-4 py-4.5 w-full h-full">Sources</RouterLink>
        </Tab>
      </TabList>

      <TabPanels class="dark:bg-inherit! p-0!">
        <!-- DECK -->
        <TabPanel class="pt-2 p-4" value="deck">
          <DeckDisplay :deck-cards="deckCards" />
        </TabPanel>

        <!-- SOURCES -->
        <TabPanel class="flex flex-col sm:flex-row gap-4 sm:h-[calc(100vh-11rem)] p-4 overflow-y-auto" value="sources">
          <Card
            class="w-full sm:min-w-md h-fit sm:w-fit"
            v-for="source in sources?.sort((a, b) => {
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            })"
            :key="source.id">
            <template #title>
              <div class="flex justify-between items-center">
                {{ source.name }}
                <Button v-tooltip="'Mark as Received'" icon="pi pi-envelope" text @click="handleMarkReceived(source.id)" />
              </div>
            </template>
            <template #content>
              <DeckDisplay :deck-cards="deckCards" :source-id="source.id" single-column @row-click="handleDeckCardReceived">
                <template #cardActions="slotProps">
                  <Button icon="pi pi-minus" text severity="danger" size="small" @click.stop="handleRemoveDeckCardFromSource(slotProps.deckCard)" />
                </template>
              </DeckDisplay>
              <Button class="w-full" outlined label="Add Cards" icon="pi pi-plus" text @click="handleShowSourceDialog(source.id)" />
            </template>
          </Card>

          <Card class="w-full h-fit sm:w-fit flex items-center justify-center">
            <template #content>
              <Button
                v-show="!showSourceCreateForm"
                icon="pi pi-plus"
                class="sm:mx-4 w-3xs"
                text
                label="New Source"
                severity="secondary"
                @click="showSourceCreateForm = true" />
              <Form
                v-show="showSourceCreateForm"
                v-slot="$form"
                :resolver
                :initial-values
                @submit="formSubmit"
                class="flex flex-col gap-4 sm:mx-4 w-3xs">
                <div class="flex flex-col gap-1">
                  <label for="sourceName" class="ml-3 text-sm">Source Name</label>
                  <InputText name="sourceName" />
                  <Message v-if="$form.sourceName?.invalid" severity="error" size="small" variant="simple">
                    {{ $form.sourceName.error?.message }}
                  </Message>
                </div>
                <div class="flex gap-2">
                  <Button
                    label="Cancel"
                    class="w-full"
                    severity="secondary"
                    outlined
                    @click="
                      () => {
                        $form.reset();
                        showSourceCreateForm = false;
                      }
                    " />
                  <Button type="submit" label="Create" class="w-full" />
                </div>
              </Form>
            </template>
          </Card>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>

  <Dialog v-model:visible="showSourceSelect" class="w-11/12 sm:w-9/12 h-full" modal>
    <DeckDisplay v-model="selectedIds" :deck-cards="deckCards" select filter show-unassigned />
    <template #footer>
      <Button label="Add Cards" @click="handleAddCardsToSource" />
    </template>
  </Dialog>

  <Dialog v-model:visible="showDeckImport" class="w-11/12 sm:w-4/12" header="Import Deck" modal>
    <div class="flex w-full">
      <Textarea v-model:model-value="deckText" class="w-full" rows="15" style="resize: none" placeholder="Paste your decklist here." />
    </div>

    <template #footer>
      <Button label="Import & Replace" severity="success" @click="handleImportAndReplace" :loading="isImportLoading" />
    </template>
  </Dialog>

  <Dialog v-model:visible="showDeckExport" class="w-11/12 sm:w-4/12" header="Export Deck" modal>
    <div class="flex w-full relative">
      <Textarea v-model:model-value="deckText" class="w-full" rows="15" style="resize: none" readonly />
      <Button class="absolute! right-2 top-2" text icon="pi pi-copy" @click="copyDeckToClipboard" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import DeckDisplay from '@/components/DeckDisplay.vue';
import { db, type CachedCard, type DeckCard } from '@/db';
import { assignCardsToSource, bulkAddCardsToDeck, bulkRemoveCardsFromDeck, createSource, setCardQuantityAcquired } from '@/service';
import { parseDeckToOracleIds } from '@/util/deck-import';
import { Form, type FormSubmitEvent } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { from, useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { Button, Card, Dialog, InputText, Message, Tab, TabList, TabPanel, TabPanels, Tabs, Textarea, useToast } from 'primevue';
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import z from 'zod';

const props = defineProps<{
  id: string;
}>();

const tabValue = ref(useRoute().name === 'deck' ? 'deck' : 'sources');
const showSourceCreateForm = ref(false);
const showSourceSelect = ref(false);
const showDeckImport = ref(false);
const showDeckExport = ref(false);
const selectedIds = ref<string[]>([]);
const selectedSourceId = ref();
const deckText = ref('');
const isImportLoading = ref(false);

const toast = useToast();

const initialValues = ref({
  sourceName: ''
});

const resolver = ref(
  zodResolver(
    z.object({
      sourceName: z.string().min(1, { message: 'Source name is required.' })
    })
  )
);

const deck = useObservable(
  from(
    liveQuery(() => {
      return db.decks.get(props.id);
    })
  )
);

const deckCards = useObservable(
  from(
    liveQuery(() => {
      return db.deckCards.where('deckId').equals(props.id).toArray();
    })
  )
);

const sources = useObservable(
  from(
    liveQuery(() => {
      return db.sources.where('deckId').equals(props.id).toArray();
    })
  )
);

async function formSubmit(event: FormSubmitEvent) {
  if (event.valid) {
    await createSource({ sourceName: event.values.sourceName, deckId: props.id });
    showSourceCreateForm.value = false;
    event.reset();
  }
}

function handleShowSourceDialog(sourceId: string) {
  showSourceSelect.value = true;
  selectedSourceId.value = sourceId;
  selectedIds.value = [];
}

function handleShowDeckImport() {
  showDeckImport.value = true;
  deckText.value = '';
}

async function handleShowDeckExport() {
  showDeckExport.value = true;

  const oracleIds = [...new Set(deckCards.value?.filter((card) => card.oracleId !== deck.value?.commanderOracleId).map((card) => card.oracleId))];
  const cachedCards = await db.cards.where('oracleId').anyOf(oracleIds).toArray();
  const cachedCardsByOracleId = new Map<string, CachedCard>(cachedCards.map((card) => [card.oracleId, card]));

  const deckRows = deckCards.value
    ?.filter((card) => card.oracleId !== deck.value?.commanderOracleId)
    .map((deckCard) => ({
      deckCard,
      cachedCard: cachedCardsByOracleId.get(deckCard.oracleId) ?? null
    }));

  if (!deckRows) return;

  console.log(deckRows);
  deckRows.sort((a, b) => a.cachedCard!.raw.name.toLowerCase().localeCompare(b.cachedCard!.raw.name.toLowerCase()));

  deckText.value = deckRows
    .map((row) => ({
      name: row.cachedCard?.raw.name,
      quantity: row.deckCard.quantity
    }))
    .sort((a, b) => a.name!.toLowerCase().localeCompare(b.name!.toLowerCase()))
    .map((row) => `${row.quantity} ${row.name}`)
    .join('\n');

  const cachedCommander = await db.cards.get(deck.value!.commanderOracleId);
  deckText.value = [deckText.value, '\n\n', `1 ${cachedCommander?.raw.name}`].join('');
}

async function handleAddCardsToSource() {
  await assignCardsToSource({ sourceId: selectedSourceId.value, deckCardIds: selectedIds.value });
  showSourceSelect.value = false;
}

async function handleImportAndReplace() {
  try {
    if (!deck.value) {
      throw new Error('No deck found while trying to import and replace.');
    }

    isImportLoading.value = true;

    const parsedDeck = await parseDeckToOracleIds(deckText.value);
    const existingDeckCards = deckCards.value ?? [];
    const cardsToRemove = existingDeckCards.filter((deckCard) => !parsedDeck.some((card) => card.oracleId === deckCard.oracleId));
    const cardsToAdd = parsedDeck.filter((card) => !existingDeckCards.some((deckCard) => deckCard.oracleId === card.oracleId));

    if (!cardsToRemove.length && !cardsToAdd.length) {
      toast.add({ summary: 'Import Cancelled', detail: 'No changes detected in the new list.', life: 3000, severity: 'warn' });
      return;
    }

    await bulkRemoveCardsFromDeck({ deckCardIds: cardsToRemove.map((c) => c.id) });
    await bulkAddCardsToDeck({ deckId: deck.value?.id, cards: cardsToAdd });

    toast.add({
      summary: 'Import Successful',
      detail: `Removed ${cardsToRemove.length} card(s).\nAdded ${cardsToAdd.length} card(s).`,
      life: 4000,
      severity: 'success'
    });
  } catch (e) {
    console.error(e);
    toast.add({
      summary: 'Import Not Successful',
      detail: e,
      severity: 'error'
    });
    return;
  } finally {
    isImportLoading.value = false;
  }
}

async function handleMarkReceived(sourceId: string) {
  const deckCards = await db.deckCards.where('sourceId').equals(sourceId).toArray();

  const isReceived = await checkIsEntireSourceReceived(sourceId);
  await Promise.allSettled(deckCards.map((card) => setCardQuantityAcquired({ deckCardId: card.id, quantity: isReceived ? 0 : card.quantity })));
}

async function handleDeckCardReceived(deckCard: DeckCard) {
  const isReceived = deckCard?.quantity === deckCard?.quantityAcquired;
  await setCardQuantityAcquired({ deckCardId: deckCard.id, quantity: isReceived ? 0 : deckCard.quantity });
}

async function handleRemoveDeckCardFromSource(deckCard: DeckCard) {
  if (deckCard.quantityAcquired !== 0) await setCardQuantityAcquired({ deckCardId: deckCard.id, quantity: 0 });
  await assignCardsToSource({ sourceId: '', deckCardIds: [deckCard.id] });
}

async function checkIsEntireSourceReceived(sourceId: string) {
  const deckCards = await db.deckCards.where('sourceId').equals(sourceId).toArray();
  return deckCards.every((card) => card.quantity === card.quantityAcquired);
}

async function copyDeckToClipboard() {
  if (!deckText.value) return;

  const text = deckText.value;

  try {
    await navigator.clipboard.writeText(text);
    toast.add({ summary: 'Copied deck to clipboard.', life: 3000, severity: 'success' });
  } catch (e) {
    toast.add({ summary: 'Failed to copy deck', life: 3000, severity: 'error' });
    console.error(e);
  }
}
</script>
