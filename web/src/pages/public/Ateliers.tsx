import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Scissors } from 'lucide-react';
import { api } from '../../lib/api';
import { msgErreur } from '../../lib/erreurs';
import { Alerte, Chargement, Vide } from '../../components/ui';

export default function Ateliers() {
  const q = useQuery({ queryKey: ['public-ateliers'], queryFn: () => api<{ ateliers: any[] }>('/api/public/ateliers', { auth: false }) });
  return (
    <div className="public">
      <div className="public-haut"><Link to="/" className="btn sec petit">← Accueil</Link></div>
      <div className="public-corps large">
        <h1>Voir les ateliers</h1>
        <p className="muted">Choisissez votre atelier pour suivre l'avancement de votre habit. Aucun compte n'est nécessaire.</p>
        {q.isLoading && <Chargement />}
        {q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
        {q.data && !q.data.ateliers.length && <Vide titre="Aucun atelier à afficher" texte="Les ateliers apparaissent ici lorsque leur propriétaire a activé la visibilité publique." />}
        <div className="grille">
          {q.data?.ateliers.map((a) => (
            <Link key={a.id} to={`/ateliers/${a.id}/suivi`} className="carte cliquable ligne">
              {a.logo_url ? <img className="vignette" src={a.logo_url} alt="" /> : <span className="vignette photo-vide"><Scissors size={20} /></span>}
              <b>{a.nom}</b>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
