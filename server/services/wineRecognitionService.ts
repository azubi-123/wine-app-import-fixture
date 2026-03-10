/**
 * Wine Recognition Service
 * Extracts wine information from label images using GPT Vision
 */

import { openai } from "../lib/openai";

export interface RecognizedWine {
  wineName: string;
  wineRegion?: string;
  grapeVariety?: string;
  wineVintage?: number;
  wineType?: 'red' | 'white' | 'rosé' | 'sparkling' | 'dessert' | 'fortified' | 'orange';
  producer?: string;
  confidence: number;
}

export interface RecognitionResult {
  recognized: boolean;
  wine?: RecognizedWine;
  error?: string;
  message?: string;
}

// Raw GPT response type
interface GPTRecognitionResponse {
  recognized?: boolean;
  wineName?: string;
  producer?: string;
  wineRegion?: string;
  grapeVariety?: string;
  wineVintage?: string | number;
  wineType?: string;
  confidence?: number;
}

const VALID_WINE_TYPES = ['red', 'white', 'rosé', 'sparkling', 'dessert', 'fortified', 'orange'] as const;

/**
 * Recognize wine from an image buffer using GPT Vision
 */
export async function recognizeWineFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  originalFilename?: string
): Promise<RecognitionResult> {
  if (!openai) {
    return {
      recognized: false,
      error: "Wine recognition is not available (OpenAI not configured)"
    };
  }

  const base64Image = imageBuffer.toString('base64');
  console.log(`[Wine Recognition] Processing image: ${originalFilename || 'unknown'} (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      {
        role: 'system',
        content: `You are an expert sommelier analyzing wine label images. Extract wine information from the label.

Return a JSON object with these fields:
- wineName: Full wine name as it appears on the label
- producer: The winery/producer name
- wineRegion: Region/appellation (e.g., "Napa Valley", "Bordeaux", "Barossa Valley")
- grapeVariety: Primary grape variety - IMPORTANT: Even if not explicitly on the label, use your wine knowledge to infer the grape. For example:
  - Bourgogne Blanc = Chardonnay
  - Bourgogne Rouge = Pinot Noir
  - Chablis = Chardonnay
  - Sancerre = Sauvignon Blanc
  - Barolo = Nebbiolo
  - Chianti = Sangiovese
  - Rioja = Tempranillo (typically)
- wineVintage: Year as a number (null if non-vintage or not visible)
- wineType: One of: red, white, rosé, sparkling, dessert, fortified, orange
- confidence: Your confidence level 0-1 (1 = very confident)

If you cannot read the label clearly or it's not a wine label, return:
{ "recognized": false, "confidence": 0 }`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: 'Please analyze this wine label and extract the wine information.'
          }
        ]
      }
    ],
    max_completion_tokens: 500,
    response_format: { type: 'json_object' }
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    return {
      recognized: false,
      error: "No response from recognition service"
    };
  }

  const parsed = JSON.parse(response) as GPTRecognitionResponse;

  // Check if recognition failed
  if (parsed.recognized === false || (parsed.confidence ?? 0) < 0.3) {
    return {
      recognized: false,
      error: "Could not recognize wine from image"
    };
  }

  // Build recognized wine object
  const wine: RecognizedWine = {
    wineName: parsed.wineName || parsed.producer || 'Unknown Wine',
    wineRegion: parsed.wineRegion || undefined,
    grapeVariety: parsed.grapeVariety || undefined,
    wineVintage: parsed.wineVintage ? parseInt(String(parsed.wineVintage)) : undefined,
    wineType: VALID_WINE_TYPES.includes(parsed.wineType as typeof VALID_WINE_TYPES[number])
      ? (parsed.wineType as RecognizedWine['wineType'])
      : undefined,
    producer: parsed.producer || undefined,
    confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5))
  };

  console.log(`[Wine Recognition] Recognized: ${wine.wineName} (confidence: ${wine.confidence})`);

  return {
    recognized: true,
    wine,
    message: wine.confidence > 0.7
      ? "Wine recognized successfully"
      : "Wine recognized with low confidence - please verify details"
  };
}

/**
 * Check if wine recognition service is available
 */
export function isRecognitionAvailable(): boolean {
  return !!openai;
}
