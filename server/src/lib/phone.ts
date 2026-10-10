// Normalise un numéro vers le format international E.164. Contexte par défaut : Mali (+223, 8 chiffres).
export function normaliserTelephone(brut: string, indicatifDefaut = '223'): string | null {
  let s = brut.trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) {
    const chiffres = s.slice(1);
    return /^[1-9]\d{7,14}$/.test(chiffres) ? '+' + chiffres : null;
  }
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith(indicatifDefaut) && s.length === indicatifDefaut.length + 8) return '+' + s;
  if (s.length === 8) return '+' + indicatifDefaut + s;
  return null;
}
