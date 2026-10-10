import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { Alerte, Btn, Champ, Chargement, EnTete, useAction } from '../../components/ui';

export default function AdminParametres() {
  const { enCours, lancer } = useAction();
  const [f, setF] = useState<{ duree: string; fenetre: string; contact: string } | null>(null);
  const q = useQuery({ queryKey: ['admin-parametres'], queryFn: async () => {
    const p = await api<any>('/api/admin/parametres');
    setF({ duree: String(p.duree_abonnement_defaut_jours ?? 30), fenetre: String(p.fenetre_activation_defaut_jours ?? 30), contact: p.contact_support ?? '' }); return p; } });
  if (q.isLoading || !f) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const enregistrer = () => lancer(async () => {
    const d = Number(f.duree), w = Number(f.fenetre);
    if (!Number.isInteger(d) || d < 1 || d > 3660) throw new Error('Durée par défaut : entre 1 et 3660 jours.');
    if (!Number.isInteger(w) || w < 1 || w > 365) throw new Error("Validité du code : entre 1 et 365 jours.");
    await api('/api/admin/parametres', { method: 'PUT', body: { duree_abonnement_defaut_jours: d, fenetre_activation_defaut_jours: w, contact_support: f.contact.trim() } });
  }, 'Paramètres enregistrés.', (e) => /entre/.test((e as any)?.message ?? '') ? (e as any).message : msgErreur(e));
  return (
    <>
      <EnTete titre="Paramètres globaux" />
      <div className="carte" style={{ maxWidth: 560 }}>
        <div className="grille2">
          <Champ label="Durée d'abonnement par défaut (jours)"><input className="input" inputMode="numeric" value={f.duree} onChange={(e) => setF({ ...f, duree: e.target.value })} /></Champ>
          <Champ label="Validité d'un code (jours)" aide="Délai pour l'activer"><input className="input" inputMode="numeric" value={f.fenetre} onChange={(e) => setF({ ...f, fenetre: e.target.value })} /></Champ>
        </div>
        <Champ label="Contact affiché aux ateliers (téléphone ou WhatsApp)" aide="Visible sur l'écran « saisir le code » et pour les abonnements expirés."><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} maxLength={200} /></Champ>
        <Btn chargement={enCours} onClick={enregistrer}>Enregistrer</Btn>
      </div>
    </>
  );
}
