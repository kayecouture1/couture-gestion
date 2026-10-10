import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { msgErreur } from '../../lib/erreurs';
import { dateHeure } from '../../lib/format';
import { useMembres } from '../../lib/hooks';
import { Alerte, Chargement, EnTete, Vide } from '../../components/ui';

const LIBELLES: Record<string, string> = {
  'commande.creee': 'Commande créée', 'commande.annulee': 'Commande annulée', 'paiement.enregistre': 'Paiement enregistré', 'paiement.annule': 'Paiement annulé',
  'facture.generee': 'Facture générée', 'production.etape_prise': 'Étape prise', 'production.etape_terminee': 'Étape terminée', 'habit.confirme_termine': 'Habit confirmé terminé',
  'employe.cree': 'Employé créé', 'employe.modifie': 'Employé modifié', 'employe.desactive': 'Employé désactivé', 'employe.reactive': 'Employé réactivé', 'employe.mdp_reinitialise': 'Mot de passe réinitialisé',
  'membre_roles_production.insert': 'Rôle attribué', 'membre_roles_production.delete': 'Rôle retiré', 'membre_profils_acces.insert': "Profil d'accès attribué", 'membre_profils_acces.delete': "Profil d'accès retiré",
  'profil_acces_permissions.insert': 'Permission ajoutée', 'profil_acces_permissions.delete': 'Permission retirée', 'roles_production.insert': 'Rôle créé', 'roles_production.update': 'Rôle modifié',
  'profils_acces.insert': "Profil d'accès créé", 'profils_acces.update': "Profil d'accès modifié", 'atelier.initialise': 'Atelier initialisé',
};

export default function Journal() {
  const membres = useMembres();
  const q = useQuery({ queryKey: ['journal'], queryFn: async () => { const { data, error } = await supabase.from('journal_audit').select('*').order('created_at', { ascending: false }).limit(200); if (error) throw error; return data as any[]; } });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const nom = (id?: string) => { const m = membres.data?.find((x) => x.user_id === id); return m ? `${m.prenom} ${m.nom}` : id ? '—' : 'Système'; };
  return (
    <>
      <EnTete titre="Journal d'audit" />
      <p className="muted petit">Les 200 dernières actions importantes. Ce journal ne peut être ni modifié ni supprimé depuis l'application.</p>
      {!q.data?.length && <Vide titre="Aucun événement" />}
      <div className="carte" style={{ overflowX: 'auto' }}><table className="tableau"><thead><tr><th>Date</th><th>Qui</th><th>Action</th><th>Détail</th></tr></thead><tbody>
        {q.data?.map((e) => <tr key={e.id}><td>{dateHeure(e.created_at)}</td><td>{nom(e.acteur_id)}</td><td>{LIBELLES[e.action] ?? e.action}</td>
          <td className="muted petit">{e.details?.etape ?? e.details?.permission_code ?? e.details?.numero ?? e.details?.montant ?? e.details?.nom ?? ''}</td></tr>)}</tbody></table></div>
    </>
  );
}
