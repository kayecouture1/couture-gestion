import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { Alerte, Chargement, EnTete } from '../../components/ui';

export default function AdminAccueil() {
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<any>('/api/admin/stats') });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const { ateliers: a, abonnements: b } = q.data;
  const T = ({ to, n, l }: { to: string; n: number; l: string }) => <Link to={to} className="carte cliquable"><div className="stat">{n}<small>{l}</small></div></Link>;
  return (
    <>
      <EnTete titre="Administration" />
      <h2 style={{ margin: '.4rem 0 .7rem' }}>Ateliers</h2>
      <div className="grille">
        <T to="/admin/ateliers" n={a.total} l="Ateliers au total" />
        <T to="/admin/ateliers?etat=actif" n={a.actif} l="Actifs" />
        <T to="/admin/ateliers?etat=expire" n={a.expire} l="Expirés" />
        <T to="/admin/ateliers?etat=desactive" n={a.desactive} l="Désactivés" />
        <T to="/admin/ateliers?etat=en_attente" n={a.en_attente} l="En attente d'activation" />
      </div>
      <h2 style={{ margin: '1.4rem 0 .7rem' }}>Abonnements</h2>
      <div className="grille">
        <T to="/admin/ateliers?etat=actif" n={b.actif} l="Actifs" />
        <T to="/admin/ateliers?etat=expire" n={b.expire} l="Expirés" />
        <T to="/admin/ateliers" n={b.a_venir} l="À venir" />
        <T to="/admin/ateliers?etat=desactive" n={b.desactive} l="Désactivés" />
        <T to="/admin/ateliers?etat=en_attente" n={b.en_attente} l="Codes non activés" />
      </div>
    </>
  );
}
