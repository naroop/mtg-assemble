<template>
  <div class="flex items-center gap-2 w-full">
    <div class="flex flex-col w-full">
      <div class="flex items-start gap-2 p-2">
        <Button label="Test Deck" icon="pi pi-plus" @click="importTestDeck" />
        <Button label="Rebuild Projections" icon="pi pi-refresh" severity="warning" @click="rebuildProjections" />
        <Button label="Clear Events" icon="pi pi-trash" @click="db.events.clear()" />
      </div>

      <Tabs value="0">
        <TabList>
          <Tab value="0">Events</Tab>
          <Tab value="1">Decks</Tab>
          <Tab value="2">Deck Cards</Tab>
          <Tab value="3">Sources</Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="0">
            <DataTable :value="events" class="w-full">
              <Column field="id" header="Local Event ID"></Column>
              <Column field="type" header="Type"></Column>
              <Column field="aggregateId" header="Aggregate ID"></Column>
              <Column field="payload" header="Payload">
                <template #body="{ data }">
                  <VueJsonPretty class="overflow-scroll max-h-64" :data="data.payload" theme="dark" :collapsed-node-length="10" show-length />
                </template>
              </Column>
              <Column field="createdAt" header="Created At">
                <template #body="{ data }">
                  <span>{{ new Date(data.createdAt).toLocaleString() }}</span>
                </template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel value="1">
            <DataTable :value="decks" class="w-full">
              <Column field="id" header="ID"></Column>
              <Column field="name" header="Name"></Column>
              <Column field="commanderOracleId" header="Commander Oracle ID"></Column>
              <Column field="commanderImageUri" header="Commander Image URI"></Column>
              <Column field="updatedAt" header="Updated At">
                <template #body="{ data }">
                  <span>{{ new Date(data.updatedAt).toLocaleString() }}</span>
                </template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel value="2">
            <DataTable :value="deckCards" class="w-full">
              <Column field="id" header="ID"></Column>
              <Column field="deckId" header="Deck ID"></Column>
              <Column field="name" header="Name"></Column>
              <Column field="oracleId" header="Oracle ID"></Column>
              <Column field="sourceId" header="Source ID"></Column>
              <Column field="quantity" header="Quantity"></Column>
              <Column field="updatedAt" header="Updated At">
                <template #body="{ data }">
                  <span>{{ new Date(data.updatedAt).toLocaleString() }}</span>
                </template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel value="3">
            <DataTable :value="sources" class="w-full">
              <Column field="id" header="ID"></Column>
              <Column field="name" header="Name"></Column>
              <Column field="updatedAt" header="Updated At">
                <template #body="{ data }">
                  <span>{{ new Date(data.updatedAt).toLocaleString() }}</span>
                </template>
              </Column>
            </DataTable>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { db } from '@/db';
import { bulkAddCardsToDeck, createDeck, rebuildProjections } from '@/service';
import { from, useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { Button, Tab, TabList, TabPanel, TabPanels, Tabs } from 'primevue';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { Cards, type Card } from 'scryfall-api';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';

const events = useObservable(from(liveQuery(() => db.events.orderBy('id').reverse().toArray())));
const decks = useObservable(from(liveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray())));
const deckCards = useObservable(from(liveQuery(() => db.deckCards.orderBy('updatedAt').reverse().toArray())));
const sources = useObservable(from(liveQuery(() => db.sources.orderBy('updatedAt').reverse().toArray())));

async function importTestDeck() {
  const randomDeck = await makeRandomDeck();

  const cardsPayload = randomDeck.map((card) => {
    return {
      oracleId: card.oracle_id!,
      quantity: 1
    };
  });

  const deckId = await createDeck({ deckName: randomDeck[0]!.name, commanderOracleId: randomDeck[0]!.oracle_id! });
  await bulkAddCardsToDeck({ deckId: deckId, cards: cardsPayload });
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function makeRandomDeck() {
  const legendaryCreatures = await Cards.search('t:"legendary creature" game:paper').page(getRandomInt(1, 15));
  const commander = legendaryCreatures[getRandomInt(0, legendaryCreatures.length - 1)];

  const possibleCards = await Cards.search(`ci:${commander?.color_identity.join('')} game:paper`, { order: 'artist' }).page(getRandomInt(1, 40));

  const deck: Card[] = [];
  deck.push(commander!);

  for (let i = 0; i < 9; i++) {
    deck.push(possibleCards[getRandomInt(0, possibleCards.length - 1)]!);
  }

  return deck;
}
</script>
