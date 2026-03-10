import OpenAI from "openai";

/**
 * Shared OpenAI client instance
 *
 * All OpenAI API calls should use this shared client to ensure:
 * - Single point of configuration
 * - Consistent error handling
 * - Easy to add retry logic, logging, etc.
 * - Mockable for tests
 */

// Validate API key at startup in production
if (process.env.NODE_ENV === 'production' && !process.env.OPENAI_API_KEY) {
  console.warn('[OpenAI] WARNING: OPENAI_API_KEY not set. AI features will be disabled.');
}

// Create client only if API key is available
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
    })
  : null;

/**
 * Get the OpenAI client instance
 * Returns null if OPENAI_API_KEY is not configured
 */
export function getOpenAIClient(): OpenAI | null {
  return openaiClient;
}

/**
 * Check if OpenAI is available
 */
export function isOpenAIAvailable(): boolean {
  return openaiClient !== null;
}

/**
 * Get OpenAI client or throw if not available
 * Use this when OpenAI is required for the operation
 */
export function requireOpenAI(): OpenAI {
  if (!openaiClient) {
    throw new Error('OpenAI is not configured. Set OPENAI_API_KEY environment variable.');
  }
  return openaiClient;
}

// Export the client directly for convenience (may be null)
export const openai = openaiClient;
