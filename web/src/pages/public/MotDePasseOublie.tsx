import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { emailValide } from '../../lib/validation';
import { Alerte, Btn, Champ } from '../../components/ui';

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [chargement, setChargement] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault(); setErreur(null);
    if (!emailValide(email)) return setErreur('Adresse email invalide.');
    setChargement(true);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reinitialiser` });
    setChargement(false);
    setEnvoye(true); // même réponse que l'adresse existe ou non : on ne révèle rien
  }
  return (
    <div className="public"><div className="public-haut"><Link to="/connexion" className="btn sec petit">← Connexion</Link></div>
      <div className="public-corps">
        <h1 style={{ marginBottom: '1rem' }}>Mot de passe oublié</h1>
        {envoye ? <Alerte ton="ok">Si cette adresse correspond à un compte, un lien de réinitialisation vient d'être envoyé. Il est temporaire : utilisez-le rapidement.</Alerte> : (
          <form onSubmit={soumettre} noValidate>
            {erreur && <Alerte ton="err">{erreur}</Alerte>}
            <Champ label="Email du compte"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Champ>
            <Btn type="submit" bloc chargement={chargement}>Envoyer le lien</Btn>
          </form>
        )}
      </div>
    </div>
  );
}
