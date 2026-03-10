/**
 * Prompt Sanitization Utilities
 * P1-004: Protect against prompt injection attacks
 */

/**
 * Sanitize user input for safe interpolation into AI prompts
 * Removes characters that could be used for prompt injection
 */
export function sanitizeForPrompt(input: string | null | undefined, maxLength: number = 200): string {
  if (!input) return '';

  return input
    // Remove newlines that could break prompt structure
    .replace(/[\r\n]/g, ' ')
    // Remove JSON-like characters that could inject structure
    .replace(/[{}[\]]/g, '')
    // Remove backticks that could escape prompt context
    .replace(/`/g, "'")
    // Remove potential instruction markers
    .replace(/(?:ignore|forget|disregard)\s+(?:previous|above|all)/gi, '[filtered]')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim and limit length
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize a wine info object for prompt interpolation
 */
export function sanitizeWineInfo(wineInfo: {
  name?: string | null;
  region?: string | null;
  grapeVariety?: string | null;
  grapeVarieties?: string[] | null;
  vintage?: number | null;
  producer?: string | null;
  wineType?: string | null;
}): {
  name: string;
  region: string;
  grapeVariety: string;
  vintage: string;
  producer: string;
  wineType: string;
} {
  return {
    name: sanitizeForPrompt(wineInfo.name, 150) || 'Unknown Wine',
    region: sanitizeForPrompt(wineInfo.region, 100) || 'Unknown Region',
    grapeVariety: sanitizeForPrompt(
      wineInfo.grapeVariety || wineInfo.grapeVarieties?.[0],
      100
    ) || 'Unknown Varietal',
    vintage: wineInfo.vintage ? String(wineInfo.vintage) : 'NV',
    producer: sanitizeForPrompt(wineInfo.producer, 100) || '',
    wineType: sanitizeForPrompt(wineInfo.wineType, 50) || ''
  };
}

/**
 * Sanitize tasting response text for prompt interpolation
 */
export function sanitizeTastingText(text: string | null | undefined): string {
  return sanitizeForPrompt(text, 500);
}
