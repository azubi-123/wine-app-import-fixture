import type { GlossaryTerm } from '@shared/schema';

/**
 * Helper function to extract relevant glossary terms from text
 * Moved to separate utility file to avoid circular dependencies
 */
export function extractRelevantTerms(text: string, allTerms: GlossaryTerm[]): GlossaryTerm[] {
  if (!text || !allTerms || allTerms.length === 0) return [];

  const relevantTerms: GlossaryTerm[] = [];
  const processedTerms = new Set<string>();

  allTerms.forEach(termData => {
    // Safety check for term data
    if (!termData || !termData.term) return;
    
    const mainTerm = termData.term.toLowerCase();
    const variations = termData.variations?.map(v => v.toLowerCase()) || [];
    const allVariations = [mainTerm, ...variations];

    // Check if any variation appears in the text
    const termKey = mainTerm.replace(/\s+/g, '_');
    if (!processedTerms.has(termKey)) {
      try {
        const isRelevant = allVariations.some(term => {
          const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          return regex.test(text);
        });

        if (isRelevant) {
          relevantTerms.push(termData);
          processedTerms.add(termKey);
        }
      } catch (error) {
        // Skip this term if regex fails
        console.warn('Error processing glossary term:', termData.term, error);
      }
    }
  });

  return relevantTerms.sort((a, b) => a.term.localeCompare(b.term));
}