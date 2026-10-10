import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { verifierMotDePasse } from '../../lib/validation';
import { Alerte, Btn, Champ, useRetours } from '../../components/ui';

export default function ChangerMdp() {
  const { ctx, session, rafraichir, deconnexion } = useAuth();
  const nav = useNavigate(); const { ok } = useRetours();
  const [mdp, setMdp] = useState(''); const [conf, setConf] = useState('');
  const [erreur, setErreur] = useState<string | null>(null); const [attente, setAttente] = useState(false);
  const force = !!ctx?.doit_changer_mdp;

  async function soumettre(e: FormEvent) {
    e.preventDefault(); setErreur(null);
    const m = verifierMotDePasse(mdp); if (m) return setErreur(m);
    if (mdp !== conf) return setErreur('Les mots de passe ne correspondent pas.');
    setAttente(true);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    if (error) { setAttente(false); return setErreur(/same|different/i.test(error.message) ? 'Choisissez un mot de passe différent du mot de passe actuel.' : 'Impossible de modifier le mot de passe.'); }
    await supabase.from('profils').update({ doit_changer_mdp: false }).eq('id', session!.user.id);
    await rafraichir(); setAttente(false); ok('Mot de passe modifié.');
    nav(ctx?.type === 'super_admin' ? '/admin' : '/app', { replace: true });
  }
  return (
    <div className="public"><div className="public-haut" />
      <div className="public-corps">
        <h1 style={{ marginBottom: '1rem' }}>{force ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}</h1>
        {force && <Alerte ton="info">C'est votre première connexion : remplacez le mot de passe temporaire par un mot de passe personnel.</Alerte>}
        <form onSubmit={soumettre} noValidate>
          {erreur && <Alerte ton="err">{erreur}</Alerte>}
          <Champ label="Nouveau mot de passe" aide="8 caractères minimum, avec une lettre et un chiffre."><input className="input" type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} /></Champ>
          <Champ label="Confirmer"><input className="input" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} /></Champ>
          <div className="ligne"><Btn type="submit" chargement={attente}>Enregistrer</Btn>
            {force ? <Btn type="button" variante="sec" onClick={deconnexion}>Se déconnecter</Btn> : <Btn type="button" variante="sec" onClick={() => nav(-1)}>Annuler</Btn>}</div>
        </form>
      </div>
    </div>
  );
}
