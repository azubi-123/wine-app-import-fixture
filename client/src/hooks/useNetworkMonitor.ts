import { useState, useEffect, useCallback } from 'react';
import { getNetworkSpeed } from '@/lib/device-utils';

type NetworkStatus = {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  speed: 'slow' | 'medium' | 'fast' | 'unknown';
};

export function useNetworkMonitor() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => ({
    isOnline: navigator.onLine,
    speed: getNetworkSpeed()
  }));

  const updateNetworkStatus = useCallback(() => {
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    const newStatus: NetworkStatus = {
      isOnline: navigator.onLine,
      speed: getNetworkSpeed()
    };

    if (connection) {
      newStatus.effectiveType = connection.effectiveType;
      newStatus.downlink = connection.downlink;
      newStatus.rtt = connection.rtt;
    }

    setNetworkStatus(newStatus);
  }, []);

  useEffect(() => {
    // Set up event listeners
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Listen to connection changes if available
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    // Initial update
    updateNetworkStatus();

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      
      if (connection && connection.removeEventListener) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, [updateNetworkStatus]);

  return networkStatus;
}