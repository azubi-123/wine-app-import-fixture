/**
 * Device detection utilities for optimizing media playback
 */

export function isMobileDevice(): boolean {
  // Check via touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check via user agent (fallback)
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  
  // Check screen size
  const isSmallScreen = window.innerWidth <= 768;
  
  return hasTouch && (isMobileUA || isSmallScreen);
}

export function getNetworkSpeed(): 'slow' | 'medium' | 'fast' | 'unknown' {
  const nav = navigator as any;
  
  if (!nav.connection && !nav.mozConnection && !nav.webkitConnection) {
    return 'unknown';
  }
  
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  
  // Check effective type (4g, 3g, 2g, slow-2g)
  if (connection.effectiveType) {
    switch (connection.effectiveType) {
      case '4g':
        return 'fast';
      case '3g':
        return 'medium';
      case '2g':
      case 'slow-2g':
        return 'slow';
    }
  }
  
  // Check downlink speed in Mbps
  if (connection.downlink) {
    if (connection.downlink >= 3) return 'fast'; // Lowered from 5 to 3 Mbps
    if (connection.downlink >= 0.5) return 'medium'; // Lowered from 1 to 0.5 Mbps
    return 'slow';
  }
  
  return 'unknown';
}

export function shouldPreloadVideo(): boolean {
  // Don't preload on mobile devices with slow connections
  if (isMobileDevice()) {
    const speed = getNetworkSpeed();
    return speed === 'fast' || speed === 'unknown'; // Only preload on fast networks or when unknown
  }
  
  return true; // Always preload on desktop
}

export function getOptimalVideoPreload(): 'none' | 'metadata' | 'auto' {
  // On mobile devices, be more conservative with preloading
  if (isMobileDevice()) {
    const speed = getNetworkSpeed();
    
    // No preloading on slow or unknown connections
    if (speed === 'slow' || speed === 'unknown') {
      return 'none';
    }
    
    // Only metadata on medium speed connections
    if (speed === 'medium') {
      return 'metadata';
    }
    
    // Metadata even on fast mobile connections to save bandwidth
    return 'metadata';
  }
  
  // Desktop devices can be more aggressive
  const speed = getNetworkSpeed();
  
  // Still use metadata on slow connections
  if (speed === 'slow') {
    return 'metadata';
  }
  
  // Auto-preload on fast connections or unknown (assume good connection on desktop)
  return 'auto';
}

export function getOptimalAudioPreload(): 'none' | 'metadata' | 'auto' {
  // Audio files are typically smaller than video, so we can be more aggressive
  if (isMobileDevice()) {
    const speed = getNetworkSpeed();
    
    // Only avoid preloading on explicitly slow connections
    if (speed === 'slow') {
      return 'metadata'; // Changed from 'none' to 'metadata' for better mobile performance
    }
    
    // Auto-preload on all other connections (unknown, medium, fast)
    // Audio files are small enough that this is acceptable even on medium connections
    return 'auto';
  }
  
  // Desktop always auto-preloads audio
  return 'auto';
}