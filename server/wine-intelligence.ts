import { db } from './db';
import { wineCharacteristicsCache, tastings, type WineCharacteristicsData } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { openai } from './lib/openai';
import { sanitizeForPrompt } from './lib/sanitize';

/**
 * Normalize wine information into a consistent cache key
 */
export function normalizeWineSignature(
  wineName: string,
  wineRegion?: string | null,
  grapeVariety?: string | null
): string {
  const parts = [
    wineName.toLowerCase().trim(),
    wineRegion?.toLowerCase().trim() || '',
    grapeVariety?.toLowerCase().trim() || ''
  ].filter(Boolean);

  return parts.join('|');
}

/**
 * Get wine characteristics from cache or GPT-4
 */
export async function getWineCharacteristics(
  wineName: string,
  wineRegion?: string | null,
  grapeVariety?: string | null,
  wineType?: string | null
): Promise<WineCharacteristicsData | null> {
  try {
    const signature = normalizeWineSignature(wineName, wineRegion, grapeVariety);

    // 1. Check cache first
    const cached = await db.query.wineCharacteristicsCache.findFirst({
      where: eq(wineCharacteristicsCache.wineSignature, signature)
    });

    if (cached) {
      console.log(`[Wine Intel] Cache HIT for: ${signature}`);
      return {
        ...(cached.characteristics as WineCharacteristicsData),
        source: 'cache'
      };
    }

    console.log(`[Wine Intel] Cache MISS for: ${signature}`);

    // 2. If no cache and no OpenAI, return null
    if (!openai) {
      console.warn('[Wine Intel] OpenAI not configured, skipping characteristics lookup');
      return null;
    }

    // 3. Call GPT-4 for characteristics
    const characteristics = await fetchWineCharacteristicsFromGPT(
      wineName,
      wineRegion,
      grapeVariety,
      wineType
    );

    if (!characteristics) {
      return null;
    }

    // 4. Store in cache
    await db.insert(wineCharacteristicsCache).values({
      wineSignature: signature,
      characteristics: characteristics
    }).onConflictDoNothing();

    console.log(`[Wine Intel] Cached characteristics for: ${signature}`);

    return {
      ...characteristics,
      source: 'gpt4'
    };

  } catch (error) {
    console.error('[Wine Intel] Error getting characteristics:', error);
    return null;
  }
}

/**
 * Fetch wine characteristics from GPT-4
 */
async function fetchWineCharacteristicsFromGPT(
  wineName: string,
  wineRegion?: string | null,
  grapeVariety?: string | null,
  wineType?: string | null
): Promise<Omit<WineCharacteristicsData, 'source'> | null> {
  if (!openai) return null;

  try {
    // P1-004: Sanitize all user-controlled input before prompt interpolation
    const sanitizedName = sanitizeForPrompt(wineName, 150);
    const sanitizedRegion = sanitizeForPrompt(wineRegion, 100);
    const sanitizedGrape = sanitizeForPrompt(grapeVariety, 100);
    const sanitizedType = sanitizeForPrompt(wineType, 50);

    const prompt = `You are a sommelier. For the following wine, provide the TYPICAL characteristics on a 1-5 scale. This is not about a specific bottle but about what is generally expected from this wine style.

Wine: ${sanitizedName}
${sanitizedRegion ? `Region: ${sanitizedRegion}` : ''}
${sanitizedGrape ? `Grape: ${sanitizedGrape}` : ''}
${sanitizedType ? `Type: ${sanitizedType}` : ''}

Provide your response as JSON with these fields:
- sweetness: 1-5 (1=bone dry, 5=very sweet)
- acidity: 1-5 (1=flat, 5=very high/crisp)
- tannins: 1-5 (1=none/silky, 5=very high/grippy) - use 1 for white/rosé wines without tannins
- body: 1-5 (1=very light, 5=very full)
- style: A brief 3-5 word description of the wine style
- regionCharacter: A brief sentence about what makes wines from this region distinctive

If you're not familiar with this specific wine, provide characteristics typical for the grape variety and region mentioned. If you cannot determine the characteristics, respond with null.

Response format (JSON only):
{
  "sweetness": number,
  "acidity": number,
  "tannins": number,
  "body": number,
  "style": "string",
  "regionCharacter": "string"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2', // Using GPT-5.2 for wine intelligence
      messages: [
        {
          role: 'system',
          content: 'You are an expert sommelier providing wine characteristic assessments. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 300
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      return null;
    }

    const parsed = JSON.parse(response);

    // Validate the response
    if (parsed === null || parsed.sweetness === undefined) {
      return null;
    }

    return {
      sweetness: Math.min(5, Math.max(1, Math.round(parsed.sweetness))),
      acidity: Math.min(5, Math.max(1, Math.round(parsed.acidity))),
      tannins: Math.min(5, Math.max(1, Math.round(parsed.tannins))),
      body: Math.min(5, Math.max(1, Math.round(parsed.body))),
      style: String(parsed.style || 'Unknown style').substring(0, 100),
      regionCharacter: String(parsed.regionCharacter || 'No regional information available').substring(0, 200)
    };

  } catch (error) {
    console.error('[Wine Intel] GPT-4 error:', error);
    return null;
  }
}

/**
 * Attach wine characteristics to a tasting record (async, doesn't block)
 */
export async function attachCharacteristicsToTasting(tastingId: number): Promise<void> {
  try {
    // Get the tasting
    const tasting = await db.query.tastings.findFirst({
      where: eq(tastings.id, tastingId)
    });

    if (!tasting) {
      console.error(`[Wine Intel] Tasting ${tastingId} not found`);
      return;
    }

    // Skip if already has characteristics
    if (tasting.wineCharacteristics) {
      console.log(`[Wine Intel] Tasting ${tastingId} already has characteristics`);
      return;
    }

    // Get characteristics
    const characteristics = await getWineCharacteristics(
      tasting.wineName,
      tasting.wineRegion,
      tasting.grapeVariety,
      tasting.wineType
    );

    if (!characteristics) {
      console.log(`[Wine Intel] Could not get characteristics for tasting ${tastingId}`);
      return;
    }

    // Update tasting with characteristics
    await db.update(tastings)
      .set({ wineCharacteristics: characteristics })
      .where(eq(tastings.id, tastingId));

    console.log(`[Wine Intel] Attached characteristics to tasting ${tastingId}`);

  } catch (error) {
    console.error(`[Wine Intel] Error attaching characteristics to tasting ${tastingId}:`, error);
  }
}

/**
 * Check if wine intelligence is available
 */
export function isWineIntelligenceAvailable(): boolean {
  return !!openai;
}
