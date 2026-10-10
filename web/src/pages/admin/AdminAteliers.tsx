import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { dateFr } from '../../lib/format';
import { Alerte, Badge, Chargement, EnTete, Vide } from '../../components/ui';

const ETATS: Record<string, [string, 'ok' | 'alerte' | 'ocre' | 'gris']> = {
  actif: ['Actif', 'ok'], expire: ['Expiré', 'alerte'], desactive: ['Désactivé', 'gris'], en_attente: ['En attente', 'ocre'],
};

export default function AdminAteliers() {
  const [params, setParams] = useSearchParams();
  const [terme, setTerme] = useState('');
  const etat = params.get('etat') ?? '';
  const q = useQuery({ queryKey: ['admin-ateliers'], queryFn: () => api<{ ateliers: any[] }>('/api/admin/ateliers') });
  const liste = (q.data?.ateliers ?? []).filter((a) => (!etat || a.etat === etat) && (!terme || a.nom.toLowerCase().includes(terme.toLowerCase())));
  return (
    <>
      <EnTete titre="Ateliers" />
      <div className="ligne" style={{ marginBottom: '1rem' }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Rechercher un atelier" value={terme} onChange={(e) => setTerme(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={etat} onChange={(e) => setParams(e.target.value ? { etat: e.target.value } : {})}>
          <option value="">Tous les états</option>{Object.entries(ETATS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {q.isLoading && <Chargement />}
      {q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !liste.length && <Vide titre="Aucun atelier" texte="Aucun atelier ne correspond à ce filtre." />}
      <div className="pile">
        {liste.map((a) => (
          <Link key={a.id} to={`/admin/ateliers/${a.id}`} className="carte cliquable ligne">
            <div><b>{a.nom}</b><div className="muted petit">Code {a.code_atelier} · {a.nb_membres} membre(s) · créé le {dateFr(a.created_at)}</div></div>
            <span className="espace" />
            {a.fin_abonnement && <span className="muted petit">fin {dateFr(a.fin_abonnement)}</span>}
            <Badge ton={ETATS[a.etat][1]}>{ETATS[a.etat][0]}</Badge>
          </Link>
        ))}
      </div>
    </>
  );
}
