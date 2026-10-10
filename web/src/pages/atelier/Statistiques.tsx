import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { msgErreur } from '../../lib/erreurs';
import { duree, fcfa } from '../../lib/format';
import { useMembres } from '../../lib/hooks';
import { Alerte, Chargement, EnTete } from '../../components/ui';
import { BarresMensuelles, ListeBarres } from '../../components/Graphiques';

export default function Statistiques() {
  const [mois, setMois] = useState(6); const membres = useMembres();
  const q = useQuery({ queryKey: ['stats', mois], queryFn: async () => { const { data, error } = await supabase.rpc('statistiques_atelier', { p_mois: mois }); if (error) throw error; return data as any; } });
  if (q.isLoading) return <Chargement />;
  if (q.error) return <Alerte ton="err">{msgErreur(q.error)}</Alerte>;
  const d = q.data; const totalEnc = d.mois.reduce((s: number, m: any) => s + Number(m.encaisse), 0); const totalDep = d.mois.reduce((s: number, m: any) => s + Number(m.depenses), 0);
  const nom = (id: string) => { const m = membres.data?.find((x) => x.user_id === id); return m ? `${m.prenom} ${m.nom}` : '—'; };
  const T = ({ n, l }: { n: string | number; l: string }) => <div className="carte"><div className="stat">{n}<small>{l}</small></div></div>;
  return (
    <>
      <EnTete titre="Statistiques"><select className="input" style={{ width: 'auto' }} value={mois} onChange={(e) => setMois(Number(e.target.value))} aria-label="Période">{[3, 6, 12, 24].map((n) => <option key={n} value={n}>{n} derniers mois</option>)}</select></EnTete>
      <div className="grille">
        <T n={fcfa(totalEnc)} l="Encaissé" /><T n={fcfa(totalDep)} l="Dépenses" /><T n={fcfa(totalEnc - totalDep)} l="Résultat (encaissé − dépenses)" />
        <T n={d.totaux.commandes} l="Commandes" /><T n={d.totaux.habits_termines} l="Habits terminés" /><T n={fcfa(d.totaux.reste_a_encaisser)} l="Reste à encaisser (commandes en cours)" />
      </div>
      <h2 style={{ margin: '1.4rem 0 .7rem' }}>Encaissements et dépenses par mois</h2>
      <div className="carte"><BarresMensuelles donnees={d.mois} series={[{ cle: 'encaisse', label: 'Encaissé', couleur: 'var(--indigo)' }, { cle: 'depenses', label: 'Dépenses', couleur: 'var(--ocre)' }]} /></div>
      <h2 style={{ margin: '1.4rem 0 .7rem' }}>Commandes par mois</h2>
      <div className="carte"><BarresMensuelles donnees={d.mois} series={[{ cle: 'commandes', label: 'Commandes', couleur: 'var(--ok)' }]} /></div>
      <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: '1.4rem' }}>
        <div className="carte"><h3 style={{ marginBottom: '.7rem' }}>Vêtements les plus commandés</h3><ListeBarres items={d.types.map((t: any) => ({ label: t.type, valeur: Number(t.nombre) }))} /></div>
        <div className="carte"><h3 style={{ marginBottom: '.7rem' }}>Durée moyenne par étape</h3><ListeBarres items={d.etapes.map((e: any) => ({ label: e.etape, valeur: Number(e.duree_moyenne_s ?? 0), detail: `${e.nombre} réalisée(s)` }))} format={(n) => duree(n)} /></div>
        <div className="carte"><h3 style={{ marginBottom: '.7rem' }}>Étapes terminées par employé</h3><ListeBarres items={d.employes.map((e: any) => ({ label: nom(e.user_id), valeur: Number(e.nombre), detail: `Temps cumulé : ${duree(e.duree_totale_s)}` }))} /></div>
      </div>
    </>
  );
}
