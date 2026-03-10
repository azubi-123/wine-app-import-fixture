import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[Main] Service Worker registered. Scope:', registration.scope);

      if (registration.installing) {
        console.log('[Main] Service Worker initially installing:', registration.installing);
      } else if (registration.waiting) {
        console.log('[Main] Service Worker initially waiting:', registration.waiting);
        console.log('[Main] A new service worker is waiting. Automatic SKIP_WAITING is disabled for diagnostics.');
        // To manually trigger update for a waiting SW from DevTools:
        // registration.waiting.postMessage({ type: 'SKIP_WAITING' }); then registration.update() or close & reopen tabs.
      } else if (registration.active) {
        console.log('[Main] Service Worker initially active:', registration.active);
      }

      registration.addEventListener('updatefound', () => {
        console.log('[Main] Service Worker EVENT: updatefound. A new worker is now registration.installing.');
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[Main] New worker EVENT: statechange to:', newWorker.state);
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[Main] New SW is installed. Current controller exists. Waiting for activation.');
                // A prompt to the user to update could be shown here.
                // Example: if (confirm("New version available. Refresh?")) { registration.waiting.postMessage({ type: 'SKIP_WAITING' }); }
              } else {
                console.log('[Main] New SW installed, and no current controller. It should activate and control on next load/navigation.');
              }
            }
          });
        }
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[Main] Service Worker EVENT: controllerchange! A new Service Worker has taken control.');
        // window.location.reload(); // <<-- Page reload on controllerchange is TEMPORARILY DISABLED for diagnostics
        console.log('[Main] Page reload on controllerchange is currently disabled for diagnostics.');
      });

    } catch (error) {
      console.error('[Main] Service Worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
