import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { apiFetch, readJsonResponse } from './api';

export type AppRole = 'admin' | 'super_user' | 'publisher' | 'shopper';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshRole() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setRole(null);
      return;
    }

    const response = await apiFetch('/api/auth/me');
    const payload = await readJsonResponse(response);
    setRole(payload.role || 'shopper');
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session) {
        try {
          await refreshRole();
        } catch {
          setRole('shopper');
        }
      }
      if (!cancelled) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setRole(null);
        setLoading(false);
        return;
      }
      void refreshRole().catch(() => setRole('shopper')).finally(() => setLoading(false));
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await refreshRole();
  }

  async function signUp(email: string, password: string) {
    const developerSignupResponse = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (developerSignupResponse.ok) {
      await signIn(email, password);
      return;
    }

    if (developerSignupResponse.status !== 409) {
      const payload = await developerSignupResponse.json().catch(() => null);
      throw new Error(payload?.error || 'Developer signup failed.');
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await refreshRole();
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setRole(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user || null,
    session,
    role,
    loading,
    isStaff: role === 'admin' || role === 'super_user' || role === 'publisher',
    signIn,
    signUp,
    signOut,
    refreshRole
  }), [session, role, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
