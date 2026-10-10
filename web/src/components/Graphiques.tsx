import { fcfa } from '../lib/format';

// Graphiques en SVG pur (aucune dépendance) alimentés par les statistiques réelles de la base.
export function BarresMensuelles({ donnees, series }: { donnees: Record<string, any>[]; series: { cle: string; label: string; couleur: string }[] }) {
  const L = 560, H = 220, marge = { g: 8, d: 8, h: 14, b: 28 };
  const max = Math.max(1, ...donnees.flatMap((d) => series.map((s) => Number(d[s.cle]) || 0)));
  const largeurGroupe = (L - marge.g - marge.d) / Math.max(1, donnees.length);
  const lb = Math.min(26, (largeurGroupe - 8) / series.length);
  const nomMois = (m: string) => new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(new Date(m + '-01T00:00:00Z'));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Graphique : ${series.map((s) => s.label).join(', ')} par mois`} style={{ width: '100%', height: 'auto' }}>
        <line x1={marge.g} x2={L - marge.d} y1={H - marge.b} y2={H - marge.b} stroke="var(--ligne)" />
        {donnees.map((d, i) => {
          const x0 = marge.g + i * largeurGroupe + (largeurGroupe - lb * series.length) / 2;
          return (
            <g key={d.mois}>
              {series.map((s, k) => {
                const v = Number(d[s.cle]) || 0; const h = ((H - marge.b - marge.h) * v) / max;
                return <rect key={s.cle} x={x0 + k * lb} y={H - marge.b - h} width={lb - 2} height={Math.max(h, v > 0 ? 2 : 0)} rx={3} fill={s.couleur}><title>{`${nomMois(d.mois)} — ${s.label} : ${s.cle === 'commandes' ? v : fcfa(v)}`}</title></rect>;
              })}
              <text x={marge.g + i * largeurGroupe + largeurGroupe / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{nomMois(d.mois)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="ligne petit" style={{ gap: '1rem' }}>{series.map((s) => <span key={s.cle}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: s.couleur, marginRight: 6 }} />{s.label}</span>)}</figcaption>
    </figure>
  );
}

export function ListeBarres({ items, format = (n: number) => String(n) }: { items: { label: string; valeur: number; detail?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.valeur));
  if (!items.length) return <p className="muted petit">Pas encore de données sur cette période.</p>;
  return (
    <div className="pile" style={{ gap: '.5rem' }}>
      {items.map((i) => (
        <div key={i.label}>
          <div className="ligne petit"><b>{i.label}</b><span className="espace" /><span>{format(i.valeur)}</span></div>
          <div className="barre"><span style={{ width: `${(i.valeur / max) * 100}%` }} /></div>
          {i.detail && <div className="muted petit">{i.detail}</div>}
        </div>
      ))}
    </div>
  );
}
