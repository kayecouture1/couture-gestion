import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { dateFr, fcfa, LIBELLES_STATUT } from '../../lib/format';
import { Alerte, Badge, Chargement, EnTete, Vide } from '../../components/ui';

export default function Commandes() {
  const { ctx } = useAuth();
  const [params] = useSearchParams();
  const [statut, setStatut] = useState(params.get('statut') ?? 'en_cours');
  const q = useQuery({
    queryKey: ['commandes', statut],
    queryFn: async () => {
      let r = supabase.from('commandes')
        .select('id, code, total_fcfa, statut, date_rdv, created_at, clients(nom, prenom), habits(id, statut), paiements(montant_fcfa, annule_at)')
        .order('date_rdv', { ascending: true, nullsFirst: false }).limit(200);
      if (statut) r = r.eq('statut', statut);
      const { data, error } = await r; if (error) throw error; return data as any[];
    },
  });
  return (
    <>
      <EnTete titre="Commandes">{peut(ctx, 'commandes.creer') && <Link className="btn" to="/app/commandes/nouvelle">Nouvelle commande</Link>}</EnTete>
      <div className="onglets">
        {[['en_cours', 'En cours'], ['terminee', 'Terminées'], ['annulee', 'Annulées'], ['', 'Toutes']].map(([k, l]) => <button key={k} className={statut === k ? 'on' : ''} onClick={() => setStatut(k)}>{l}</button>)}
      </div>
      <p className="muted petit">Triées par rendez-vous le plus proche.</p>
      {q.isLoading && <Chargement />}
      {q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !q.data.length && <Vide titre="Aucune commande" texte="Les commandes de ce statut apparaîtront ici." />}
      <div className="pile">
        {q.data?.map((c) => {
          const paye = (c.paiements ?? []).filter((p: any) => !p.annule_at).reduce((s: number, p: any) => s + Number(p.montant_fcfa), 0);
          const nbT = (c.habits ?? []).filter((h: any) => h.statut === 'termine').length;
          return (
            <Link key={c.id} to={`/app/commandes/${c.id}`} className="carte cliquable">
              <div className="ligne"><b>{c.code}</b><span>{c.clients ? `${c.clients.prenom} ${c.clients.nom}` : ''}</span><span className="espace" /><Badge ton={c.statut === 'terminee' ? 'ok' : c.statut === 'annulee' ? 'gris' : 'ocre'}>{LIBELLES_STATUT[c.statut]}</Badge></div>
              <div className="muted petit" style={{ marginTop: '.3rem' }}>
                RDV : <b>{dateFr(c.date_rdv)}</b> · {nbT}/{c.habits?.length ?? 0} habit(s) terminé(s) · {fcfa(c.total_fcfa)} (reste {fcfa(c.total_fcfa - paye)})
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
