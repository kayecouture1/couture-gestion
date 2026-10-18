import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GardeAdmin, GardeAtelier, GardeConnecte, GardePermission } from './components/Guards';
import Accueil from './pages/public/Accueil';
import Connexion from './pages/public/Connexion';
import Inscription from './pages/public/Inscription';
import VerifierEmail from './pages/public/VerifierEmail';
import MotDePasseOublie from './pages/public/MotDePasseOublie';
import ReinitialiserMdp from './pages/public/ReinitialiserMdp';
import Ateliers from './pages/public/Ateliers';
import Suivi from './pages/public/Suivi';
import ChangerMdp from './pages/public/ChangerMdp';
import Aide from './pages/public/Aide';
const Abonnement = lazy(() => import('./pages/gate/Abonnement'));
const AdminAccueil = lazy(() => import('./pages/admin/AdminAccueil'));
const AdminAteliers = lazy(() => import('./pages/admin/AdminAteliers'));
const AdminAtelier = lazy(() => import('./pages/admin/AdminAtelier'));
const Dashboard = lazy(() => import('./pages/atelier/Dashboard'));
const Clients = lazy(() => import('./pages/atelier/Clients'));
const ClientDetail = lazy(() => import('./pages/atelier/ClientDetail'));
const Commandes = lazy(() => import('./pages/atelier/Commandes'));
const NouvelleCommande = lazy(() => import('./pages/atelier/NouvelleCommande'));
const CommandeDetail = lazy(() => import('./pages/atelier/CommandeDetail'));
const HabitDetail = lazy(() => import('./pages/atelier/HabitDetail'));
const Production = lazy(() => import('./pages/atelier/Production'));
const Employes = lazy(() => import('./pages/atelier/Employes'));
const Roles = lazy(() => import('./pages/atelier/Roles'));
const Circuits = lazy(() => import('./pages/atelier/Circuits'));
const Modeles = lazy(() => import('./pages/atelier/Modeles'));
const Depenses = lazy(() => import('./pages/atelier/Depenses'));
const RendezVous = lazy(() => import('./pages/atelier/RendezVous'));
const Parametres = lazy(() => import('./pages/atelier/Parametres'));
const Journal = lazy(() => import('./pages/atelier/Journal'));
const Essayages = lazy(() => import('./pages/atelier/Essayages'));
const Retouches = lazy(() => import('./pages/atelier/Retouches'));
const Statistiques = lazy(() => import('./pages/atelier/Statistiques'));
const Notifications = lazy(() => import('./pages/atelier/Notifications'));
const Recherche = lazy(() => import('./pages/atelier/Recherche'));
const Profil = lazy(() => import('./pages/atelier/Profil'));
const AdminUtilisateurs = lazy(() => import('./pages/admin/AdminUtilisateurs'));
const AdminParametres = lazy(() => import('./pages/admin/AdminParametres'));

const P = ({ codes, children }: { codes: string[]; children: JSX.Element }) => <GardePermission codes={codes}>{children}</GardePermission>;

export default function App() {
  return (
    <Suspense fallback={<div className="chargement">Chargement...</div>}>
      <Routes>
      {/* Espace public */}
      <Route path="/" element={<Accueil />} />
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/inscription" element={<Inscription />} />
      <Route path="/verification" element={<VerifierEmail />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/reinitialiser" element={<ReinitialiserMdp />} />
      <Route path="/ateliers" element={<Ateliers />} />
      <Route path="/ateliers/:id/suivi" element={<Suivi />} />
      <Route path="/aide" element={<Aide />} />

      {/* Connecté */}
      <Route element={<GardeConnecte />}>
        <Route path="/changer-mot-de-passe" element={<ChangerMdp />} />
        <Route path="/abonnement" element={<Abonnement />} />

        <Route element={<GardeAdmin />}>
          <Route element={<Layout admin />}>
            <Route path="/admin" element={<AdminAccueil />} />
            <Route path="/admin/ateliers" element={<AdminAteliers />} />
            <Route path="/admin/ateliers/:id" element={<AdminAtelier />} />
            <Route path="/admin/utilisateurs" element={<AdminUtilisateurs />} />
            <Route path="/admin/parametres" element={<AdminParametres />} />
            <Route path="/admin/profil" element={<Profil />} />
          </Route>
        </Route>

        <Route element={<GardeAtelier />}>
          <Route element={<Layout />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/clients" element={<P codes={['clients.voir']}><Clients /></P>} />
            <Route path="/app/clients/:id" element={<P codes={['clients.voir']}><ClientDetail /></P>} />
            <Route path="/app/commandes" element={<P codes={['commandes.voir']}><Commandes /></P>} />
            <Route path="/app/commandes/nouvelle" element={<P codes={['commandes.creer']}><NouvelleCommande /></P>} />
            <Route path="/app/commandes/:id" element={<P codes={['commandes.voir']}><CommandeDetail /></P>} />
            <Route path="/app/habits/:id" element={<P codes={['habits.voir', 'production.prendre', 'commandes.voir']}><HabitDetail /></P>} />
            <Route path="/app/production" element={<P codes={['production.prendre']}><Production /></P>} />
            <Route path="/app/employes" element={<P codes={['employes.voir']}><Employes /></P>} />
            <Route path="/app/roles" element={<P codes={['roles.voir']}><Roles /></P>} />
            <Route path="/app/circuits" element={<P codes={['circuits.gerer']}><Circuits /></P>} />
            <Route path="/app/modeles" element={<P codes={['modeles.gerer']}><Modeles /></P>} />
            <Route path="/app/depenses" element={<P codes={['depenses.voir']}><Depenses /></P>} />
            <Route path="/app/rendez-vous" element={<P codes={['rendez_vous.voir']}><RendezVous /></P>} />
            <Route path="/app/parametres" element={<P codes={['parametres.modifier']}><Parametres /></P>} />
            <Route path="/app/journal" element={<P codes={['audit.voir']}><Journal /></P>} />
            <Route path="/app/essayages" element={<P codes={['essayages.voir']}><Essayages /></P>} />
            <Route path="/app/retouches" element={<P codes={['retouches.voir']}><Retouches /></P>} />
            <Route path="/app/statistiques" element={<P codes={['statistiques.voir']}><Statistiques /></P>} />
            <Route path="/app/notifications" element={<P codes={['commandes.voir', 'habits.voir']}><Notifications /></P>} />
            <Route path="/app/recherche" element={<Recherche />} />
            <Route path="/app/profil" element={<Profil />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
