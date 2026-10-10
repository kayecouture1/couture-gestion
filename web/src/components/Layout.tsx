import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  Home, ClipboardList, Scissors, Users, CalendarDays, UserCog, ShieldCheck, Route, Shirt, Wallet,
  ScrollText, Settings, LogOut, Menu, Building2, KeyRound, Ruler, Hammer, BarChart3, Bell, UserRound, Search, Cog, WifiOff,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { peut } from '../lib/perms';
import { urlLogo } from './Photo';
import { Modale } from './ui';

interface Lien { to: string; label: string; icone: any; perm?: string[]; fin?: boolean }

const LIENS_ATELIER: Lien[] = [
  { to: '/app', label: 'Accueil', icone: Home, fin: true },
  { to: '/app/commandes', label: 'Commandes', icone: ClipboardList, perm: ['commandes.voir'] },
  { to: '/app/production', label: 'Mes tâches', icone: Scissors, perm: ['production.prendre'] },
  { to: '/app/clients', label: 'Clients', icone: Users, perm: ['clients.voir'] },
  { to: '/app/rendez-vous', label: 'Rendez-vous', icone: CalendarDays, perm: ['rendez_vous.voir'] },
  { to: '/app/essayages', label: 'Essayages', icone: Ruler, perm: ['essayages.voir'] },
  { to: '/app/retouches', label: 'Retouches', icone: Hammer, perm: ['retouches.voir'] },
  { to: '/app/employes', label: 'Employés', icone: UserCog, perm: ['employes.voir'] },
  { to: '/app/roles', label: 'Rôles et accès', icone: ShieldCheck, perm: ['roles.voir'] },
  { to: '/app/circuits', label: 'Circuits', icone: Route, perm: ['circuits.gerer'] },
  { to: '/app/modeles', label: 'Modèles', icone: Shirt, perm: ['modeles.gerer'] },
  { to: '/app/depenses', label: 'Dépenses', icone: Wallet, perm: ['depenses.voir'] },
  { to: '/app/statistiques', label: 'Statistiques', icone: BarChart3, perm: ['statistiques.voir'] },
  { to: '/app/notifications', label: 'Notifications', icone: Bell, perm: ['commandes.voir', 'habits.voir'] },
  { to: '/app/journal', label: 'Journal', icone: ScrollText, perm: ['audit.voir'] },
  { to: '/app/parametres', label: 'Paramètres', icone: Settings, perm: ['parametres.modifier'] },
];

const LIENS_ADMIN: Lien[] = [
  { to: '/admin', label: 'Tableau de bord', icone: Home, fin: true },
  { to: '/admin/ateliers', label: 'Ateliers', icone: Building2 },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icone: Users },
  { to: '/admin/parametres', label: 'Paramètres globaux', icone: Cog },
  { to: '/admin/profil', label: 'Mon profil', icone: UserRound },
  { to: '/changer-mot-de-passe', label: 'Mon mot de passe', icone: KeyRound },
];

function BandeauReseau() {
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setEnLigne(true), b = () => setEnLigne(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  if (enLigne) return null;
  return <div className="alerte-bloc avert" role="status" style={{ margin: 0, borderRadius: 0, display: 'flex', gap: '.5rem', alignItems: 'center' }}><WifiOff size={16} />Vous êtes hors connexion. Les modifications ne sont pas enregistrées tant que le réseau n'est pas revenu.</div>;
}

export function Layout({ admin }: { admin?: boolean }) {
  const { ctx, deconnexion } = useAuth();
  const nav = useNavigate();
  const [plus, setPlus] = useState(false);
  const [recherche, setRecherche] = useState('');
  const tous = admin ? LIENS_ADMIN : LIENS_ATELIER;
  const liens = tous.filter((l) => !l.perm || peut(ctx, ...l.perm));
  const principaux = liens.slice(0, 4);
  const logo = urlLogo(ctx?.atelier?.logo_path);
  const nom = admin ? 'Administration' : ctx?.atelier?.nom ?? 'COUTURE GESTION';
  const notifications = useQuery({
    queryKey: ['notifications-taches-non-lues'],
    enabled: !admin && !!ctx && peut(ctx, 'production.prendre'),
    refetchInterval: 20_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('notifications_taches')
        .select('id', { count: 'exact', head: true })
        .is('lu_at', null).is('ignoree_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const nbNotifications = notifications.data ?? 0;

  const Nav = ({ l, onClick }: { l: Lien; onClick?: () => void }) => (
    <NavLink to={l.to} end={l.fin} onClick={onClick} className={({ isActive }) => `lien-nav ${isActive ? 'actif' : ''}`}>
      <l.icone size={18} />{l.label}
    </NavLink>
  );

  return (
    <div className="app">
      <aside className="lateral" aria-label="Navigation principale">
        <div className="marque">
          {logo ? <img src={logo} alt="" /> : <span className="logo"><Scissors size={18} /></span>}
          <span>{nom}</span>
        </div>
        {liens.map((l) => <Nav key={l.to} l={l} />)}
        <span className="espace" />
        <button className="lien-nav" style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }} onClick={deconnexion}>
          <LogOut size={18} />Se déconnecter
        </button>
      </aside>

      <div className="principal">
        <header className="haut">
          <span className="titre-atelier">{nom}</span><span className="espace" />
          {!admin && (
            <form onSubmit={(e) => { e.preventDefault(); if (recherche.trim().length >= 2) nav(`/app/recherche?q=${encodeURIComponent(recherche.trim())}`); }} role="search" style={{ display: 'flex', maxWidth: 220 }}>
              <input className="input" style={{ minHeight: 36, padding: '.3rem .6rem' }} placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Recherche globale" />
              <button className="btn sec petit" type="submit" aria-label="Lancer la recherche" style={{ marginLeft: 4 }}><Search size={15} /></button>
            </form>
          )}
          {!admin && ctx?.identifiant && <span className="muted petit">{ctx.identifiant}</span>}
          {!admin && peut(ctx, 'production.prendre') && <Link to="/app/notifications" className="btn sec petit" aria-label={`Notifications${nbNotifications ? ` (${nbNotifications})` : ''}`} style={{ position: 'relative' }}>
            <Bell size={15} />
            {nbNotifications > 0 && <span aria-label={`${nbNotifications} notification(s) non lue(s)`} style={{ position: 'absolute', top: -7, right: -7, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--alerte)', color: '#fff', fontSize: 11, lineHeight: '18px', textAlign: 'center', fontWeight: 700 }}>{nbNotifications > 99 ? '99+' : nbNotifications}</span>}
          </Link>}
          <Link to={admin ? '/admin/profil' : '/app/profil'} className="btn sec petit" aria-label="Mon profil"><UserRound size={15} /></Link>
          <Link to="/changer-mot-de-passe" className="btn sec petit" aria-label="Mot de passe"><KeyRound size={15} /></Link>
          <button className="btn sec petit" onClick={deconnexion} aria-label="Se déconnecter"><LogOut size={15} /></button>
        </header>
        <BandeauReseau />
        <main className="contenu"><Outlet /></main>
      </div>

      <nav className="bas" aria-label="Navigation mobile">
        {principaux.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.fin} className={({ isActive }) => (isActive ? 'actif' : '')}>
            <l.icone size={20} />{l.label.split(' ')[0]}
          </NavLink>
        ))}
        {liens.length > 4 && <button onClick={() => setPlus(true)}><Menu size={20} />Plus</button>}
      </nav>
      <Modale ouverte={plus} titre="Menu" onFermer={() => setPlus(false)}>
        <div className="pile" style={{ gap: '.2rem' }}>
          {liens.slice(4).map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setPlus(false)} className="lien-nav" style={{ color: 'var(--encre)' }}>
              <l.icone size={18} />{l.label}
            </NavLink>
          ))}
        </div>
      </Modale>
    </div>
  );
}
