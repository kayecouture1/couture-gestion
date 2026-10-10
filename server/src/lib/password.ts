import { randomInt } from 'node:crypto';

const MAJ = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MIN = 'abcdefghijkmnpqrstuvwxyz';
const NUM = '23456789';

// Mot de passe temporaire de 12 caractères (sans caractères ambigus), avec majuscule, minuscule et chiffre.
export function motDePasseTemporaire(longueur = 12): string {
  const tout = MAJ + MIN + NUM;
  const pick = (s: string) => s[randomInt(s.length)];
  const chars = [pick(MAJ), pick(MIN), pick(NUM)];
  while (chars.length < longueur) chars.push(pick(tout));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function codeAtelierAleatoire(): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 6 }, () => a[randomInt(a.length)]).join('');
}
