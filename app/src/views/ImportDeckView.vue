<template>
  <div>
    <Form v-slot="$form" :resolver :initial-values @submit="formSubmit" class="px-4 flex flex-col gap-4">
      <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2 w-fit p-2 hover:opacity-50 transition-opacity">
        <i class="pi pi-chevron-left"></i>
        <div class="text-xl font-semibold mb-1">Import from Text</div>
      </RouterLink>
      <div class="flex flex-col gap-1">
        <label for="deckName" class="ml-3 text-sm">Name</label>
        <InputText name="deckName" />
        <Message v-if="$form.deckName?.invalid" severity="error" size="small" variant="simple">{{ $form.deckName.error?.message }}</Message>
      </div>

      <div class="flex flex-col gap-1">
        <label for="commander" class="ml-3 text-sm">Commander</label>
        <CardSelect name="commander" searchSuffix="is:commander" />
        <Message v-if="$form.commander?.invalid" severity="error" size="small" variant="simple">{{ $form.commander.error?.message }}</Message>
      </div>

      <div class="flex flex-col gap-1">
        <label for="deck" class="ml-3 text-sm">Deck List</label>
        <Textarea name="deck" rows="15" style="resize: none" />
        <Message v-if="$form.deck?.invalid" severity="error" size="small" variant="simple">{{ $form.deck.error?.message }}</Message>
      </div>
      <Button type="submit" label="Import" :loading="isLoading" />
    </Form>
  </div>
</template>

<script setup lang="ts">
import { Textarea, Message, Button, InputText, useToast } from 'primevue';
import { Form, type FormSubmitEvent } from '@primevue/forms';
import { ref } from 'vue';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import z from 'zod';
import importDeck from '@/util/deck-import';
import { createDeck } from '@/service';
import CardSelect from '@/components/CardSelect.vue';

const toast = useToast();

const isLoading = ref(false);

const initialValues = ref({
  deckName: '',
  deck: '',
  commander: null as { name: string; oracleId: string } | null
});

const resolver = ref(
  zodResolver(
    z.object({
      commander: z
        .object({
          name: z.string(),
          oracleId: z.string()
        })
        .nullable()
        .refine((val) => val !== null, {
          message: 'Commander is required.'
        }),
      deckName: z.string().min(1, { message: 'Deck name is required.' }),
      deck: z.string().min(1, { message: 'Deck is required.' })
    })
  )
);

async function formSubmit(event: FormSubmitEvent) {
  if (event.valid) {
    const deckId = await createDeck({ deckName: event.values.deckName, commanderOracleId: event.values.commander.oracleId });

    isLoading.value = true;
    await importDeck(deckId, event.values.deck);
    toast.add({ severity: 'success', summary: 'Deck Imported', detail: 'Your deck was successfully imported.', life: 3000 });
    isLoading.value = false;
  }
}
</script>
