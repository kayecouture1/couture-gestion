import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { RetoursProvider } from './components/ui';
import App from './App';
import './styles.css';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <RetoursProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </RetoursProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

// PWA de base : installation et démarrage rapide. Le mode hors connexion complet n'est pas implémenté.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
