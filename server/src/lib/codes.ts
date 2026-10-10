import { createHmac, randomInt } from 'node:crypto';

// 32 symboles sans I, O, 0, 1 (pas de confusion à la lecture).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function genererCode(): string {
  const bloc = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `CG-${bloc()}-${bloc()}-${bloc()}`; // 12 symboles aléatoires = 60 bits
}

export function normaliserCode(saisie: string): string {
  let s = saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length === 14 && s.startsWith('CG')) s = s.slice(2);
  return s;
}

// Seule l'empreinte (HMAC-SHA256 avec secret serveur) est stockée en base : le code n'est pas réversible.
export function hasherCode(saisie: string, secret: string): string {
  return createHmac('sha256', secret).update(normaliserCode(saisie)).digest('hex');
}
