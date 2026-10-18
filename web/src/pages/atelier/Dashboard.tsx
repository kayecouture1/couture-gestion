import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { aujourdhui, dateFr, debutMoisISO, fcfa } from '../../lib/format';
import { Alerte, Chargement, EnTete } from '../../components/ui';

const compter = async (table: string, f: (q: any) => any) => {
  const { count, error } = await f(supabase.from(table).select('id', { count: 'exact', head: true })); if (error) throw error; return count ?? 0;
};

export default function Dashboard() {
  const { ctx, session } = useAuth();
  const [aideVisible, setAideVisible] = useState(() => {
    try { return localStorage.getItem('cg_aide_masquee') !== '1'; }
    catch { return true; }
  });
  const moi = session!.user.id; const mesRoles = new Set((ctx?.roles ?? []).map((r) => r.id));
  const jours = Math.ceil((new Date(ctx?.abonnement?.fin_at ?? 0).getTime() - Date.now()) / 86_400_000);

  const q = useQuery({ queryKey: ['dashboard'], queryFn: async () => {
    const r: any = {};
    if (peut(ctx, 'commandes.voir')) {
      r.cmdEnCours = await compter('commandes', (q) => q.eq('statut', 'en_cours'));
      const { data } = await supabase.from('commandes').select('id, code, date_rdv, total_fcfa, clients(nom, prenom), paiements(montant_fcfa, annule_at)').eq('statut', 'en_cours').order('date_rdv', { ascending: true, nullsFirst: false }).limit(100);
      r.prochains = (data ?? []).slice(0, 5);
      r.resteAEncaisser = (data ?? []).reduce((s: number, c: any) => s + Number(c.total_fcfa) - (c.paiements ?? []).filter((p: any) => !p.annule_at).reduce((t: number, p: any) => t + Number(p.montant_fcfa), 0), 0);
    }
    if (peut(ctx, 'habits.voir', 'commandes.voir')) {
      r.habitsEnCours = await compter('habits', (q) => q.in('statut', ['en_attente', 'en_cours']));
      r.aValider = await compter('habits', (q) => q.eq('statut', 'a_valider'));
      r.habitsTermines = await compter('habits', (q) => q.eq('statut', 'termine'));
    }
    if (peut(ctx, 'production.prendre')) {
      const { data } = await supabase.from('habit_etapes').select('id, mode, role_id, user_id, habits(statut)').eq('statut', 'disponible');
      r.taches = (data ?? []).filter((e: any) => e.habits?.statut !== 'annule' && ((e.mode === 'personne' && e.user_id === moi) || (e.mode === 'role' && mesRoles.has(e.role_id)))).length;
    }
    if (peut(ctx, 'essayages.voir')) r.essayages = await compter('essayages', (q) => q.eq('statut', 'planifie').gte('date_essayage', aujourdhui()));
    if (peut(ctx, 'retouches.voir')) r.retouches = await compter('retouches', (q) => q.in('statut', ['demandee', 'en_cours']));
    if (peut(ctx, 'paiements.voir')) {
      const { data } = await supabase.from('paiements').select('montant_fcfa').is('annule_at', null).gte('paye_le', debutMoisISO());
      r.encaisse = (data ?? []).reduce((s: number, p: any) => s + Number(p.montant_fcfa), 0);
    }
    if (peut(ctx, 'depenses.voir')) {
      const { data } = await supabase.from('depenses').select('montant_fcfa').is('archived_at', null).gte('date_depense', aujourdhui().slice(0, 8) + '01');
      r.depenses = (data ?? []).reduce((s: number, p: any) => s + Number(p.montant_fcfa), 0);
    }
    return r;
  } });

  if (q.isLoading) return <Chargement />;
  const d = q.data ?? {};
  const T = ({ to, n, l }: { to: string; n: string | number; l: string }) => <Link to={to} className="carte cliquable"><div className="stat">{n}<small>{l}</small></div></Link>;
  return (
    <>
      <EnTete titre="Accueil" />
      {jours <= 7 && jours > 0 && ctx?.est_proprietaire && <Alerte ton="avert">Votre abonnement se termine dans {jours} jour(s). Contactez l'administrateur pour le renouveler.</Alerte>}
      {q.error && <Alerte ton="err">Certaines informations n'ont pas pu être chargées.</Alerte>}
      {ctx?.est_proprietaire && aideVisible && <div className="carte point" style={{ marginBottom: '1rem' }}>
        <div className="ligne">
          <div><h2>Découvrir Couture Gestion en 1 min 30</h2><p className="muted" style={{ marginTop: '.35rem' }}>Découvrez le fonctionnement de votre atelier avec le film de présentation.</p></div>
          <span className="espace" />
          <Link to="/aide" className="btn ocre petit">Voir la démo</Link>
          <button type="button" className="btn sec petit" onClick={() => {
            try { localStorage.setItem('cg_aide_masquee', '1'); }
            catch { /* Le masquage reste valable pour cette session. */ }
            setAideVisible(false);
          }}>Masquer</button>
        </div>
      </div>}
      <div className="grille">
        {d.taches !== undefined && <T to="/app/production" n={d.taches} l="Travaux à effectuer" />}
        {d.cmdEnCours !== undefined && <T to="/app/commandes" n={d.cmdEnCours} l="Commandes en cours" />}
        {d.habitsEnCours !== undefined && <T to={peut(ctx, 'commandes.voir') ? '/app/commandes' : '/app/production'} n={d.habitsEnCours} l="Habits en cours" />}
        {d.aValider !== undefined && <T to="/app/commandes" n={d.aValider} l="Habits à valider" />}
        {d.habitsTermines !== undefined && <T to="/app/commandes?statut=terminee" n={d.habitsTermines} l="Habits terminés" />}
        {d.essayages !== undefined && <T to="/app/essayages" n={d.essayages} l="Essayages à venir" />}
        {d.retouches !== undefined && <T to="/app/retouches" n={d.retouches} l="Retouches à faire" />}
        {d.encaisse !== undefined && <T to="/app/commandes" n={fcfa(d.encaisse)} l="Encaissé ce mois-ci" />}
        {d.resteAEncaisser !== undefined && peut(ctx, 'paiements.voir') && <T to="/app/commandes" n={fcfa(d.resteAEncaisser)} l="Reste à encaisser" />}
        {d.depenses !== undefined && <T to="/app/depenses" n={fcfa(d.depenses)} l="Dépenses ce mois-ci" />}
      </div>
      {d.prochains && d.prochains.length > 0 && (<>
        <h2 style={{ margin: '1.6rem 0 .7rem' }}>Prochains rendez-vous</h2>
        <div className="pile">{d.prochains.map((c: any) => <Link key={c.id} to={`/app/commandes/${c.id}`} className="carte cliquable ligne"><b>{dateFr(c.date_rdv)}</b><span>{c.code}</span><span className="muted">{c.clients ? `${c.clients.prenom} ${c.clients.nom}` : ''}</span></Link>)}</div></>)}
      {!Object.keys(d).length && <Alerte ton="info">Votre profil d'accès ne donne pas encore accès à des informations. Contactez le propriétaire de l'atelier.</Alerte>}
    </>
  );
}
