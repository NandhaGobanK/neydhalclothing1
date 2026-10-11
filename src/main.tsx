import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker immediately for reliable PWA caching and install prompt availability
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
