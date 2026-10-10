import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererCode, hasherCode, normaliserCode } from '../src/lib/codes.ts';
import { normaliserTelephone } from '../src/lib/phone.ts';
import { motDePasseTemporaire, codeAtelierAleatoire } from '../src/lib/password.ts';
import { detecterImage } from '../src/lib/images.ts';

test('code : format CG-XXXX-XXXX-XXXX, caractères non ambigus, unicité', () => {
  const vus = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const c = genererCode();
    assert.match(c, /^CG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    vus.add(c);
  }
  assert.equal(vus.size, 2000);
});

test('code : la saisie est tolérante (minuscules, espaces, tirets) et le hash est stable', () => {
  const c = genererCode();
  const saisie = c.toLowerCase().replace(/-/g, ' ');
  assert.equal(normaliserCode(saisie), normaliserCode(c));
  const s = 'x'.repeat(32);
  assert.equal(hasherCode(saisie, s), hasherCode(c, s));
  assert.notEqual(hasherCode(c, s), hasherCode(c, 'y'.repeat(32)));
  assert.equal(hasherCode(c, s).length, 64);
  assert.ok(!hasherCode(c, s).includes(normaliserCode(c))); // le code n'est pas lisible dans l'empreinte
});

test('téléphone : formats maliens et internationaux vers E.164', () => {
  assert.equal(normaliserTelephone('76 12 34 56'), '+22376123456');
  assert.equal(normaliserTelephone('+223 76-12-34-56'), '+22376123456');
  assert.equal(normaliserTelephone('00223 76123456'), '+22376123456');
  assert.equal(normaliserTelephone('22376123456'), '+22376123456');
  assert.equal(normaliserTelephone('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(normaliserTelephone('123'), null);
  assert.equal(normaliserTelephone('abc'), null);
  assert.equal(normaliserTelephone('+0123456789'), null);
});

test('mot de passe temporaire : 12 caractères, majuscule + minuscule + chiffre', () => {
  for (let i = 0; i < 500; i++) {
    const m = motDePasseTemporaire();
    assert.equal(m.length, 12);
    assert.match(m, /[A-Z]/); assert.match(m, /[a-z]/); assert.match(m, /\d/);
  }
  assert.match(codeAtelierAleatoire(), /^[a-z0-9]{6}$/);
});

test('images : le type réel est lu dans les octets, pas dans le nom ni le type déclaré', () => {
  assert.equal(detecterImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'image/png');
  assert.equal(detecterImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(detecterImage(Buffer.from('<svg onload=alert(1)>')), null);
  assert.equal(detecterImage(Buffer.from('%PDF-1.7')), null);
});
