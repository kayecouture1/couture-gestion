import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { msgErreur } from '../lib/erreurs';
import { normaliserTelephone } from '../lib/format';
import { Btn, Champ, useAction } from './ui';

export interface ClientRow { id: string; nom: string; prenom: string; telephone_e164: string | null; whatsapp_e164: string | null; notes: string | null }

// Création / modification d'un client. Les numéros sont enregistrés au format international.
export function ClientForm({ client, onFait }: { client?: ClientRow; onFait: (c: ClientRow) => void }) {
  const { ctx } = useAuth();
  const { enCours, lancer } = useAction();
  const [f, setF] = useState({ nom: client?.nom ?? '', prenom: client?.prenom ?? '', tel: client?.telephone_e164 ?? '', wa: client?.whatsapp_e164 ?? '', notes: client?.notes ?? '' });
  const [er, setEr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function valider() {
    const e: Record<string, string> = {};
    if (!f.nom.trim()) e.nom = 'Nom requis.';
    if (!f.prenom.trim()) e.prenom = 'Prénom requis.';
    const tel = f.tel.trim() ? normaliserTelephone(f.tel) : null;
    if (f.tel.trim() && !tel) e.tel = 'Numéro invalide.';
    if (!f.tel.trim() && !f.wa.trim()) e.tel = 'Indiquez au moins un numéro (téléphone ou WhatsApp).';
    const wa = f.wa.trim() ? normaliserTelephone(f.wa) : null;
    if (f.wa.trim() && !wa) e.wa = 'Numéro WhatsApp invalide.';
    setEr(e); if (Object.keys(e).length) return;
    const ligne = { nom: f.nom.trim(), prenom: f.prenom.trim(), telephone_e164: tel, whatsapp_e164: wa, notes: f.notes.trim() || null };
    await lancer(async () => {
      const q = client
        ? supabase.from('clients').update(ligne).eq('id', client.id).select().single()
        : supabase.from('clients').insert({ ...ligne, atelier_id: ctx!.atelier!.id }).select().single();
      const { data, error } = await q; if (error) throw error;
      onFait(data as ClientRow);
    }, client ? 'Client modifié.' : 'Client créé.', msgErreur);
  }
  return (
    <div>
      <div className="grille2">
        <Champ label="Nom" erreur={er.nom}><input className="input" value={f.nom} onChange={set('nom')} /></Champ>
        <Champ label="Prénom" erreur={er.prenom}><input className="input" value={f.prenom} onChange={set('prenom')} /></Champ>
      </div>
      <div className="grille2">
        <Champ label="Téléphone" erreur={er.tel} aide="Ex. 76 12 34 56"><input className="input" type="tel" value={f.tel} onChange={set('tel')} /></Champ>
        <Champ label="WhatsApp" erreur={er.wa} aide="Laisser vide si identique"><input className="input" type="tel" value={f.wa} onChange={set('wa')} /></Champ>
      </div>
      <Champ label="Notes (facultatif)"><textarea className="input" value={f.notes} onChange={set('notes')} /></Champ>
      <Btn bloc chargement={enCours} onClick={valider}>{client ? 'Enregistrer' : 'Créer le client'}</Btn>
    </div>
  );
}
