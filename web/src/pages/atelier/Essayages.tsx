import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { dateFr } from '../../lib/format';
import { Alerte, Badge, Btn, Chargement, EnTete, Vide, useAction } from '../../components/ui';
import { EssayageModale } from '../../components/EssayagesRetouches';

const LIB: Record<string, [string, 'ok' | 'ocre' | 'gris']> = { planifie: ['Planifié', 'ocre'], effectue: ['Effectué', 'ok'], annule: ['Annulé', 'gris'] };

export default function Essayages() {
  const { ctx } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction();
  const [statut, setStatut] = useState('planifie'); const [nouveau, setNouveau] = useState(false);
  const q = useQuery({ queryKey: ['essayages', statut], queryFn: async () => {
    let r = supabase.from('essayages').select('*, habits(id, code, type_libelle)').order('date_essayage', { ascending: statut === 'planifie' }).limit(200);
    if (statut) r = r.eq('statut', statut);
    const { data, error } = await r; if (error) throw error; return data as any[]; } });
  const maj = (id: string, s: string) => lancer(async () => { const { error } = await supabase.from('essayages').update({ statut: s }).eq('id', id); if (error) throw error; qc.invalidateQueries({ queryKey: ['essayages'] }); }, 'Essayage mis à jour.', msgErreur);
  return (
    <>
      <EnTete titre="Essayages">{peut(ctx, 'essayages.gerer') && <Btn onClick={() => setNouveau(true)}>Planifier un essayage</Btn>}</EnTete>
      <div className="onglets">{[['planifie', 'À venir'], ['effectue', 'Effectués'], ['annule', 'Annulés'], ['', 'Tous']].map(([k, l]) => <button key={k} className={statut === k ? 'on' : ''} onClick={() => setStatut(k)}>{l}</button>)}</div>
      {q.isLoading && <Chargement />}{q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !q.data.length && <Vide titre="Aucun essayage" texte="Planifiez un essayage depuis cette page ou depuis la fiche d'un habit." />}
      <div className="pile">{q.data?.map((e) => (
        <div key={e.id} className="carte ligne"><div><b>{dateFr(e.date_essayage)}{e.heure ? ` à ${e.heure}` : ''}</b>
          <div className="petit"><Link to={`/app/habits/${e.habits?.id}`}>{e.habits?.code}</Link> · {e.habits?.type_libelle}</div>{e.note && <div className="muted petit">{e.note}</div>}</div>
          <span className="espace" /><Badge ton={LIB[e.statut][1]}>{LIB[e.statut][0]}</Badge>
          {e.statut === 'planifie' && peut(ctx, 'essayages.gerer') && <><Btn petit disabled={enCours} onClick={() => maj(e.id, 'effectue')}>Effectué</Btn><Btn petit variante="danger sec" disabled={enCours} onClick={() => maj(e.id, 'annule')}>Annuler</Btn></>}</div>))}</div>
      <EssayageModale ouverte={nouveau} onFermer={() => setNouveau(false)} onFait={() => qc.invalidateQueries({ queryKey: ['essayages'] })} />
    </>
  );
}
