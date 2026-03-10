import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GlossaryTerm } from '@shared/schema';

interface GlossaryContextType {
  terms: GlossaryTerm[];
  isLoading: boolean;
  error: Error | null;
  isReady: boolean; // New flag to indicate context is fully initialized
}

const GlossaryContext = createContext<GlossaryContextType | undefined>(undefined);

export function GlossaryProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  const { data: terms = [], isLoading, error } = useQuery<GlossaryTerm[]>({
    queryKey: ['/api/glossary'],
    staleTime: 1000 * 60 * 15, // 15 minutes - glossary terms don't change often
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 3, // Retry failed requests
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Mark context as ready once initial loading is complete
  useEffect(() => {
    if (!isLoading) {
      setIsReady(true);
    }
  }, [isLoading]);

  const contextValue: GlossaryContextType = {
    terms: terms || [],
    isLoading,
    error,
    isReady
  };

  return (
    <GlossaryContext.Provider value={contextValue}>
      {children}
    </GlossaryContext.Provider>
  );
}

export function useGlossary() {
  const context = useContext(GlossaryContext);
  if (context === undefined) {
    // Provide more detailed error message for debugging
    const error = new Error(
      'useGlossary must be used within a GlossaryProvider. ' +
      'This error often occurs when components try to access the glossary context ' +
      'before the provider is properly initialized. Check that GlossaryProvider ' +
      'wraps your component tree and is mounted before child components render.'
    );
    
    // Add stack trace for better debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.error('GlossaryContext error:', error);
      console.trace('useGlossary call stack');
    }
    
    throw error;
  }
  return context;
}

// Additional hook that safely returns context or null (doesn't throw)
export function useGlossarySafe(): GlossaryContextType | null {
  try {
    return useContext(GlossaryContext) || null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('GlossaryContext not available:', error);
    }
    return null;
  }
}