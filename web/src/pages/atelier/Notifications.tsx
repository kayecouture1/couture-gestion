import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { msgErreur } from '../../lib/erreurs';
import { dateHeure } from '../../lib/format';
import { useMembres } from '../../lib/hooks';
import { Alerte, Badge, Btn, Chargement, EnTete, Vide, useAction } from '../../components/ui';

export default function Notifications() {
  const membres = useMembres(); const qc = useQueryClient(); const { enCours, lancer } = useAction();
  const q = useQuery({ queryKey: ['notifications'], queryFn: async () => { const { data, error } = await supabase.from('notifications').select('*, habits(id, code, type_libelle)').order('created_at', { ascending: false }).limit(200); if (error) throw error; return data as any[]; } });
  const taches = useQuery({ queryKey: ['notifications-taches'], queryFn: async () => { const { data, error } = await supabase.from('notifications_taches').select('id, etape_id, lu_at, ignoree_at, created_at, habit_etapes(id, nom, ordre, statut, habits(id, code, type_libelle, statut))').is('ignoree_at', null).order('created_at', { ascending: false }).limit(200); if (error) throw error; return data as any[]; } });
  if (q.isLoading || taches.isLoading) return <Chargement />;
  if (q.error || taches.error) return <Alerte ton="err">{msgErreur(q.error ?? taches.error)}</Alerte>;
  const nom = (id: string) => { const m = membres.data?.find((x) => x.user_id === id); return m ? `${m.prenom} ${m.nom}` : '—'; };
  const agir = (id: string, action: 'lue' | 'ignoree') => lancer(async () => {
    const { error } = await supabase.rpc('marquer_notification_tache', { p_notification: id, p_action: action });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ['notifications-taches'] });
    qc.invalidateQueries({ queryKey: ['notifications-taches-non-lues'] });
  }, action === 'lue' ? 'Notification marquée comme lue.' : 'Notification ignorée.', msgErreur);
  return (
    <>
      <EnTete titre="Notifications" />
      <p className="muted petit">Les notifications de tâches restent visibles jusqu'à leur prise, leur lecture ou leur ignorance. Cette page conserve aussi l'historique des appels et messages clients.</p>
      {!!taches.data?.length && <><h2 style={{ margin: '1.2rem 0 .7rem' }}>Tâches disponibles</h2><div className="pile">{taches.data.map((n) => {
        const e = n.habit_etapes; const h = e?.habits; const nonLue = !n.lu_at;
        return <div key={n.id} className="carte"><div className="ligne"><Badge ton={nonLue ? 'alerte' : 'ocre'}>{nonLue ? 'Nouvelle tâche' : 'Lue'}</Badge><Link to={h ? `/app/habits/${h.id}` : '/app/production'}><b>{h?.code ?? 'Habit'}</b></Link><span className="muted petit">{e?.nom}</span><span className="espace" /><span className="muted petit">{dateHeure(n.created_at)}</span></div><div className="ligne" style={{ marginTop: '.5rem' }}><span className="muted petit">{h?.type_libelle} · statut : {e?.statut}</span><span className="espace" /><Btn petit variante="sec" disabled={enCours} onClick={() => agir(n.id, 'lue')}>Marquer comme lue</Btn><Btn petit variante="sec" disabled={enCours} onClick={() => agir(n.id, 'ignoree')}>Ignorer</Btn></div></div>;
      })}</div></>}
      {!q.data?.length && !taches.data?.length && <Vide titre="Aucune notification" />}
      {!!q.data?.length && <h2 style={{ margin: '1.2rem 0 .7rem' }}>Historique des contacts clients</h2>}
      <div className="pile">{q.data?.map((n) => (
        <div key={n.id} className="carte"><div className="ligne"><Badge ton={n.canal === 'whatsapp' ? 'ok' : undefined}>{n.canal === 'whatsapp' ? 'WhatsApp' : 'Appel'}</Badge><Link to={`/app/habits/${n.habits?.id}`}><b>{n.habits?.code}</b></Link><span className="muted petit">{n.habits?.type_libelle}</span><span className="espace" /><span className="muted petit">{dateHeure(n.created_at)} · {nom(n.created_by)}</span></div>
          {n.message && <p className="muted petit" style={{ margin: '.4rem 0 0' }}>{n.message}</p>}</div>))}</div>
    </>
  );
}
