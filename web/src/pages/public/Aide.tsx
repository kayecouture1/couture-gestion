import { CircleHelp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const rubriques = [
  ['Créer son atelier et activer l’abonnement', 'Créez votre atelier, confirmez votre email, puis activez votre accès avec le code d’abonnement.'],
  ['Clients et mesures', 'Enregistrez vos clients et leurs mesures pour les retrouver automatiquement lors des prochaines commandes.'],
  ['Commandes et habits', 'Une commande peut contenir plusieurs habits, avec une photo, un modèle et une date de rendez-vous proposée.'],
  ['Circuit de fabrication', 'Choisissez les étapes de chaque habit, comme la coupe, la broderie, le montage, la finition ou le repassage.'],
  ['Prendre et terminer une étape', 'L’employé prend un habit, puis le marque terminé ; l’heure et la durée de l’étape sont enregistrées.'],
  ['Employés, rôles et droits', 'Le propriétaire choisit les rôles et les droits de chaque employé, y compris pour les connexions par identifiant.'],
  ['Validation, emplacement et prévenir le client', 'Une fois terminé, l’habit est confirmé, placé à l’emplacement choisi et le client peut être prévenu.'],
  ['Paiements, factures et statistiques', 'Enregistrez les paiements, calculez le reste à payer, générez une facture PDF et suivez dépenses et statistiques.'],
  ['Suivi client sans compte', 'Le client suit la photo, l’étape en cours et le message indiquant que l’habit est prêt, sans créer de compte.'],
  ['Sécurité des données', 'Les données de chaque atelier sont isolées et protégées : chaque atelier ne voit que ses propres données.'],
];

export default function Aide() {
  const { session, ctx } = useAuth();
  const retour = session ? (ctx?.type === 'super_admin' ? '/admin' : '/app') : null;

  return (
    <div className="public">
      <div className="public-haut">
        {retour ? <Link to={retour} className="btn sec petit">← Retour à l’application</Link> : <Link to="/" className="btn sec petit">← Retour à l’accueil</Link>}
      </div>
      <main className="public-corps large aide-corps">
        <div className="ligne" style={{ marginBottom: '1rem' }}>
          <CircleHelp size={28} color="var(--ocre)" aria-hidden />
          <h1>Aide — Découvrir Couture Gestion</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.8rem' }}>
          <div className="aide-film">
            <iframe
              src="/aide/film.html"
              title="Film de présentation de Couture Gestion"
              allow="fullscreen; autoplay"
              loading="lazy"
              style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
            />
          </div>
          <a className="btn sec" href="/aide/film.html" target="_blank" rel="noopener">
            <ExternalLink size={17} aria-hidden /> Ouvrir le film en plein écran
          </a>
          <p className="muted petit">Pour entendre la voix, touchez le film puis « Lancer le film ».</p>
        </div>

        <section aria-labelledby="rubriques-aide" style={{ marginTop: '2rem' }}>
          <h2 id="rubriques-aide">Les principales fonctions</h2>
          <div className="pile" style={{ marginTop: '.8rem' }}>
            {rubriques.map(([titre, texte]) => (
              <article className="carte" key={titre}>
                <h3>{titre}</h3>
                <p style={{ marginTop: '.35rem', marginBottom: 0 }}>{texte}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
