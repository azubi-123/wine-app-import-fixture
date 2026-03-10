import { requireOpenAI } from "../lib/openai";
import type { WineOption } from "@shared/schema";

interface WineRequirements {
  wineType?: string;
  region?: string;
  grapeVariety?: string;
  anyWine?: boolean;
}

interface GeneratedShoppingGuide {
  wineOptions: WineOption[];
}

/**
 * Generate budget + splurge wine options with shopping guidance
 * for a chapter's wine requirements.
 */
export async function generateShoppingGuide(
  wineRequirements: WineRequirements,
  chapterTitle: string,
  chapterDescription?: string
): Promise<GeneratedShoppingGuide> {
  const openai = requireOpenAI();

  const systemPrompt = `You are a wine shop advisor helping someone find the right bottle for a wine tasting lesson.

Generate TWO wine options for the given wine requirements:

1. **Budget option** (level: "budget"): An accessible, affordable bottle under $25. Include:
   - description: A short, appealing name for this option (e.g., "Cotes du Ventoux Red")
   - askFor: What to say at the wine shop (conversational, helpful)
   - priceRange: { min, max } in USD (max should be ≤ 25)
   - labelTips: What to look for on the bottle label to identify it
   - substitutes: 2-3 alternative wines that work if they can't find it
   - exampleProducers: 2-3 specific producer names
   - whyThisWine: One sentence on why this is a good budget choice for learning

2. **Splurge option** (level: "splurge"): A premium bottle worth treating yourself to. Include:
   - description: A short, appealing name (e.g., "Chateauneuf-du-Pape")
   - askFor: What to say at the wine shop
   - NO priceRange (omit entirely — the user will see the price in the shop)
   - labelTips: What to look for on the label
   - substitutes: 2-3 alternatives
   - exampleProducers: 2-3 specific producer names
   - whyThisWine: One sentence on why this is worth the splurge

Be accurate with pricing. The budget option should genuinely be findable under $25.
Be practical with askFor — write what a real person would say to a shop employee.
Label tips should describe actual text/imagery found on real bottles.`;

  const userPrompt = `Chapter: ${chapterTitle}
${chapterDescription ? `Description: ${chapterDescription}` : ''}
Wine requirements:
- Type: ${wineRequirements.wineType || 'any'}
- Region: ${wineRequirements.region || 'any'}
- Grape: ${wineRequirements.grapeVariety || 'any'}

Generate budget and splurge options as JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1500
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content);

  // Normalize the response — GPT may wrap in different ways
  const options: WineOption[] = [];

  if (parsed.budget) {
    options.push({
      ...parsed.budget,
      level: 'budget',
      priceRange: parsed.budget.priceRange
        ? { ...parsed.budget.priceRange, currency: 'USD' }
        : { min: 10, max: 25, currency: 'USD' }
    });
  }

  if (parsed.splurge) {
    const { priceRange: _omit, ...splurgeData } = parsed.splurge;
    options.push({
      ...splurgeData,
      level: 'splurge'
    });
  }

  // Fallback if GPT used an array format
  if (options.length === 0 && Array.isArray(parsed.wineOptions)) {
    for (const opt of parsed.wineOptions) {
      if (opt.level === 'budget') {
        options.push({
          ...opt,
          priceRange: opt.priceRange
            ? { ...opt.priceRange, currency: 'USD' }
            : { min: 10, max: 25, currency: 'USD' }
        });
      } else if (opt.level === 'splurge') {
        const { priceRange: _omit, ...rest } = opt;
        options.push({ ...rest, level: 'splurge' });
      }
    }
  }

  return { wineOptions: options };
}
