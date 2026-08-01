import { ref } from 'vue';
import router from './index';

/**
 * Name of the transition to play for the current route change.
 * - 'slide-left': navigating forward/deeper (e.g. decks -> deck)
 * - 'slide-right': navigating backward/shallower (e.g. deck -> decks)
 * - 'none': no animation (e.g. switching tabs within the same view group)
 */
export const transitionName = ref<'slide-left' | 'slide-right' | 'none'>('none');

router.afterEach((to, from) => {
  const toGroup = to.meta.group;
  const fromGroup = from.meta.group;

  if (!from.name || (toGroup && toGroup === fromGroup)) {
    transitionName.value = 'none';
    return;
  }

  const toDepth = (to.meta.depth as number | undefined) ?? 0;
  const fromDepth = (from.meta.depth as number | undefined) ?? 0;

  transitionName.value = toDepth < fromDepth ? 'slide-right' : 'slide-left';
});
