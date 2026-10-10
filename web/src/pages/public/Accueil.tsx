import { Link } from 'react-router-dom';
import { Scissors } from 'lucide-react';

export default function Accueil() {
  return (
    <div className="accueil">
      <div className="centre">
        <Scissors size={34} color="var(--ocre)" aria-hidden />
        <h1>COUTURE GESTION</h1>
        <div className="fil-deco" />
        <p style={{ fontSize: '1.1rem', maxWidth: '38ch' }}>
          Suivez chaque habit de la coupe au repassage : clients, mesures, commandes, employés, paiements et factures, au même endroit.
        </p>
        <div className="pile" style={{ marginTop: '.5rem' }}>
          <Link className="btn ocre" to="/connexion">Se connecter</Link>
          <Link className="btn sec" to="/inscription">Créer un atelier</Link>
          <Link className="btn sec" to="/ateliers">Voir les ateliers et suivre mon habit</Link>
        </div>
      </div>
    </div>
  );
}
