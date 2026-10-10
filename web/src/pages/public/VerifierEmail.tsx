import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Alerte, Btn } from '../../components/ui';

export default function VerifierEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const [etat, setEtat] = useState<'idle' | 'envoi' | 'ok' | 'err'>('idle');

  async function renvoyer() {
    setEtat('envoi');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setEtat(error ? 'err' : 'ok');
  }
  return (
    <div className="public"><div className="public-haut" />
      <div className="public-corps">
        <h1 style={{ marginBottom: '1rem' }}>Vérifiez votre email</h1>
        <Alerte ton="ok">Un email de vérification vient de vous être envoyé{email && <> à <b>{email}</b></>}. Cliquez sur le lien qu'il contient pour confirmer votre adresse, puis connectez-vous.</Alerte>
        <p className="muted">Vous ne le voyez pas ? Regardez dans les courriers indésirables. Le lien expire après un certain temps : vous pouvez en demander un nouveau.</p>
        {etat === 'ok' && <Alerte ton="ok">Nouvel email envoyé.</Alerte>}
        {etat === 'err' && <Alerte ton="err">Impossible de renvoyer l'email pour le moment. Réessayez dans quelques minutes.</Alerte>}
        <div className="ligne">
          {email && <Btn variante="sec" chargement={etat === 'envoi'} onClick={renvoyer}>Renvoyer l'email</Btn>}
          <Link className="btn" to="/connexion">Aller à la connexion</Link>
        </div>
      </div>
    </div>
  );
}
