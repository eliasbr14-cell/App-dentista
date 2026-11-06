import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fromRow, supabase } from './supabase';
import type { Clinic, Profile, Role } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  master: 'Admin Master',
  admin: 'Administrador',
  dentista: 'Dentista',
  recepcao: 'Recepção',
};

export interface Can {
  /** odontograma, procedimentos, exames */
  clinical: boolean;
  /** usuários, configurações do consultório, excluir paciente */
  admin: boolean;
  /** consultórios, cobrança */
  master: boolean;
}

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  clinics: Clinic[];
  clinic: Clinic | null;
  setClinicId: (id: string) => void;
  can: Can;
  loading: boolean;
  recovering: boolean;
  setRecovering: (v: boolean) => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const LS_CLINIC = 'imperium-master-clinic';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setClinics([]);
      setLoading(false);
      return;
    }
    const [{ data: p }, { data: cs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('clinics').select('*').order('nome'),
    ]);
    const prof = p ? fromRow<Profile>(p) : null;
    const list = (cs ?? []).map((c) => fromRow<Clinic>(c)).map((c) => ({ ...c, settings: c.settings ?? {} }));
    setProfile(prof);
    setClinics(list);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LS_CLINIC);
    } catch {
      /* sem storage */
    }
    const id = prof?.clinicId ?? (list.some((c) => c.id === saved) ? saved : list[0]?.id ?? null);
    setClinicIdState(id);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // evita chamar o banco dentro do callback de autenticação
        setTimeout(() => load(s), 0);
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(s);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const setClinicId = (id: string) => {
    setClinicIdState(id);
    try {
      localStorage.setItem(LS_CLINIC, id);
    } catch {
      /* sem storage */
    }
  };

  const role = profile?.ativo ? profile.role : undefined;
  const can: Can = {
    master: role === 'master',
    admin: role === 'master' || role === 'admin',
    clinical: role === 'master' || role === 'admin' || role === 'dentista',
  };

  const value: AuthCtx = {
    session,
    profile,
    clinics,
    clinic: clinics.find((c) => c.id === clinicId) ?? null,
    setClinicId,
    can,
    loading,
    recovering,
    setRecovering,
    reload: async () => {
      const { data } = await supabase.auth.getSession();
      await load(data.session);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider ausente');
  return c;
}
