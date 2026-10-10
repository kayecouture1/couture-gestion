import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { verifierMotDePasse } from '../../lib/validation';
import { Alerte, Btn, Champ, Chargement } from '../../components/ui';

export default function ReinitialiserMdp() {
  const { session, chargement, recuperation } = useAuth();
  const nav = useNavigate();
  const [mdp, setMdp] = useState(''); const [conf, setConf] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false); const [attente, setAttente] = useState(false);

  if (chargement) return <Chargement />;
  async function soumettre(e: FormEvent) {
    e.preventDefault(); setErreur(null);
    const m = verifierMotDePasse(mdp); if (m) return setErreur(m);
    if (mdp !== conf) return setErreur('Les mots de passe ne correspondent pas.');
    setAttente(true);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    setAttente(false);
    if (error) return setErreur(/same|different/i.test(error.message) ? 'Choisissez un mot de passe différent de l’ancien.' : 'Impossible de modifier le mot de passe. Le lien a peut-être expiré.');
    setOk(true); await supabase.auth.signOut();
    setTimeout(() => nav('/connexion'), 2500);
  }
  return (
    <div className="public"><div className="public-haut" />
      <div className="public-corps">
        <h1 style={{ marginBottom: '1rem' }}>Nouveau mot de passe</h1>
        {ok ? <Alerte ton="ok">Mot de passe modifié. Vous allez être redirigé vers la connexion…</Alerte>
        : !session || !recuperation ? <><Alerte ton="err">Ce lien est invalide ou a expiré.</Alerte><Link className="btn" to="/mot-de-passe-oublie">Demander un nouveau lien</Link></>
        : (
          <form onSubmit={soumettre} noValidate>
            {erreur && <Alerte ton="err">{erreur}</Alerte>}
            <Champ label="Nouveau mot de passe" aide="8 caractères minimum, avec une lettre et un chiffre."><input className="input" type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} /></Champ>
            <Champ label="Confirmer"><input className="input" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} /></Champ>
            <Btn type="submit" bloc chargement={attente}>Enregistrer</Btn>
          </form>)}
      </div>
    </div>
  );
}
