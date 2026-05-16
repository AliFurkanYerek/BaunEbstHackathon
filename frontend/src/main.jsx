import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { registerEmergencyServiceWorker } from './utils/offlineCache.js';
import './styles/index.css';

registerEmergencyServiceWorker();

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
