import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { msgErreur } from '../lib/erreurs';
import { aujourdhui } from '../lib/format';
import { Alerte, Btn, Champ, Modale, useAction } from './ui';

export const useHabitsChoix = () => useQuery({
  queryKey: ['habits-choix'],
  queryFn: async () => {
    const { data, error } = await supabase.from('habits').select('id, code, type_libelle, statut').neq('statut', 'annule').order('created_at', { ascending: false }).limit(300);
    if (error) throw error; return data as { id: string; code: string; type_libelle: string; statut: string }[];
  },
});

function ChoixHabit({ habitId, onChange }: { habitId: string; onChange: (id: string) => void }) {
  const q = useHabitsChoix();
  return (
    <Champ label="Habit">
      <select className="input" value={habitId} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choisir…</option>{q.data?.map((h) => <option key={h.id} value={h.id}>{h.code} — {h.type_libelle}</option>)}
      </select>
    </Champ>
  );
}

export function EssayageModale({ ouverte, habitId: fixe, onFermer, onFait }: { ouverte: boolean; habitId?: string; onFermer: () => void; onFait: () => void }) {
  const { ctx } = useAuth(); const { enCours, lancer } = useAction();
  const [habitId, setHabitId] = useState(fixe ?? ''); const [date, setDate] = useState(aujourdhui());
  const [heure, setHeure] = useState(''); const [note, setNote] = useState(''); const [er, setEr] = useState<string | null>(null);
  const enregistrer = () => lancer(async () => {
    setEr(null);
    const h = fixe ?? habitId; if (!h) { setEr('Choisissez un habit.'); return; } if (!date) { setEr('Choisissez une date.'); return; }
    const { error } = await supabase.from('essayages').insert({ atelier_id: ctx!.atelier!.id, habit_id: h, date_essayage: date, heure: heure || null, note: note.trim() || null });
    if (error) throw error; onFait(); onFermer();
  }, 'Essayage planifié.', msgErreur);
  return (
    <Modale ouverte={ouverte} titre="Planifier un essayage" onFermer={onFermer}>
      {er && <Alerte ton="err">{er}</Alerte>}
      {!fixe && <ChoixHabit habitId={habitId} onChange={setHabitId} />}
      <div className="grille2"><Champ label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Champ>
        <Champ label="Heure (facultatif)"><input className="input" type="time" value={heure} onChange={(e) => setHeure(e.target.value)} /></Champ></div>
      <Champ label="Note (facultatif)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Champ>
      <Btn bloc chargement={enCours} onClick={enregistrer}>Planifier</Btn>
    </Modale>
  );
}

export function RetoucheModale({ ouverte, habitId: fixe, onFermer, onFait }: { ouverte: boolean; habitId?: string; onFermer: () => void; onFait: () => void }) {
  const { ctx } = useAuth(); const { enCours, lancer } = useAction();
  const [habitId, setHabitId] = useState(fixe ?? ''); const [desc, setDesc] = useState('');
  const [date, setDate] = useState(''); const [cout, setCout] = useState(''); const [er, setEr] = useState<string | null>(null);
  const enregistrer = () => lancer(async () => {
    setEr(null);
    const h = fixe ?? habitId; if (!h) { setEr('Choisissez un habit.'); return; }
    if (desc.trim().length < 3) { setEr('Décrivez la retouche (3 caractères minimum).'); return; }
    const { error } = await supabase.from('retouches').insert({ atelier_id: ctx!.atelier!.id, habit_id: h, description: desc.trim(), date_prevue: date || null, cout_fcfa: Number(cout.replace(/\D/g, '')) || 0 });
    if (error) throw error; onFait(); onFermer();
  }, 'Retouche enregistrée.', msgErreur);
  return (
    <Modale ouverte={ouverte} titre="Demander une retouche" onFermer={onFermer}>
      {er && <Alerte ton="err">{er}</Alerte>}
      {!fixe && <ChoixHabit habitId={habitId} onChange={setHabitId} />}
      <Champ label="Description"><textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Champ>
      <div className="grille2"><Champ label="Date prévue (facultatif)"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Champ>
        <Champ label="Coût supplémentaire (FCFA)" aide="Informatif : le total de la commande n'est pas modifié."><input className="input" inputMode="numeric" value={cout} onChange={(e) => setCout(e.target.value)} /></Champ></div>
      <Btn bloc chargement={enCours} onClick={enregistrer}>Enregistrer</Btn>
    </Modale>
  );
}
