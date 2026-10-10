import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

// ---------- Boutons, champs, badges ----------
export function Btn({ variante, petit, bloc, chargement, children, className = '', ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'sec' | 'ocre' | 'danger' | 'danger sec'; petit?: boolean; bloc?: boolean; chargement?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || chargement} className={`btn ${variante ?? ''} ${petit ? 'petit' : ''} ${bloc ? 'bloc' : ''} ${className}`}>
      {chargement && <span className="spin" aria-hidden />}{children}
    </button>
  );
}

export function Champ({ label, erreur, aide, children }: { label: string; erreur?: string | null; aide?: string; children: ReactNode }) {
  return (
    <div className="champ">
      <label>{label}</label>
      {children}
      {aide && !erreur && <span className="aide">{aide}</span>}
      {erreur && <span className="err" role="alert">{erreur}</span>}
    </div>
  );
}

export const Badge = ({ children, ton }: { children: ReactNode; ton?: 'ok' | 'alerte' | 'ocre' | 'gris' }) =>
  <span className={`badge ${ton ?? ''}`}>{children}</span>;

export const Alerte = ({ ton = 'info', children }: { ton?: 'err' | 'ok' | 'info' | 'avert'; children: ReactNode }) =>
  <div className={`alerte-bloc ${ton}`} role={ton === 'err' ? 'alert' : 'status'}>{children}</div>;

export const Chargement = ({ texte = 'Chargement…' }: { texte?: string }) =>
  <div className="chargement" role="status"><span className="spin" /><span>{texte}</span></div>;

export const Vide = ({ titre, texte, action }: { titre: string; texte?: string; action?: ReactNode }) =>
  <div className="vide"><h3>{titre}</h3>{texte && <p>{texte}</p>}{action}</div>;

export function EnTete({ titre, retour, children }: { titre: string; retour?: string; children?: ReactNode }) {
  return (
    <div className="entete">
      {retour && <Link to={retour} className="btn sec petit" aria-label="Retour"><ArrowLeft size={16} /></Link>}
      <h1>{titre}</h1><span className="espace" />{children}
    </div>
  );
}

export function Erreur({ e }: { e: unknown }) {
  return <Alerte ton="err">{(e as any)?.message ?? 'Erreur'}</Alerte>;
}

// ---------- Modale ----------
export function Modale({ ouverte, titre, onFermer, large, children }:
  { ouverte: boolean; titre: string; onFermer: () => void; large?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouverte) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', f);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', f);
  }, [ouverte, onFermer]);
  if (!ouverte) return null;
  return (
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className={`modale ${large ? 'large' : ''}`} role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={ref}>
        <div className="ligne"><h2>{titre}</h2><span className="espace" />
          <button className="btn sec petit" onClick={onFermer} aria-label="Fermer"><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

// ---------- Toasts et confirmations ----------
interface Toast { id: number; texte: string; ton: 'ok' | 'err' | 'info' }
interface Retours {
  ok: (t: string) => void; err: (t: string) => void;
  confirmer: (message: string, opts?: { libelle?: string; danger?: boolean }) => Promise<boolean>;
}
const RetoursCtx = createContext<Retours>(null as unknown as Retours);
export const useRetours = () => useContext(RetoursCtx);

export function RetoursProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<null | { message: string; libelle: string; danger: boolean; fin: (v: boolean) => void }>(null);
  const id = useRef(0);
  const ajouter = useCallback((texte: string, ton: Toast['ton']) => {
    const n = ++id.current;
    setToasts((t) => [...t, { id: n, texte, ton }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n)), ton === 'err' ? 6000 : 3500);
  }, []);
  const confirmer: Retours['confirmer'] = (message, opts) =>
    new Promise((fin) => setConf({ message, libelle: opts?.libelle ?? 'Confirmer', danger: !!opts?.danger, fin }));
  const clore = (v: boolean) => { conf?.fin(v); setConf(null); };
  return (
    <RetoursCtx.Provider value={{ ok: (t) => ajouter(t, 'ok'), err: (t) => ajouter(t, 'err'), confirmer }}>
      {children}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.ton}`}>{t.texte}</div>)}</div>
      <Modale ouverte={!!conf} titre="Confirmation" onFermer={() => clore(false)}>
        <p>{conf?.message}</p>
        <div className="ligne" style={{ justifyContent: 'flex-end' }}>
          <Btn variante="sec" onClick={() => clore(false)}>Annuler</Btn>
          <Btn variante={conf?.danger ? 'danger' : undefined} onClick={() => clore(true)}>{conf?.libelle}</Btn>
        </div>
      </Modale>
    </RetoursCtx.Provider>
  );
}

// Aide : exécute une action asynchrone avec état de chargement, message de succès ou d'erreur.
export function useAction() {
  const { ok, err } = useRetours();
  const [enCours, setEnCours] = useState(false);
  const lancer = async <T,>(fn: () => Promise<T>, succes?: string, traduire: (e: unknown) => string = (e) => (e as any)?.message ?? 'Erreur'): Promise<T | undefined> => {
    setEnCours(true);
    try { const r = await fn(); if (succes) ok(succes); return r; }
    catch (e) { err(traduire(e)); return undefined; }
    finally { setEnCours(false); }
  };
  return { enCours, lancer };
}
