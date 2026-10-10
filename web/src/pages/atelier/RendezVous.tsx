import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { msgErreur } from '../../lib/erreurs';
import { aujourdhui, dateFr } from '../../lib/format';
import { Alerte, Chargement, EnTete, Vide } from '../../components/ui';

export default function RendezVous() {
  const { ctx } = useAuth(); const cap = ctx?.atelier?.capacite_jour ?? 1;
  const q = useQuery({ queryKey: ['rdv'], queryFn: async () => {
    const { data, error } = await supabase.from('commandes').select('id, code, date_rdv, clients(nom, prenom), habits(id, statut)').eq('statut', 'en_cours').order('date_rdv', { ascending: true, nullsFirst: false }).limit(300);
    if (error) throw error; return data as any[]; } });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const jours = new Map<string, any[]>();
  for (const c of q.data ?? []) { const k = c.date_rdv ?? 'sans'; jours.set(k, [...(jours.get(k) ?? []), c]); }
  const auj = aujourdhui();
  return (
    <>
      <EnTete titre="Rendez-vous" />
      <Alerte ton="info">Capacité : {cap} habit(s) par jour, délai minimum {ctx?.atelier?.delai_min_jours} jour(s). Modifiable dans les Paramètres.</Alerte>
      {!q.data?.length && <Vide titre="Aucun rendez-vous à venir" />}
      <div className="pile">{[...jours.entries()].map(([jour, cmds]) => {
        const nb = cmds.reduce((s, c) => s + (c.habits ?? []).filter((h: any) => h.statut !== 'annule').length, 0);
        return (<div key={jour} className="carte"><div className="ligne"><h3>{jour === 'sans' ? 'Sans date' : dateFr(jour)}</h3>{jour < auj && jour !== 'sans' && <span className="muted petit">(passé)</span>}<span className="espace" /><span className={nb > cap ? 'gras' : 'muted'} style={nb > cap ? { color: 'var(--alerte)' } : undefined}>{nb}/{cap} habit(s)</span></div>
          <div className="barre" style={{ margin: '.4rem 0' }}><span style={{ width: `${Math.min(100, (nb / cap) * 100)}%`, background: nb > cap ? 'var(--alerte)' : undefined }} /></div>
          {cmds.map((c) => <Link key={c.id} to={`/app/commandes/${c.id}`} className="ligne petit" style={{ padding: '.2rem 0' }}><b>{c.code}</b><span className="muted">{c.clients ? `${c.clients.prenom} ${c.clients.nom}` : ''}</span><span className="espace" />{(c.habits ?? []).length} habit(s)</Link>)}</div>);
      })}</div>
    </>
  );
}
