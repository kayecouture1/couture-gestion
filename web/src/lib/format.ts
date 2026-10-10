const TZ = 'Africa/Bamako';

export const fcfa = (n: number | null | undefined) =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0))).replace(/[\u202f\u00a0]/g, ' ')} FCFA`;

export const dateFr = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso)) : '—';

export const dateHeure = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';

export const duree = (s?: number | null) => {
  if (s == null) return '—';
  const j = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (j) return `${j} j ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
};

// Date du jour à Bamako (UTC+0, sans changement d'heure) au format AAAA-MM-JJ
export const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const debutMoisISO = () => aujourdhui().slice(0, 8) + '01T00:00:00Z';

// Normalise vers E.164 (contexte Mali : 8 chiffres => +223)
export function normaliserTelephone(brut: string, indicatif = '223'): string | null {
  let s = brut.trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) return /^[1-9]\d{7,14}$/.test(s.slice(1)) ? s : null;
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith(indicatif) && s.length === indicatif.length + 8) return '+' + s;
  if (s.length === 8) return '+' + indicatif + s;
  return null;
}

export const lienWhatsApp = (numeroE164: string, message: string) =>
  `https://wa.me/${numeroE164.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

export const nomComplet = (p?: { nom?: string; prenom?: string } | null) => (p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() : '—');

export const LIBELLES_STATUT: Record<string, string> = {
  en_attente: 'En attente', en_cours: 'En cours', a_valider: 'À valider', termine: 'Terminé', terminee: 'Terminée',
  annule: 'Annulé', annulee: 'Annulée', disponible: 'Disponible',
};
export const CATEGORIES: Record<string, string> = { homme: 'Homme', femme: 'Femme', garcon: 'Garçon', jeune_fille: 'Jeune fille' };
