import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { msgErreur } from '../../lib/erreurs';
import { Alerte, Badge, Btn, Chargement, EnTete, Vide, useAction, useRetours } from '../../components/ui';

const ROLES: Record<string, [string, 'ocre' | 'ok' | undefined]> = { super_admin: ['Super Admin', 'ocre'], proprietaire: ['Propriétaire', 'ok'], employe: ['Employé', undefined] };

export default function AdminUtilisateurs() {
  const { session } = useAuth(); const qc = useQueryClient(); const { confirmer } = useRetours(); const { enCours, lancer } = useAction();
  const [terme, setTerme] = useState(''); const [role, setRole] = useState('');
  const q = useQuery({ queryKey: ['admin-utilisateurs'], queryFn: () => api<{ utilisateurs: any[] }>('/api/admin/utilisateurs') });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const liste = q.data!.utilisateurs.filter((u) => (!role || u.role === role) && (!terme || `${u.prenom} ${u.nom} ${u.email ?? ''} ${u.atelier ?? ''} ${u.identifiant ?? ''}`.toLowerCase().includes(terme.toLowerCase())));
  const basculer = async (u: any) => {
    const actif = u.statut !== 'actif';
    if (!(await confirmer(actif ? 'Réactiver cet utilisateur ?' : 'Désactiver cet utilisateur ? Il sera immédiatement déconnecté de l’accès aux données.', { danger: !actif }))) return;
    lancer(async () => { await api(`/api/admin/utilisateurs/${u.user_id}/statut`, { method: 'PATCH', body: { actif } }); qc.invalidateQueries({ queryKey: ['admin-utilisateurs'] }); }, actif ? 'Utilisateur réactivé.' : 'Utilisateur désactivé.', msgErreur);
  };
  return (
    <>
      <EnTete titre="Utilisateurs" />
      <div className="ligne" style={{ marginBottom: '1rem' }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Rechercher (nom, email, atelier…)" value={terme} onChange={(e) => setTerme(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={role} onChange={(e) => setRole(e.target.value)}><option value="">Tous les types</option>{Object.entries(ROLES).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <span className="muted petit">{liste.length} utilisateur(s)</span>
      </div>
      {!liste.length && <Vide titre="Aucun utilisateur" />}
      <div className="pile">{liste.map((u) => (
        <div key={u.user_id} className="carte ligne" style={{ opacity: u.statut === 'actif' ? 1 : .6 }}>
          <div><b>{u.prenom} {u.nom}</b> <Badge ton={ROLES[u.role][1]}>{ROLES[u.role][0]}</Badge>{u.statut !== 'actif' && <> <Badge ton="gris">Désactivé</Badge></>}
            <div className="muted petit">{u.email ?? u.identifiant ?? '—'}{u.atelier_id && <> · <Link to={`/admin/ateliers/${u.atelier_id}`}>{u.atelier}</Link></>}</div></div>
          <span className="espace" />
          {u.role !== 'super_admin' && u.user_id !== session?.user.id && <Btn petit variante={u.statut === 'actif' ? 'danger sec' : undefined} disabled={enCours} onClick={() => basculer(u)}>{u.statut === 'actif' ? 'Désactiver' : 'Réactiver'}</Btn>}
        </div>))}</div>
    </>
  );
}
