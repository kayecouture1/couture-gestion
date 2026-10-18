import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { dateFr } from '../../lib/format';
import { useQuery } from '@tanstack/react-query';
import { Alerte, Btn, Champ } from '../../components/ui';

export default function Abonnement() {
  const { ctx, rafraichir, deconnexion } = useAuth();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [attente, setAttente] = useState(false);
  const config = useQuery({ queryKey: ['public-config'], queryFn: () => api<{ contact_support: string }>('/api/public/config', { auth: false }) });

  if (ctx?.type === 'super_admin') return <Navigate to="/admin" replace />;
  if (ctx?.abonnement?.actif && !succes) return <Navigate to="/app" replace />;
  const proprio = !!ctx?.est_proprietaire;
  const statut = ctx?.abonnement?.statut;

  async function activer(e: FormEvent) {
    e.preventDefault(); setErreur(null);
    if (code.trim().length < 8) return setErreur('Saisissez le code de confirmation reçu.');
    setAttente(true);
    try {
      const r = await api<{ message: string }>('/api/abonnement/activer', { body: { code } });
      setSucces(r.message + ' Code accepté.'); await rafraichir();
    } catch (err) { setErreur(msgErreur(err)); }
    finally { setAttente(false); }
  }

  return (
    <div className="public"><div className="public-haut" />
      <div className="public-corps">
        <h1 style={{ marginBottom: '1rem' }}>{ctx?.atelier?.nom}</h1>
        {statut === 'expire' && <Alerte ton="avert">L'abonnement de votre atelier a expiré le {dateFr(ctx?.abonnement?.fin_at)}. Contactez l'administrateur pour le renouveler.</Alerte>}
        {statut === 'desactive' && <Alerte ton="avert">L'abonnement de votre atelier est désactivé. Contactez l'administrateur.</Alerte>}
        {(statut === 'aucun' || statut === 'en_attente') && <Alerte ton="info">Votre atelier a été créé. Pour accéder à l'application, veuillez saisir votre code de confirmation.</Alerte>}
        {succes ? (<><Alerte ton="ok">{succes} Votre abonnement est maintenant actif.</Alerte><a className="btn" href="/app">Ouvrir l'application</a></>)
        : proprio ? (
          <form onSubmit={activer} noValidate>
            {erreur && <Alerte ton="err">{erreur}</Alerte>}
            <Champ label="Code de confirmation" aide="Remis par l'administrateur après votre paiement. Exemple : CG-ABCD-EFGH-JKLM">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" /></Champ>
            <Btn type="submit" bloc chargement={attente}>Saisir le code</Btn>
          </form>
        ) : <Alerte ton="info">L'accès est bloqué tant que le propriétaire n'a pas activé l'abonnement.</Alerte>}
        {config.data?.contact_support && <p className="muted" style={{ marginTop: '1rem' }}>Contact de l'administrateur : <b>{config.data.contact_support}</b></p>}
        <p style={{ marginTop: '1rem' }}><a href="/aide">Comment ça marche ?</a></p>
        <p style={{ marginTop: '1.2rem' }}><Btn variante="sec" onClick={deconnexion}>Se déconnecter</Btn></p>
      </div>
    </div>
  );
}
