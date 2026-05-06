import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/decks',
      component: () => import('@/views/HomeView.vue'),
      children: [
        {
          path: 'decks',
          name: 'decks',
          component: () => import('@/views/DecksView.vue')
        },
        {
          path: 'decks/:id/list',
          name: 'deck',
          component: () => import('@/views/AssemblyView.vue'),
          props: true
        },
        {
          path: 'decks/:id/sources',
          name: 'deckSources',
          component: () => import('@/views/AssemblyView.vue'),
          props: true
        },
        {
          path: 'decks/import',
          name: 'importDeck',
          component: () => import('@/views/ImportDeckView.vue')
        },
        {
          path: 'dev',
          name: 'dev',
          component: () => import('@/views/DevView.vue')
        }
      ]
    }
  ]
});

export default router;
