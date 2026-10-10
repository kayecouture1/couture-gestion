import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { dateFr, fcfa } from '../../lib/format';
import { Alerte, Badge, Btn, Chargement, EnTete, Vide, useAction } from '../../components/ui';
import { RetoucheModale } from '../../components/EssayagesRetouches';

const LIB: Record<string, [string, 'ok' | 'ocre' | 'gris' | 'alerte']> = { demandee: ['Demandée', 'alerte'], en_cours: ['En cours', 'ocre'], terminee: ['Terminée', 'ok'], annulee: ['Annulée', 'gris'] };

export default function Retouches() {
  const { ctx } = useAuth(); const qc = useQueryClient(); const { enCours, lancer } = useAction();
  const [statut, setStatut] = useState('actives'); const [nouveau, setNouveau] = useState(false);
  const q = useQuery({ queryKey: ['retouches', statut], queryFn: async () => {
    let r = supabase.from('retouches').select('*, habits(id, code, type_libelle)').order('created_at', { ascending: false }).limit(200);
    if (statut === 'actives') r = r.in('statut', ['demandee', 'en_cours']); else if (statut) r = r.eq('statut', statut);
    const { data, error } = await r; if (error) throw error; return data as any[]; } });
  const maj = (id: string, s: string) => lancer(async () => {
    const { error } = await supabase.from('retouches').update({ statut: s, termine_at: s === 'terminee' ? new Date().toISOString() : null }).eq('id', id);
    if (error) throw error; qc.invalidateQueries({ queryKey: ['retouches'] });
  }, 'Retouche mise à jour.', msgErreur);
  return (
    <>
      <EnTete titre="Retouches">{peut(ctx, 'retouches.gerer') && <Btn onClick={() => setNouveau(true)}>Demander une retouche</Btn>}</EnTete>
      <div className="onglets">{[['actives', 'À faire'], ['terminee', 'Terminées'], ['annulee', 'Annulées'], ['', 'Toutes']].map(([k, l]) => <button key={k} className={statut === k ? 'on' : ''} onClick={() => setStatut(k)}>{l}</button>)}</div>
      {q.isLoading && <Chargement />}{q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !q.data.length && <Vide titre="Aucune retouche" />}
      <div className="pile">{q.data?.map((r) => (
        <div key={r.id} className="carte"><div className="ligne"><b><Link to={`/app/habits/${r.habits?.id}`}>{r.habits?.code}</Link></b><span className="muted petit">{r.habits?.type_libelle}</span><span className="espace" /><Badge ton={LIB[r.statut][1]}>{LIB[r.statut][0]}</Badge></div>
          <p style={{ margin: '.4rem 0' }}>{r.description}</p>
          <p className="muted petit" style={{ margin: 0 }}>{r.date_prevue ? `Prévue le ${dateFr(r.date_prevue)} · ` : ''}{r.cout_fcfa ? `Coût : ${fcfa(r.cout_fcfa)}` : 'Sans coût supplémentaire'}</p>
          {peut(ctx, 'retouches.gerer') && ['demandee', 'en_cours'].includes(r.statut) && (
            <div className="ligne" style={{ marginTop: '.6rem' }}>
              {r.statut === 'demandee' && <Btn petit variante="sec" disabled={enCours} onClick={() => maj(r.id, 'en_cours')}>Démarrer</Btn>}
              <Btn petit disabled={enCours} onClick={() => maj(r.id, 'terminee')}>Terminée</Btn>
              <Btn petit variante="danger sec" disabled={enCours} onClick={() => maj(r.id, 'annulee')}>Annuler</Btn></div>)}</div>))}</div>
      <RetoucheModale ouverte={nouveau} onFermer={() => setNouveau(false)} onFait={() => qc.invalidateQueries({ queryKey: ['retouches'] })} />
    </>
  );
}
