// Traduit les erreurs techniques (Postgres, Supabase, API) en messages clairs pour l'utilisateur.
const METIER: Record<string, string> = {
  ACCES_REFUSE: "Vous n'avez pas l'autorisation d'effectuer cette action.",
  DEJA_PRIS: "Cet habit vient d'être pris par un autre utilisateur.",
  NON_ELIGIBLE: "Cette étape n'est pas attribuée à votre rôle ou à votre compte.",
  NON_AUTORISE_OU_DEJA_TERMINE: "Cette étape n'est pas en cours chez vous, ou elle est déjà terminée.",
  HABIT_ANNULE: 'Cet habit a été annulé.',
  INTROUVABLE: 'Élément introuvable.',
  MONTANT_INVALIDE: 'Montant invalide.',
  DEPASSE_LE_RESTE: 'Le montant dépasse le reste à payer.',
  COMMANDE_ANNULEE: 'Cette commande est annulée.',
  CLIENT_INTROUVABLE: 'Client introuvable.',
  HABITS_REQUIS: 'Ajoutez au moins un habit à la commande.',
  CIRCUIT_REQUIS: 'Chaque habit doit avoir un circuit de fabrication avec au moins une étape.',
  ETAPES_NON_TERMINEES: "Toutes les étapes de fabrication doivent d'abord être terminées.",
  EMPLACEMENT_INVALIDE: 'Emplacement invalide.',
  MOTIF_REQUIS: 'Indiquez un motif (3 caractères minimum).',
  ESCALADE_INTERDITE: "Vous ne pouvez pas attribuer ou modifier des permissions que vous ne possédez pas, ni les vôtres.",
  TOTAL_INFERIEUR_AUX_PAIEMENTS: 'Le total ne peut pas être inférieur aux paiements déjà reçus.',
  AUCUNE_DATE_DISPONIBLE: 'Aucune date disponible : vérifiez la capacité et les jours de travail.',
  INTROUVABLE_OU_DEJA_CLOTUREE: 'Commande introuvable ou déjà clôturée.',
};

export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) { super(message); }
}

export function msgErreur(e: unknown): string {
  const anyE = e as any;
  if (anyE instanceof ApiError) return anyE.message;
  const brut: string = anyE?.message ?? String(e ?? '');
  for (const [k, v] of Object.entries(METIER)) if (brut.includes(k)) return v;
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(brut)) {
    return 'Problème de connexion réseau. Vérifiez votre connexion puis réessayez.';
  }
  if (/row-level security|permission denied|violates row-level/i.test(brut)) {
    return "Vous n'avez pas l'autorisation d'effectuer cette action (ou l'abonnement n'est pas actif).";
  }
  if (/duplicate key|already exists|unique/i.test(brut)) return 'Cet élément existe déjà.';
  if (/foreign key/i.test(brut)) return 'Opération impossible : cet élément est utilisé ailleurs.';
  return 'Une erreur est survenue. Veuillez réessayer.';
}
