import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setReady(true);
    })();
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    [],
  );

  const signUp = useCallback(
    (email: string, password: string, displayName?: string) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: displayName ? { display_name: displayName } : undefined,
        },
      }),
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    return lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
  }, []);

  const signInAsGuest = useCallback(() => supabase.auth.signInAnonymously(), []);

  const sendPasswordReset = useCallback(
    (email: string) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    [],
  );

  const updatePassword = useCallback(
    (password: string) => supabase.auth.updateUser({ password }),
    [],
  );

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return {
    user, session, ready,
    signIn, signUp, signInWithGoogle, signInAsGuest,
    sendPasswordReset, updatePassword, signOut,
  };
}
