import { readonly, ref } from 'vue';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/util/supabase';

const user = ref<User | null>(null);
const initialized = ref(false);

let authInitialized = false;

export function useAuth() {
  async function initializeAuth(): Promise<void> {
    if (authInitialized) {
      return;
    }

    authInitialized = true;

    const {
      data: { session }
    } = await supabase.auth.getSession();

    user.value = session?.user ?? null;
    initialized.value = true;

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null;
    });
  }

  async function signUp(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      throw error;
    }
  }

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }
  }

  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  return {
    user: readonly(user),
    initialized: readonly(initialized),
    initializeAuth,
    signUp,
    signIn,
    signOut
  };
}
