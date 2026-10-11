import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  CODE_HMAC_SECRET: z.string().min(32, 'CODE_HMAC_SECRET doit contenir au moins 32 caractères'),
  APP_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().min(1),
  EMPLOYEE_EMAIL_DOMAIN: z.string().min(3).default('employes.couture-gestion.app'),
  APP_TIMEZONE: z.string().default('Africa/Bamako'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default('development'),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(value.APP_URL)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['APP_URL'],
      message: 'APP_URL doit être l URL publique du frontend en production',
    });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // On n'affiche que les NOMS des variables en défaut, jamais leurs valeurs.
  const noms = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  console.error('Configuration invalide :\n - ' + noms.join('\n - '));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  origins: parsed.data.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
};
