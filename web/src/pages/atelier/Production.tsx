import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { peut } from '../../lib/perms';
import { msgErreur } from '../../lib/erreurs';
import { dateHeure, duree } from '../../lib/format';
import { Alerte, Badge, Btn, Chargement, EnTete, Vide, useAction, useRetours } from '../../components/ui';
import { Photo } from '../../components/Photo';

export default function Production() {
  const { ctx, session } = useAuth(); const qc = useQueryClient();
  const { confirmer } = useRetours(); const { enCours, lancer } = useAction();
  const [onglet, setOnglet] = useState<'dispo' | 'cours' | 'finies'>('dispo');
  const [actif, setActif] = useState<string | null>(null);
  const moi = session!.user.id;
  const mesRoles = new Set((ctx?.roles ?? []).map((r) => r.id));

  // Actualisation régulière : une tâche prise par un collègue disparaît de la liste « disponibles ».
  const q = useQuery({
    queryKey: ['production'], refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('habit_etapes')
        .select('id, nom, ordre, mode, role_id, user_id, statut, pris_par, pris_a, termine_a, duree_secondes, habits(id, code, type_libelle, statut, photo_habit_path)')
        .in('statut', ['disponible', 'en_cours', 'terminee']).order('pris_a', { ascending: false, nullsFirst: false }).limit(300);
      if (error) throw error; return data as any[];
    },
  });

  const valides = (q.data ?? []).filter((e) => e.habits && e.habits.statut !== 'annule');
  const dispo = valides.filter((e) => e.statut === 'disponible' && ((e.mode === 'personne' && e.user_id === moi) || (e.mode === 'role' && mesRoles.has(e.role_id))));
  const cours = valides.filter((e) => e.statut === 'en_cours' && e.pris_par === moi);
  const finies = valides.filter((e) => e.statut === 'terminee' && e.pris_par === moi).sort((a, b) => (b.termine_a ?? '').localeCompare(a.termine_a ?? '')).slice(0, 30);
  const liste = onglet === 'dispo' ? dispo : onglet === 'cours' ? cours : finies;

  const actualiser = () => qc.invalidateQueries({ queryKey: ['production'] });
  const prendre = (e: any) => { setActif(e.id); return lancer(async () => {
    const { error } = await supabase.rpc('prendre_etape', { p_etape: e.id, p_role: e.mode === 'role' ? e.role_id : null });
    if (error) { actualiser(); throw error; }
    actualiser(); setOnglet('cours');
  }, `Étape « ${e.nom} » prise. Bon travail !`, msgErreur).finally(() => setActif(null)); };
  const terminer = async (e: any) => {
    if (!(await confirmer(`Marquer l'étape « ${e.nom} » de ${e.habits.code} comme terminée ?`, { libelle: 'Terminé' }))) return;
    setActif(e.id);
    await lancer(async () => { const { error } = await supabase.rpc('terminer_etape', { p_etape: e.id }); if (error) throw error; actualiser(); }, 'Étape terminée.', msgErreur);
    setActif(null);
  };

  return (
    <>
      <EnTete titre="Mes tâches" />
      <div className="onglets">
        <button className={onglet === 'dispo' ? 'on' : ''} onClick={() => setOnglet('dispo')}>Disponibles ({dispo.length})</button>
        <button className={onglet === 'cours' ? 'on' : ''} onClick={() => setOnglet('cours')}>En cours ({cours.length})</button>
        <button className={onglet === 'finies' ? 'on' : ''} onClick={() => setOnglet('finies')}>Terminées</button>
      </div>
      {q.isLoading && <Chargement />}
      {q.error && <Alerte ton="err">{msgErreur(q.error)}</Alerte>}
      {q.data && !liste.length && <Vide titre={onglet === 'dispo' ? 'Aucune tâche disponible' : onglet === 'cours' ? 'Aucune tâche en cours' : 'Aucune tâche terminée'} texte={onglet === 'dispo' ? 'Les habits arrivent ici dès que l’étape précédente est terminée.' : undefined} />}
      <div className="pile">
        {liste.map((e) => (
          <div key={e.id} className="carte point ligne" style={{ alignItems: 'center' }}>
            <div style={{ width: 64 }}><Photo chemin={e.habits.photo_habit_path} alt={`Habit ${e.habits.code}`} classe="vignette" /></div>
            <div style={{ flex: '1 1 160px' }}>
              <b>{e.nom}</b> <Badge ton={e.statut === 'terminee' ? 'ok' : 'ocre'}>{e.mode === 'personne' ? 'Pour vous' : 'Rôle'}</Badge>
              <div className="muted petit"><Link to={`/app/habits/${e.habits.id}`}>{e.habits.code}</Link> · {e.habits.type_libelle}</div>
              {e.statut === 'en_cours' && <div className="muted petit">Pris le {dateHeure(e.pris_a)}</div>}
              {e.statut === 'terminee' && <div className="muted petit">Terminé le {dateHeure(e.termine_a)} · {duree(e.duree_secondes)}</div>}
            </div>
            {e.statut === 'disponible' && peut(ctx, 'production.prendre') && <Btn chargement={enCours && actif === e.id} disabled={enCours} onClick={() => prendre(e)}>J'ai pris cet habit</Btn>}
            {e.statut === 'en_cours' && peut(ctx, 'production.terminer_etape') && <Btn variante="ocre" chargement={enCours && actif === e.id} disabled={enCours} onClick={() => terminer(e)}>Terminé</Btn>}
          </div>
        ))}
      </div>
    </>
  );
}
