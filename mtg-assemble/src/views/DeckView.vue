<template>
  <div class="px-2">
    <Tabs v-model:value="tabValue">
      <TabList class="dark:bg-inherit!">
        <Tab value="deck">
          <RouterLink :to="{ name: 'deck' }">Deck</RouterLink>
        </Tab>
        <Tab value="sources">
          <RouterLink :to="{ name: 'deckSources' }">Sources</RouterLink>
        </Tab>
      </TabList>

      <TabPanels class="dark:bg-inherit!">
        <TabPanel value="deck">
          <DeckDisplay :deck-id="props.id" />
        </TabPanel>

        <TabPanel class="flex flex-col sm:flex-row gap-4 sm:overflow-x-scroll sm:h-[calc(100vh-8rem)]" value="sources">
          <Card class="w-full sm:min-w-md h-fit sm:w-fit" v-for="source in sources" :key="source.id">
            <template #title>
              {{ source.name }}
            </template>
            <template #content>
              <Button class="w-full" outlined label="Add Cards" icon="pi pi-plus" text @click="showSourceSelect = true" />
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
              <Form v-show="showSourceCreateForm" v-slot="$form" :resolver :initial-values @submit="formSubmit" class="flex flex-col gap-4 w-full">
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

  <Dialog v-model:visible="showSourceSelect" modal>
    <DeckDisplay :deck-id="props.id" />
  </Dialog>
</template>

<script setup lang="ts">
import DeckDisplay from '@/components/DeckDisplay.vue';
import { db } from '@/db';
import { createSource } from '@/service';
import { Form, type FormSubmitEvent } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { from, useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { Button, Card, Dialog, InputText, Message, Tab, TabList, TabPanel, TabPanels, Tabs } from 'primevue';
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import z from 'zod';

const props = defineProps<{
  id: string;
}>();

const tabValue = ref(useRoute().name === 'deck' ? 'deck' : 'sources');
const showSourceCreateForm = ref(false);
const showSourceSelect = ref(false);

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
</script>
