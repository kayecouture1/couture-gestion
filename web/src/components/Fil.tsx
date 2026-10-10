import { LIBELLES_STATUT } from '../lib/format';

// Le « fil » : progression d'un habit, une couture dont les points se remplissent étape après étape.
export function Fil({ etapes }: { etapes: { nom: string; statut: string }[] }) {
  if (!etapes.length) return <p className="muted petit">Aucune étape.</p>;
  return (
    <ol className="fil" aria-label="Progression de fabrication">
      {etapes.map((e, i) => (
        <li key={i} className={e.statut}><b>{e.nom}</b>{LIBELLES_STATUT[e.statut] ?? e.statut}</li>
      ))}
    </ol>
  );
}

export const progression = (etapes: { statut: string }[]) =>
  etapes.length ? Math.round((etapes.filter((e) => e.statut === 'terminee').length / etapes.length) * 100) : 0;
