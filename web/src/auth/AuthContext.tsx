import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Contexte } from '../lib/perms';

interface Auth {
  session: Session | null;
  ctx: Contexte | null;
  chargement: boolean;
  recuperation: boolean; // arrivé via un lien « mot de passe oublié »
  rafraichir: () => Promise<void>;
  deconnexion: () => Promise<void>;
}
const Ctx = createContext<Auth>(null as unknown as Auth);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ctx, setCtx] = useState<Contexte | null>(null);
  const [chargement, setChargement] = useState(true);
  const [recuperation, setRecuperation] = useState(false);
  const qc = useQueryClient();
  const idRef = useRef<string | null>(null);

  const charger = useCallback(async (s: Session | null) => {
    if (!s) { setCtx(null); return; }
    const { data, error } = await supabase.rpc('mon_contexte');
    if (!error && data) setCtx(data as Contexte);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session); idRef.current = data.session?.user.id ?? null;
      await charger(data.session); setChargement(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecuperation(true);
      setSession(s);
      if ((s?.user.id ?? null) !== idRef.current) { idRef.current = s?.user.id ?? null; qc.clear(); }
      // Ne pas appeler Supabase directement dans le callback : on diffère.
      setTimeout(() => { charger(s); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [charger, qc]);

  // L'accès est revérifié régulièrement : expiration d'abonnement, désactivation d'un compte, etc.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') charger(session); }, 5 * 60_000);
    const onFocus = () => charger(session);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [session, charger]);

  const value: Auth = {
    session, ctx, chargement, recuperation,
    rafraichir: () => charger(session),
    deconnexion: async () => { await supabase.auth.signOut(); qc.clear(); setCtx(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
