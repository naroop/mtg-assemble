import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      children: [
        {
          path: '/decks',
          name: 'decks',
          component: () => import('@/views/AllDecksView.vue')
        },
        {
          path: '/decks/:id',
          name: 'deck',
          component: () => import('@/views/DeckView.vue')
        },
        {
          path: '/decks/import',
          name: 'importDeck',
          component: () => import('@/views/ImportDeckView.vue')
        },
        {
          path: '/dev',
          name: 'dev',
          component: () => import('@/views/DevView.vue')
        }
      ]
    }
  ]
});

export default router;
