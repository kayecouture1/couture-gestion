import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { aujourdhui, dateFr, fcfa } from '../../lib/format';
import { Alerte, Btn, Champ, Chargement, EnTete, Modale, Vide, useAction, useRetours } from '../../components/ui';

export default function Depenses() {
  const { ctx } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction(); const { confirmer } = useRetours();
  const [mois, setMois] = useState(aujourdhui().slice(0, 7));
  const [f, setF] = useState<{ id?: string; titre: string; libelle: string; montant: string; date: string } | null>(null);
  const [er, setEr] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['depenses', mois], queryFn: async () => {
    const debut = mois + '-01'; const [a, m] = mois.split('-').map(Number); const fin = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('depenses').select('*').is('archived_at', null).gte('date_depense', debut).lt('date_depense', fin).order('date_depense', { ascending: false }); if (error) throw error; return data as any[]; } });
  const total = (q.data ?? []).reduce((s, d) => s + Number(d.montant_fcfa), 0);
  const fin = () => qc.invalidateQueries({ queryKey: ['depenses'] });

  const sauver = () => lancer(async () => {
    setEr(null); const montant = Number(f!.montant.replace(/\D/g, ''));
    if (!f!.titre.trim()) { setEr('Indiquez un titre.'); return; } if (!montant) { setEr('Indiquez un montant.'); return; } if (!f!.date) { setEr('Indiquez la date.'); return; }
    const ligne = { titre: f!.titre.trim(), libelle: f!.libelle.trim() || null, montant_fcfa: montant, date_depense: f!.date };
    const r = f!.id ? await supabase.from('depenses').update(ligne).eq('id', f!.id) : await supabase.from('depenses').insert({ ...ligne, atelier_id: ctx!.atelier!.id });
    if (r.error) throw r.error; setF(null); fin();
  }, 'Dépense enregistrée.', msgErreur);

  return (
    <>
      <EnTete titre="Dépenses">{peut(ctx, 'depenses.creer') && <Btn onClick={() => { setEr(null); setF({ titre: '', libelle: '', montant: '', date: aujourdhui() }); }}>Nouvelle dépense</Btn>}</EnTete>
      <div className="ligne" style={{ marginBottom: '1rem' }}><input className="input" type="month" style={{ maxWidth: 200 }} value={mois} onChange={(e) => e.target.value && setMois(e.target.value)} /><span className="espace" /><div className="stat">{fcfa(total)}<small>Total du mois</small></div></div>
      {q.isLoading && <Chargement />}{q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !q.data.length && <Vide titre="Aucune dépense ce mois-ci" />}
      <div className="pile">{q.data?.map((d) => (
        <div key={d.id} className="carte ligne"><div><b>{d.titre}</b>{d.libelle && <div className="muted petit">{d.libelle}</div>}<div className="muted petit">{dateFr(d.date_depense)}</div></div><span className="espace" /><b>{fcfa(d.montant_fcfa)}</b>
          {peut(ctx, 'depenses.modifier') && <><Btn variante="sec" petit onClick={() => { setEr(null); setF({ id: d.id, titre: d.titre, libelle: d.libelle ?? '', montant: String(d.montant_fcfa), date: d.date_depense }); }}>Modifier</Btn>
            <Btn variante="danger sec" petit onClick={async () => { if (await confirmer('Archiver cette dépense ? Elle ne sera plus comptée.', { danger: true })) lancer(async () => { const r = await supabase.from('depenses').update({ archived_at: new Date().toISOString() }).eq('id', d.id); if (r.error) throw r.error; fin(); }, 'Dépense archivée.', msgErreur); }}>Archiver</Btn></>}</div>))}</div>
      <Modale ouverte={!!f} titre={f?.id ? 'Modifier la dépense' : 'Nouvelle dépense'} onFermer={() => setF(null)}>
        {er && <Alerte ton="err">{er}</Alerte>}
        <Champ label="Titre"><input className="input" value={f?.titre ?? ''} onChange={(e) => setF({ ...f!, titre: e.target.value })} /></Champ>
        <Champ label="Libellé (facultatif)"><input className="input" value={f?.libelle ?? ''} onChange={(e) => setF({ ...f!, libelle: e.target.value })} /></Champ>
        <div className="grille2"><Champ label="Montant (FCFA)"><input className="input" inputMode="numeric" value={f?.montant ?? ''} onChange={(e) => setF({ ...f!, montant: e.target.value.replace(/\D/g, '') })} /></Champ><Champ label="Date"><input className="input" type="date" value={f?.date ?? ''} onChange={(e) => setF({ ...f!, date: e.target.value })} /></Champ></div>
        <Btn bloc chargement={enCours} onClick={sauver}>Enregistrer</Btn>
      </Modale>
    </>
  );
}
