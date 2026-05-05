import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Ensures the user is signed in (anonymously if needed).
 * Returns the current user once available.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Listen first
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    // Bootstrap session
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        setUser(data.session.user);
        setReady(true);
        return;
      }
      // Sign in anonymously
      const { data: anon, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous sign-in failed', error);
      } else if (mounted) {
        setUser(anon.user);
      }
      setReady(true);
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, ready };
}
