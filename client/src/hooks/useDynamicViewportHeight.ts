import { useEffect } from 'react';

/**
 * Hook that sets a CSS custom property with the actual viewport height
 * to handle mobile browser UI that changes size (address bar, etc.)
 * This provides a more reliable alternative to 100vh/100dvh
 */
export function useDynamicViewportHeight() {
  useEffect(() => {
    let timeoutId: number | undefined;

    const updateViewportHeight = () => {
      // Clear any pending updates
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Debounce the update to avoid excessive recalculations
      timeoutId = window.setTimeout(() => {
        const vh = window.innerHeight;
        
        // Set the custom property on the root element
        document.documentElement.style.setProperty('--app-height', `${vh}px`);
        
        // Also set a viewport unit custom property for calculations
        document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
        
        // Log for debugging (can be removed in production)
        if (process.env.NODE_ENV === 'development') {
          console.log(`Viewport height updated: ${vh}px`);
        }
      }, 100);
    };

    // Initial calculation
    updateViewportHeight();

    // Update on window resize
    window.addEventListener('resize', updateViewportHeight);
    
    // Update on orientation change (mobile devices)
    window.addEventListener('orientationchange', updateViewportHeight);
    
    // Update when the viewport size changes (iOS Safari dynamic UI)
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', updateViewportHeight);
      window.visualViewport?.addEventListener('scroll', updateViewportHeight);
    }

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      if ('visualViewport' in window) {
        window.visualViewport?.removeEventListener('resize', updateViewportHeight);
        window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
      }
    };
  }, []);
}