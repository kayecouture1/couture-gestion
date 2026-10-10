import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, DOMAINE_EMPLOYES } from '../../lib/supabase';
import { Alerte, Btn, Champ } from '../../components/ui';
import { emailValide } from '../../lib/validation';

function traduire(msg: string) {
  if (/not confirmed/i.test(msg)) return { texte: "Votre adresse email n'a pas encore été vérifiée. Ouvrez le lien reçu par email.", verif: true };
  if (/banned|disabled/i.test(msg)) return { texte: "Ce compte est désactivé. Contactez le propriétaire de l'atelier." };
  if (/invalid login|credentials/i.test(msg)) return { texte: 'Identifiants incorrects. Vérifiez vos informations.' };
  if (/fetch|network/i.test(msg)) return { texte: 'Problème de connexion réseau. Vérifiez votre connexion puis réessayez.' };
  if (/rate|too many/i.test(msg)) return { texte: 'Trop de tentatives. Patientez quelques minutes.' };
  return { texte: 'Connexion impossible. Veuillez réessayer.' };
}

export default function Connexion() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'email' | 'employe'>('email');
  const [email, setEmail] = useState('');
  const [codeAtelier, setCodeAtelier] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState<{ texte: string; verif?: boolean } | null>(null);
  const [chargement, setChargement] = useState(false);
  const [renvoye, setRenvoye] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    let adresse = email.trim().toLowerCase();
    if (mode === 'email') {
      if (!emailValide(adresse)) return setErreur({ texte: 'Adresse email invalide.' });
    } else {
      if (!codeAtelier.trim() || !identifiant.trim()) return setErreur({ texte: "Saisissez le code de l'atelier et votre identifiant." });
      adresse = `${codeAtelier.trim()}.${identifiant.trim()}`.toLowerCase() + `@${DOMAINE_EMPLOYES}`;
    }
    if (!mdp) return setErreur({ texte: 'Saisissez votre mot de passe.' });
    setChargement(true);
    const { error } = await supabase.auth.signInWithPassword({ email: adresse, password: mdp });
    setChargement(false);
    if (error) return setErreur(traduire(error.message));
    nav('/app', { replace: true }); // les gardes redirigent ensuite selon le type de compte et l'abonnement
  }

  async function renvoyer() {
    await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    setRenvoye(true);
  }

  return (
    <div className="public">
      <div className="public-haut"><Link to="/" className="btn sec petit">← Accueil</Link></div>
      <div className="public-corps">
        <h1 style={{ marginBottom: '1rem' }}>Connexion</h1>
        {params.get('verifie') && <Alerte ton="ok">Adresse email confirmée. Vous pouvez vous connecter.</Alerte>}
        <div className="onglets" role="tablist">
          <button type="button" className={mode === 'email' ? 'on' : ''} onClick={() => setMode('email')}>Propriétaire / Admin</button>
          <button type="button" className={mode === 'employe' ? 'on' : ''} onClick={() => setMode('employe')}>Employé</button>
        </div>
        <form onSubmit={soumettre} noValidate>
          {erreur && <Alerte ton="err">{erreur.texte}</Alerte>}
          {erreur?.verif && (renvoye ? <Alerte ton="ok">Un nouvel email de vérification vient d'être envoyé.</Alerte>
            : <Btn type="button" variante="sec" petit onClick={renvoyer} style={{ marginBottom: '.9rem' }}>Renvoyer l'email de vérification</Btn>)}
          {mode === 'email' ? (
            <Champ label="Email"><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Champ>
          ) : (
            <>
              <Champ label="Code de l'atelier" aide="Donné par le propriétaire de l'atelier."><input className="input" autoCapitalize="none" value={codeAtelier} onChange={(e) => setCodeAtelier(e.target.value)} /></Champ>
              <Champ label="Identifiant"><input className="input" autoCapitalize="characters" placeholder="EMP-001" autoComplete="username" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} /></Champ>
            </>
          )}
          <Champ label="Mot de passe"><input className="input" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} /></Champ>
          <Btn type="submit" bloc chargement={chargement}>Se connecter</Btn>
        </form>
        <p style={{ marginTop: '1rem' }}>
          {mode === 'email' && <><Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link><br /></>}
          <Link to="/inscription">Créer un atelier</Link>
        </p>
        {mode === 'employe' && <p className="muted petit">Mot de passe oublié ? Demandez au propriétaire de le réinitialiser.</p>}
      </div>
    </div>
  );
}
