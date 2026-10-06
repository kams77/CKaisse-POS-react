import { createRoot } from 'react-dom/client';
import { KolaPassApp } from './KolaPassApp.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Application KolaPass (billetterie & contrôle d'accès) reliée au serveur.
// Les écrans caisse / stock / KolaPay restent dans src/App.tsx, non utilisés pour la phase de test.
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <KolaPassApp />
  </ErrorBoundary>
);
