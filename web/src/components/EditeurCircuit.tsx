import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Btn } from './ui';
import type { Membre } from '../lib/hooks';

export interface EtapeForm { nom: string; mode: 'role' | 'personne'; role_id: string; user_id: string }
export const etapeVide = (): EtapeForm => ({ nom: '', mode: 'role', role_id: '', user_id: '' });

export function verifierEtapes(etapes: EtapeForm[]): string | null {
  if (!etapes.length) return 'Ajoutez au moins une étape.';
  for (const [i, e] of etapes.entries()) {
    if (!e.nom.trim()) return `L'étape ${i + 1} n'a pas de nom.`;
    if (e.mode === 'role' && !e.role_id) return `Choisissez un rôle pour l'étape « ${e.nom} ».`;
    if (e.mode === 'personne' && !e.user_id) return `Choisissez une personne pour l'étape « ${e.nom} ».`;
  }
  return null;
}

// Éditeur d'étapes : chaque étape va à une personne précise OU à tous ceux qui ont le rôle choisi.
export function EditeurCircuit({ etapes, onChange, roles, membres }:
  { etapes: EtapeForm[]; onChange: (e: EtapeForm[]) => void; roles: { id: string; nom: string; actif: boolean }[]; membres: Membre[] }) {
  const maj = (i: number, p: Partial<EtapeForm>) => onChange(etapes.map((e, k) => (k === i ? { ...e, ...p } : e)));
  const deplacer = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= etapes.length) return;
    const c = [...etapes]; [c[i], c[j]] = [c[j], c[i]]; onChange(c);
  };
  return (
    <div className="pile" style={{ gap: '.6rem' }}>
      {etapes.map((e, i) => (
        <div key={i} className="carte" style={{ padding: '.7rem' }}>
          <div className="ligne">
            <b style={{ width: 22 }}>{i + 1}</b>
            <input className="input" style={{ flex: '1 1 140px', width: 'auto' }} placeholder="Nom (ex. Coupe)" value={e.nom} onChange={(x) => maj(i, { nom: x.target.value })} aria-label={`Nom de l'étape ${i + 1}`} />
            <select className="input" style={{ flex: '0 1 150px', width: 'auto' }} value={e.mode} onChange={(x) => maj(i, { mode: x.target.value as any, role_id: '', user_id: '' })} aria-label="Attribution">
              <option value="role">Tous les… (rôle)</option><option value="personne">Une personne</option>
            </select>
            {e.mode === 'role' ? (
              <select className="input" style={{ flex: '1 1 140px', width: 'auto' }} value={e.role_id} onChange={(x) => maj(i, { role_id: x.target.value })} aria-label="Rôle">
                <option value="">Rôle…</option>{roles.filter((r) => r.actif).map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}</select>
            ) : (
              <select className="input" style={{ flex: '1 1 140px', width: 'auto' }} value={e.user_id} onChange={(x) => maj(i, { user_id: x.target.value })} aria-label="Personne">
                <option value="">Personne…</option>{membres.filter((m) => m.statut === 'actif').map((m) => <option key={m.user_id} value={m.user_id}>{m.prenom} {m.nom}</option>)}</select>
            )}
            <Btn type="button" variante="sec" petit onClick={() => deplacer(i, -1)} aria-label="Monter"><ArrowUp size={14} /></Btn>
            <Btn type="button" variante="sec" petit onClick={() => deplacer(i, 1)} aria-label="Descendre"><ArrowDown size={14} /></Btn>
            <Btn type="button" variante="danger sec" petit onClick={() => onChange(etapes.filter((_, k) => k !== i))} aria-label="Supprimer l'étape"><Trash2 size={14} /></Btn>
          </div>
        </div>
      ))}
      <Btn type="button" variante="sec" petit onClick={() => onChange([...etapes, etapeVide()])}><Plus size={14} /> Ajouter une étape</Btn>
    </div>
  );
}
