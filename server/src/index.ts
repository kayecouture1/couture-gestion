import { env } from './config/env';
import { creerApp } from './app';

const serveur = creerApp().listen(env.PORT, '0.0.0.0', () => {
  console.log(`API COUTURE GESTION démarrée sur le port ${env.PORT} (${env.NODE_ENV})`);
});

serveur.requestTimeout = 30_000;
serveur.headersTimeout = 35_000;
serveur.keepAliveTimeout = 5_000;

const arreter = (signal: string) => {
  console.log(`Arrêt demandé (${signal})`);
  serveur.close((err) => {
    if (err) {
      console.error('[arrêt]', err.message);
      process.exitCode = 1;
    }
    process.exit();
  });
};

process.once('SIGTERM', () => arreter('SIGTERM'));
process.once('SIGINT', () => arreter('SIGINT'));
