export const verifierMotDePasse = (m: string): string | null => {
  if (m.length < 8) return 'Au moins 8 caractères.';
  if (!/[A-Za-z]/.test(m)) return 'Ajoutez au moins une lettre.';
  if (!/\d/.test(m)) return 'Ajoutez au moins un chiffre.';
  return null;
};
export const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
