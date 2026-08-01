import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      redirect: '/decks',
      component: () => import('@/views/HomeView.vue'),
      children: [
        {
          path: 'decks',
          name: 'decks',
          component: () => import('@/views/DecksView.vue'),
          meta: { depth: 0 }
        },
        {
          path: 'decks/:id/list',
          name: 'deck',
          component: () => import('@/views/AssemblyView.vue'),
          props: true,
          meta: { depth: 1, group: 'assembly' }
        },
        {
          path: 'decks/:id/sources',
          name: 'deckSources',
          component: () => import('@/views/AssemblyView.vue'),
          props: true,
          meta: { depth: 1, group: 'assembly' }
        },
        {
          path: 'decks/import',
          name: 'importDeck',
          component: () => import('@/views/ImportDeckView.vue'),
          meta: { depth: 0 }
        },
        {
          path: 'dev',
          name: 'dev',
          component: () => import('@/views/DevView.vue'),
          meta: { depth: 0 }
        }
      ]
    }
  ]
});

export default router;
