import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './lib/http';
import { limiteGenerale } from './middleware/limites';
import { inscription } from './routes/inscription';
import { abonnement } from './routes/abonnement';
import { employes } from './routes/employes';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';
import { factures } from './routes/factures';

export function creerApp() {
  const app = express();
  app.set('trust proxy', 1); // Render place un proxy devant l'application : nécessaire pour la vraie IP
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id')?.trim() || crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => (!origin || env.origins.includes(origin) ? cb(null, true) : cb(new Error('CORS'))),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  }));
  app.use(limiteGenerale);

  app.get('/sante', (_req, res) => res.json({ ok: true })); // liveness : ne dépend pas de Supabase
  app.get('/pret', async (_req, res) => {
    try {
      const { admin } = await import('./lib/supabase.js');
      const { error } = await admin.from('parametres_globaux').select('cle').limit(1);
      if (error) return res.status(503).json({ ok: false });
      return res.json({ ok: true });
    } catch {
      return res.status(503).json({ ok: false });
    }
  });

  // L'inscription accepte un corps plus grand (logo) : elle porte son propre parseur JSON.
  app.use('/api', inscription);
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', abonnement);
  app.use('/api', employes);
  app.use('/api', adminRoutes);
  app.use('/api', publicRoutes);
  app.use('/api', factures);

  app.use((_req, res) => res.status(404).json({ erreur: 'Route introuvable' }));
  app.use(errorHandler);
  return app;
}
