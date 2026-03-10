import React, { useMemo } from 'react';
import { useGlossary, useGlossarySafe } from '@/contexts/GlossaryContext';
import type { GlossaryTerm } from '@shared/schema';

interface DynamicTextRendererProps {
  text: string;
  className?: string;
  enableHighlighting?: boolean;
}

// Safe hook wrapper with fallback for context initialization issues
function useSafeGlossary() {
  try {
    const context = useGlossary();
    // Additional check for context readiness
    if (!context.isReady) {
      return { terms: [], isLoading: true, error: null, isReady: false };
    }
    return context;
  } catch (error) {
    // Fallback when context is not available or not ready
    if (process.env.NODE_ENV === 'development') {
      console.warn('GlossaryContext not available, rendering plain text:', error);
    }
    
    // Try the safe hook as a fallback
    const safeContext = useGlossarySafe();
    if (safeContext) {
      return safeContext;
    }
    
    // Ultimate fallback
    return { terms: [], isLoading: false, error: null, isReady: true };
  }
}

function DynamicTextRenderer({ text, className, enableHighlighting = true }: DynamicTextRendererProps) {
  const { terms, isLoading } = useSafeGlossary();

  const renderedContent = useMemo(() => {
    // Early return for safety - always provide fallback text
    if (!text) {
      return <span className={className}></span>;
    }

    // Safe fallback if glossary is loading, unavailable, or highlighting disabled
    if (isLoading || !terms || terms.length === 0 || !enableHighlighting) {
      return <span className={className}>{text}</span>;
    }

    try {
      // Build a comprehensive list of all terms and their variations
      const allTerms: Array<{ term: string; data: GlossaryTerm }> = [];
      
      terms.forEach(termData => {
        // Safety check for term data structure
        if (!termData || !termData.term) return;
        
        // Add the main term
        allTerms.push({ term: termData.term, data: termData });
        
        // Add variations if they exist
        if (termData.variations && Array.isArray(termData.variations)) {
          termData.variations.forEach(variation => {
            if (variation && typeof variation === 'string') {
              allTerms.push({ term: variation, data: termData });
            }
          });
        }
      });

    // Sort by length (longest first) to avoid partial matches
    allTerms.sort((a, b) => b.term.length - a.term.length);

    // Create a regex pattern for all terms (case-insensitive, word boundaries)
    const termPatterns = allTerms.map(({ term }) => 
      // Escape special regex characters and ensure word boundaries
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    
    if (termPatterns.length === 0) {
      return <span className={className}>{text}</span>;
    }

    // Create the regex with word boundaries to avoid partial matches
    const regex = new RegExp(`\\b(${termPatterns.join('|')})\\b`, 'gi');
    
    // Split text by matches
    const parts = text.split(regex);
    const matches = text.match(regex) || [];

    const result: React.ReactNode[] = [];
    const processedTerms = new Set<string>(); // Track terms already highlighted in this text block
    let matchIndex = 0;

    parts.forEach((part, index) => {
      if (index % 2 === 0) {
        // This is regular text
        if (part) {
          result.push(part);
        }
      } else {
        // This is a matched term
        const matchedTerm = matches[matchIndex];
        if (matchedTerm) {
          // Find the corresponding term data
          const termData = allTerms.find(({ term }) => 
            term.toLowerCase() === matchedTerm.toLowerCase()
          );

          if (termData) {
            // Create a unique key for this term (normalize to base term)
            const termKey = termData.data.term.toLowerCase().replace(/\s+/g, '_');
            
            // Only highlight if this term hasn't been processed yet in this text block
            if (!processedTerms.has(termKey)) {
              processedTerms.add(termKey);
              result.push(
                <span
                  key={`${termKey}-${matchIndex}`}
                  className="font-semibold text-purple-200"
                >
                  {matchedTerm}
                </span>
              );
            } else {
              // Term already highlighted once, render as plain text
              result.push(matchedTerm);
            }
          } else {
            result.push(matchedTerm);
          }
        }
        matchIndex++;
      }
    });

      return <span className={className}>{result}</span>;
    } catch (error) {
      // Graceful degradation - if anything goes wrong, just render plain text
      console.warn('Error in DynamicTextRenderer, falling back to plain text:', error);
      return <span className={className}>{text}</span>;
    }
  }, [text, terms, isLoading, className, enableHighlighting]);

  // Final safety wrapper
  try {
    return renderedContent;
  } catch (error) {
    console.warn('Critical error in DynamicTextRenderer, using emergency fallback:', error);
    return <span className={className}>{text || ''}</span>;
  }
}

// Export as default for better minification stability
export default DynamicTextRenderer;

// Also provide named export for backward compatibility
export { DynamicTextRenderer };