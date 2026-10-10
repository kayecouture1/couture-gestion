import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alerte, Btn, Chargement } from './ui';

// Ces gardes servent à l'affichage et à la navigation. La sécurité réelle est appliquée par la base de données et l'API.
export function GardeConnecte() {
  const { session, ctx, chargement, deconnexion } = useAuth();
  const loc = useLocation();
  if (chargement || (session && !ctx)) return <Chargement />;
  if (!session) return <Navigate to="/connexion" replace state={{ depuis: loc.pathname }} />;
  if (ctx!.type === 'sans_atelier' || ctx!.type === 'anonyme') {
    return <div className="public-corps"><Alerte ton="err">Aucun atelier n'est associé à ce compte.</Alerte><Btn onClick={deconnexion}>Se déconnecter</Btn></div>;
  }
  if (ctx!.type === 'membre' && ctx!.statut_membre !== 'actif') {
    return <div className="public-corps"><Alerte ton="err">Ce compte a été désactivé. Contactez le propriétaire de l'atelier.</Alerte><Btn onClick={deconnexion}>Se déconnecter</Btn></div>;
  }
  if (ctx!.doit_changer_mdp && loc.pathname !== '/changer-mot-de-passe') return <Navigate to="/changer-mot-de-passe" replace />;
  return <Outlet />;
}

export function GardeAtelier() {
  const { ctx } = useAuth();
  if (ctx?.type === 'super_admin') return <Navigate to="/admin" replace />;
  if (ctx?.type !== 'membre') return <Navigate to="/connexion" replace />;
  if (!ctx.abonnement?.actif) return <Navigate to="/abonnement" replace />;
  return <Outlet />;
}

export function GardeAdmin() {
  const { ctx } = useAuth();
  if (ctx?.type !== 'super_admin') return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function GardePermission({ codes, children }: { codes: string[]; children: JSX.Element }) {
  const { ctx } = useAuth();
  if (!codes.some((c) => ctx?.permissions?.includes(c))) {
    return <Alerte ton="avert">Vous n'avez pas accès à cette page. Demandez l'autorisation au propriétaire de l'atelier.</Alerte>;
  }
  return children;
}
