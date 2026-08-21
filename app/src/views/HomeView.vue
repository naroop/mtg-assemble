<template>
  <div
    class="fixed inset-x-0 top-0 z-10 h-14 bg-linear-to-b dark:from-surface-900/90 from-surface-50/90 from-90% to-transparent pointer-events-none"></div>

  <div class="lg:px-28 2xl:px-64">
    <div class="sticky flex items-center w-full top-0 z-20 p-1 pt-2 pb-4">
      <Button class="sm:hidden!" size="large" icon="pi pi-bars" text @click="visible = true" />
      <span class="text-primary font-semibold text-lg font-mono ml-2">MTG Assemble</span>
      <div class="hidden sm:flex items-center ml-8 gap-5">
        <Button as="RouterLink" to="/decks" active-class="font-bold" text severity="contrast">My Decks</Button>
        <Button as="RouterLink" to="/decks/import" active-class="font-bold" text severity="contrast">Import</Button>
      </div>

      <div class="flex items-center gap-2 ml-auto mr-2">
        <Button text icon="pi pi-sync" @click="handleClickSync" />
        <Button text icon="pi pi-user" @click="handleClickUser" />
      </div>
    </div>

    <RouterView v-slot="{ Component, route }">
      <Transition :name="transitionName" mode="out-in">
        <div :key="(route.meta.group as string | undefined) ?? route.path">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>

    <Drawer v-model:visible="visible" pt:header="p-2!">
      <h1 class="text-muted-color font-semibold py-4">Decks</h1>
      <div class="flex flex-col gap-4">
        <RouterLink to="/decks" class="flex items-center gap-4 text-lg font-semibold" @click="visible = false">
          <i class="pi pi-list text-gray-500"></i>
          <span>View</span>
        </RouterLink>
        <RouterLink to="/decks/import" class="flex items-center gap-4 text-lg font-semibold" @click="visible = false">
          <i class="pi pi-plus text-gray-500"></i>
          <span>Import</span>
        </RouterLink>
      </div>
      <h1 class="text-muted-color font-semibold py-4">Advanced</h1>
      <div class="flex flex-col gap-4">
        <RouterLink to="/dev" class="flex items-center gap-4 text-lg font-semibold" @click="visible = false">
          <i class="pi pi-list text-gray-500"></i>
          <span>Developer Tools</span>
        </RouterLink>
      </div>
    </Drawer>
  </div>

  <Popover ref="userPopover" class="w-3xs">
    <div class="text-sm font-semibold pt-1 pb-2">{{ user?.email }}</div>
    <div class="flex flex-col gap-2">
      <Button text label="Sign Out" size="small" @click="handleSignOut" />
    </div>
  </Popover>

  <Dialog modal v-model:visible="signInVisible" header="Sign In" class="w-md">
    <p class="text-sm mb-5 italic">Make an account to sync your decks and collection across devices.</p>
    <Form v-slot="$form" :resolver :initial-values @submit="formSubmit" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label for="email" class="ml-3 text-sm">Email</label>
        <InputText name="email" type="email" />
        <Message v-if="$form.email?.invalid" severity="error" size="small" variant="simple">{{ $form.email.error?.message }}</Message>
      </div>

      <div class="flex flex-col gap-1">
        <label for="password" class="ml-3 text-sm">Password</label>
        <Password name="password" :feedback="false" toggle-mask fluid />
        <Message v-if="$form.password?.invalid" severity="error" size="small" variant="simple">{{ $form.password.error?.message }}</Message>
      </div>

      <Button type="submit" label="Login" :loading="isLoading && authAction === 'signIn'" @click="authAction = 'signIn'" />
      <Button type="submit" label="Create Account" text size="small" :loading="isLoading && authAction === 'signUp'" @click="authAction = 'signUp'" />
    </Form>
  </Dialog>
</template>

<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
import { transitionName } from '@/router/transition';
import { syncEvents } from '@/service/syncService';
import { Form, type FormSubmitEvent } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { Button, Dialog, Drawer, InputText, Message, Password, Popover, useToast } from 'primevue';
import { ref, useTemplateRef } from 'vue';
import z from 'zod';

const userPopover = useTemplateRef<InstanceType<typeof Popover>>('userPopover');

const { user, signIn, signUp, signOut } = useAuth();
const toast = useToast();

const visible = ref(false);

const signInVisible = ref(false);
const isLoading = ref(false);
const authAction = ref<'signIn' | 'signUp'>('signIn');

const handleClickSync = async () => {
  try {
    await syncEvents();
    toast.add({ severity: 'success', summary: 'Sync Complete', detail: 'Your decks and collection have been synced.', life: 3000 });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Sync Failed',
      detail: error instanceof Error ? error.message : 'Unable to sync decks and collection.',
      life: 3000
    });
  }
};

const handleClickUser = (event: Event) => {
  if (user.value) {
    userPopover.value?.show(event);
  } else {
    signInVisible.value = true;
  }
};

async function handleSignOut() {
  try {
    await signOut();
    userPopover.value?.hide();
    toast.add({ severity: 'success', summary: 'Signed Out', detail: 'You have been signed out.', life: 3000 });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Sign Out Failed',
      detail: error instanceof Error ? error.message : 'Unable to sign out.',
      life: 3000
    });
  }
}

const initialValues = ref({
  email: '',
  password: ''
});

const resolver = ref(
  zodResolver(
    z.object({
      email: z.string().min(1, { message: 'Email is required.' }).email({ message: 'Invalid email address.' }),
      password: z.string().min(1, { message: 'Password is required.' })
    })
  )
);

async function formSubmit(event: FormSubmitEvent) {
  if (!event.valid) {
    return;
  }

  isLoading.value = true;

  try {
    if (authAction.value === 'signUp') {
      await signUp(event.values.email, event.values.password);
      toast.add({
        severity: 'success',
        summary: 'Account Created',
        detail: 'Check your email to confirm your account.',
        life: 5000
      });
    } else {
      await signIn(event.values.email, event.values.password);
      toast.add({ severity: 'success', summary: 'Signed In', detail: 'You have successfully signed in.', life: 3000 });
    }
    signInVisible.value = false;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: authAction.value === 'signUp' ? 'Account Creation Failed' : 'Sign In Failed',
      detail: error instanceof Error ? error.message : 'Unable to complete request.',
      life: 3000
    });
  } finally {
    isLoading.value = false;
  }
}
</script>
