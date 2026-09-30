import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[NetCanvas PWA] Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.warn('[NetCanvas PWA] Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

