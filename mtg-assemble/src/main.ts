import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { PrimeVue } from '@primevue/core';
import { ToastService } from 'primevue';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

import 'primeicons/primeicons.css';
import './tailwind.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());

const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{rose.50}',
      100: '{rose.100}',
      200: '{rose.200}',
      300: '{rose.300}',
      400: '{rose.400}',
      500: '{rose.500}',
      600: '{rose.600}',
      700: '{rose.700}',
      800: '{rose.800}',
      900: '{rose.900}',
      950: '{rose.950}'
    }
  }
});

app.use(PrimeVue, { theme: { preset: MyPreset } });
app.use(router);
app.use(ToastService);

app.mount('#app');
