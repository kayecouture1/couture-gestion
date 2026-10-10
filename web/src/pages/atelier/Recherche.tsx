import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { Alerte, Chargement, EnTete, Vide } from '../../components/ui';

// Recherche globale : clients (nom, prénom, téléphone), commandes et habits (code). Limitée par les permissions.
export default function Recherche() {
  const { ctx } = useAuth(); const [params] = useSearchParams();
  const terme = (params.get('q') ?? '').trim().replace(/[%,()]/g, '');
  const q = useQuery({ queryKey: ['recherche', terme], enabled: terme.length >= 2, queryFn: async () => {
    const r: { clients: any[]; commandes: any[]; habits: any[] } = { clients: [], commandes: [], habits: [] };
    if (peut(ctx, 'clients.voir')) { const { data } = await supabase.from('clients').select('id, nom, prenom, telephone_e164').is('archived_at', null).or(`nom.ilike.%${terme}%,prenom.ilike.%${terme}%,telephone_e164.ilike.%${terme}%`).limit(10); r.clients = data ?? []; }
    if (peut(ctx, 'commandes.voir')) { const { data } = await supabase.from('commandes').select('id, code, statut, clients(nom, prenom)').ilike('code', `%${terme}%`).limit(10); r.commandes = data ?? []; }
    if (peut(ctx, 'habits.voir', 'commandes.voir', 'production.prendre')) { const { data } = await supabase.from('habits').select('id, code, type_libelle, statut').ilike('code', `%${terme}%`).limit(10); r.habits = data ?? []; }
    return r;
  } });
  const total = q.data ? q.data.clients.length + q.data.commandes.length + q.data.habits.length : 0;
  return (
    <>
      <EnTete titre="Recherche" />
      {terme.length < 2 ? <Alerte ton="info">Saisissez au moins 2 caractères dans la barre de recherche en haut de l'écran.</Alerte> : <p className="muted">Résultats pour « {terme} »</p>}
      {q.isLoading && <Chargement />}{q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !total && <Vide titre="Aucun résultat" texte="Essayez un nom, un numéro de téléphone, ou un code (CMD-…, HAB-…)." />}
      {q.data && q.data.clients.length > 0 && <><h2 style={{ margin: '1rem 0 .5rem' }}>Clients</h2><div className="pile">{q.data.clients.map((c) => <Link key={c.id} to={`/app/clients/${c.id}`} className="carte cliquable"><b>{c.prenom} {c.nom}</b> <span className="muted petit">{c.telephone_e164}</span></Link>)}</div></>}
      {q.data && q.data.commandes.length > 0 && <><h2 style={{ margin: '1rem 0 .5rem' }}>Commandes</h2><div className="pile">{q.data.commandes.map((c) => <Link key={c.id} to={`/app/commandes/${c.id}`} className="carte cliquable"><b>{c.code}</b> <span className="muted petit">{c.clients ? `${c.clients.prenom} ${c.clients.nom}` : ''}</span></Link>)}</div></>}
      {q.data && q.data.habits.length > 0 && <><h2 style={{ margin: '1rem 0 .5rem' }}>Habits</h2><div className="pile">{q.data.habits.map((h) => <Link key={h.id} to={`/app/habits/${h.id}`} className="carte cliquable"><b>{h.code}</b> <span className="muted petit">{h.type_libelle}</span></Link>)}</div></>}
    </>
  );
}
