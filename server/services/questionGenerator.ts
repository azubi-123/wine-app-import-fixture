/**
 * AI Question Generation Service
 * Sprint 5: Generates wine-specific tasting questions
 *
 * Key Principle: Questions focus on 5 core components to help users understand their preferences:
 * 1. Fruit flavors - primary taste driver
 * 2. Secondary flavors - herbal, floral, earthy notes (complexity indicators)
 * 3. Tertiary flavors - oak, vanilla, aged characteristics (winemaking influence)
 * 4. Body - weight and texture in the mouth
 * 5. Acidity - brightness and crispness
 *
 * Questions are conversational and focused on what the user LIKES, not testing knowledge.
 */

import { z } from 'zod';
import type { GeneratedQuestion, WineRecognitionResult, Chapter, TastingLevel, QuestionCategory } from "@shared/schema";
import { openai } from "../lib/openai";
import { sanitizeForPrompt, sanitizeWineInfo } from "../lib/sanitize";

// Zod schema for structured output from GPT
const QuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  description: z.string().optional()
});

const GeneratedQuestionSchema = z.object({
  id: z.string(),
  category: z.enum(['fruit', 'secondary', 'tertiary', 'body', 'acidity', 'tannins', 'overall']),
  questionType: z.enum(['multiple_choice', 'scale', 'text']),
  title: z.string(),
  description: z.string().optional(),
  options: z.array(QuestionOptionSchema).optional(),
  allowMultiple: z.boolean().optional(),
  scaleMin: z.number().optional(),
  scaleMax: z.number().optional(),
  scaleLabels: z.tuple([z.string(), z.string()]).optional(),
  wineContext: z.string().optional(),
  // Three-beat loop fields
  beatType: z.enum(['notice', 'rate']).optional(),
  educationalNote: z.string().optional(),
  preferenceDirection: z.enum(['more', 'less']).optional()
});

const QuestionSetSchema = z.object({
  questions: z.array(GeneratedQuestionSchema)
});

// Interface for raw GPT response before transformation
interface RawGPTQuestion {
  id: string;
  category: string;
  questionType: string;
  title: string;
  description?: string;
  options?: Array<{ id: string; text: string; description?: string }>;
  allowMultiple?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  wineContext?: string;
  beatType?: 'notice' | 'rate';
  educationalNote?: string;
  preferenceDirection?: 'more' | 'less';
}

// Fallback questions when AI generation fails — three-beat structure (notice + rate pairs)
// Covers 5 core traits + overall. Used when OpenAI is unavailable.
const FALLBACK_QUESTIONS: GeneratedQuestion[] = [
  // --- FRUIT (notice + rate) ---
  {
    id: 'fruit-notice',
    category: 'fruit',
    questionType: 'multiple_choice',
    beatType: 'notice',
    title: 'What fruit flavors jump out at you?',
    description: 'Swirl the glass gently and take a sip. Don\'t overthink it — what\'s the first thing that comes to mind?',
    educationalNote: 'Wine gets its fruit flavors from the grape itself and fermentation. Red wines often show berry and cherry notes, while whites lean toward citrus and stone fruit.',
    options: [
      { id: 'red-berries', text: 'Red berries (cherry, raspberry, strawberry)' },
      { id: 'dark-berries', text: 'Dark berries (blackberry, blueberry, plum)' },
      { id: 'citrus', text: 'Citrus (lemon, lime, grapefruit)' },
      { id: 'stone-fruit', text: 'Stone fruit (peach, apricot, nectarine)' },
      { id: 'tropical', text: 'Tropical (pineapple, mango, passion fruit)' }
    ],
    allowMultiple: true
  },
  {
    id: 'fruit-rate',
    category: 'fruit',
    questionType: 'scale',
    beatType: 'rate',
    title: 'How much do you enjoy these fruit flavors?',
    description: 'Would you want more or less fruit intensity in your next wine?',
    preferenceDirection: 'more',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Not my style', 'Love them']
  },
  // --- BODY (notice + rate) ---
  {
    id: 'body-notice',
    category: 'body',
    questionType: 'scale',
    beatType: 'notice',
    title: 'How heavy does the wine feel in your mouth?',
    description: 'Think of it like milk: skim milk is light-bodied, whole milk is medium, cream is full-bodied. Swish it around — does it feel light and watery, or thick and rich?',
    educationalNote: 'This weight is called "body." It comes from alcohol, sugar, and extract in the wine. Full-bodied wines feel richer and coat your mouth more.',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Light and delicate', 'Full and rich']
  },
  {
    id: 'body-rate',
    category: 'body',
    questionType: 'scale',
    beatType: 'rate',
    title: 'Do you enjoy this body style?',
    preferenceDirection: 'more',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Prefer lighter wines', 'Prefer fuller wines']
  },
  // --- ACIDITY (notice + rate) ---
  {
    id: 'acidity-notice',
    category: 'acidity',
    questionType: 'scale',
    beatType: 'notice',
    title: 'How much zing or crispness do you notice?',
    description: 'Pay attention to whether your mouth waters after you swallow. More watering = more acidity. Think of it like lemon juice — some wines have a lot of that bright, crisp feeling.',
    educationalNote: 'That bright, mouth-watering sensation is acidity. It\'s what makes wine feel refreshing rather than flat. Higher acidity wines pair beautifully with food.',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Soft and smooth', 'Bright and zingy']
  },
  {
    id: 'acidity-rate',
    category: 'acidity',
    questionType: 'scale',
    beatType: 'rate',
    title: 'Do you enjoy this level of acidity?',
    preferenceDirection: 'more',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Prefer softer wines', 'Love the zing']
  },
  // --- TANNINS (notice + rate) ---
  {
    id: 'tannins-notice',
    category: 'tannins',
    questionType: 'scale',
    beatType: 'notice',
    title: 'How much does this wine dry out your mouth?',
    description: 'Focus on your gums and the sides of your tongue. Do they feel smooth, or is there a drying, slightly rough sensation — like over-steeped tea?',
    educationalNote: 'That drying feeling is called tannin — it comes from grape skins, seeds, and sometimes oak barrels. Tannins add structure and help wines age well.',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Silky smooth', 'Grippy and drying']
  },
  {
    id: 'tannins-rate',
    category: 'tannins',
    questionType: 'scale',
    beatType: 'rate',
    title: 'Do you enjoy this level of tannin?',
    description: 'Some people love that grippy feeling, others prefer smoother wines.',
    preferenceDirection: 'more',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Prefer smoother', 'Love the grip']
  },
  // --- AROMA (notice + rate) ---
  {
    id: 'secondary-notice',
    category: 'secondary',
    questionType: 'multiple_choice',
    beatType: 'notice',
    title: 'Beyond the fruit, do you notice any other aromas?',
    description: 'Give the glass another swirl and take a deeper sniff. These "secondary" aromas add complexity — they\'re what make wines interesting.',
    educationalNote: 'These are called secondary and tertiary aromas. They come from fermentation (floral, herbal notes) and aging (vanilla, toast, leather). They\'re what make each wine unique.',
    options: [
      { id: 'herbal', text: 'Herbal (mint, eucalyptus, bell pepper)' },
      { id: 'floral', text: 'Floral (rose, violet, honeysuckle)' },
      { id: 'earthy', text: 'Earthy (mushroom, soil, forest floor)' },
      { id: 'oaky', text: 'Oaky (vanilla, toast, baking spices)' },
      { id: 'none', text: 'Not really noticing any' }
    ],
    allowMultiple: true
  },
  {
    id: 'secondary-rate',
    category: 'secondary',
    questionType: 'scale',
    beatType: 'rate',
    title: 'How do you feel about these extra aromas?',
    description: 'Do they add to your enjoyment or distract from the fruit?',
    preferenceDirection: 'more',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Prefer simpler wines', 'Love the complexity']
  },
  // --- OVERALL (no beatType — standard ending) ---
  {
    id: 'overall-rating',
    category: 'overall',
    questionType: 'scale',
    title: 'Overall, how much do you enjoy this wine?',
    description: 'Think about the full experience — the smell, the taste, the aftertaste. Would you be happy if someone poured you another glass?',
    scaleMin: 1,
    scaleMax: 10,
    scaleLabels: ['Not for me', 'Love it!']
  },
  {
    id: 'overall-buy-again',
    category: 'overall',
    questionType: 'multiple_choice',
    title: 'Would you buy this wine again?',
    options: [
      { id: 'yes', text: 'Yes, definitely!' },
      { id: 'maybe', text: 'Maybe, at the right price' },
      { id: 'no', text: 'No, not for me' }
    ]
  },
  {
    id: 'overall-notes',
    category: 'overall',
    questionType: 'text',
    title: 'Any thoughts you want to remember about this wine?',
    description: 'What stood out? What would you tell a friend about it?'
  }
];

/**
 * Generate wine-specific tasting questions focused on 6 core components
 *
 * @param wineInfo - Recognition result from photographed wine
 * @param chapter - Chapter context for additional guidance
 * @param userLevel - User's tasting level (intro, intermediate, advanced)
 * @returns Array of generated questions focused on understanding preferences
 */
export async function generateQuestionsForWine(
  wineInfo: WineRecognitionResult,
  chapter?: Chapter,
  userLevel: TastingLevel = 'intro'
): Promise<GeneratedQuestion[]> {
  // Return fallback questions if OpenAI is not configured
  if (!openai) {
    console.log('[QuestionGenerator] OpenAI not configured, returning fallback questions');
    return getFallbackQuestions();
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2', // Complex reasoning for quality questions
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(userLevel)
        },
        {
          role: 'user',
          content: getUserPrompt(wineInfo, chapter, userLevel)
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'wine_questions',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    category: { type: 'string', enum: ['fruit', 'secondary', 'tertiary', 'body', 'acidity', 'tannins', 'overall'] },
                    questionType: { type: 'string', enum: ['multiple_choice', 'scale', 'text'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    options: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          text: { type: 'string' },
                          description: { type: 'string' }
                        },
                        required: ['id', 'text'],
                        additionalProperties: false
                      }
                    },
                    allowMultiple: { type: 'boolean' },
                    scaleMin: { type: 'number' },
                    scaleMax: { type: 'number' },
                    scaleLabels: { type: 'array', items: { type: 'string' } },
                    wineContext: { type: 'string' },
                    beatType: { type: 'string', enum: ['notice', 'rate'] },
                    educationalNote: { type: 'string' },
                    preferenceDirection: { type: 'string', enum: ['more', 'less'] }
                  },
                  required: ['id', 'category', 'questionType', 'title'],
                  additionalProperties: false
                }
              }
            },
            required: ['questions'],
            additionalProperties: false
          }
        }
      },
      max_completion_tokens: userLevel === 'intro' ? 3000 : userLevel === 'intermediate' ? 3500 : 4500
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('No content in GPT response, using fallback questions');
      return FALLBACK_QUESTIONS;
    }

    const parsed = JSON.parse(content);

    // Validate and transform the response
    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      console.warn('Invalid questions array in response, using fallback');
      return FALLBACK_QUESTIONS;
    }

    // Transform scaleLabels from array to tuple if needed
    const questions: GeneratedQuestion[] = (parsed.questions as RawGPTQuestion[]).map((q) => ({
      ...q,
      category: q.category as GeneratedQuestion['category'],
      questionType: q.questionType as GeneratedQuestion['questionType'],
      scaleLabels: q.scaleLabels && q.scaleLabels.length >= 2
        ? [q.scaleLabels[0], q.scaleLabels[1]] as [string, string]
        : undefined
    }));

    // Ensure we have all core components represented
    const categories = new Set(questions.map(q => q.category));
    // tannins intentionally excluded — AI decides based on wine type (reds/rosé only)
    const requiredCategories: QuestionCategory[] = ['fruit', 'secondary', 'tertiary', 'body', 'acidity', 'overall'];

    for (const cat of requiredCategories) {
      if (!categories.has(cat)) {
        // Add all fallback questions for missing category (notice + rate pair)
        const fallbacks = FALLBACK_QUESTIONS.filter(q => q.category === cat);
        for (const fallback of fallbacks) {
          questions.push(fallback);
        }
      }
    }

    // Sort by category order (6 core components + overall)
    const categoryOrder: Record<string, number> = { fruit: 0, secondary: 1, tertiary: 2, body: 3, acidity: 4, tannins: 5, overall: 6 };
    questions.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);

    return questions;

  } catch (error) {
    console.error('Error generating questions:', error);
    return FALLBACK_QUESTIONS;
  }
}

function getSystemPrompt(userLevel: TastingLevel): string {
  const traitCount = userLevel === 'intro' ? 5 : userLevel === 'intermediate' ? 6 : 8;

  return `You are a friendly sommelier helping someone discover what they like about wine.
Your goal is to ask questions that help THEM understand their own preferences through a "notice → learn → rate" pattern.

## Three-Beat Question Structure

For each sensory characteristic you choose, generate a PAIRED set of two questions:

1. **Notice question** (beatType: "notice"): Guide the user to observe something specific.
   - Include an "educationalNote" field: 1-2 sentences explaining what they just noticed, shown AFTER they answer.
   - Example question: "Does this wine make your mouth feel dry or smooth?"
   - Example educationalNote: "That dryness is called tannin — it comes from grape skins and adds structure to the wine."

2. **Rate question** (beatType: "rate"): Ask if they enjoyed that characteristic and whether they'd want more or less.
   - Include "preferenceDirection" field: "more" if high score means they want more of it, "less" if high means they want less.
   - Example: "Did you enjoy that feeling? Would you want more or less tannin in your next wine?"

## Trait Selection

Pick the ${traitCount} most interesting/relevant characteristics for THIS specific wine. Choose from:
- fruit, secondary, tertiary, body, acidity, tannins (tannins REQUIRED for red/rosé, SKIP for white/sparkling)

Each trait gets exactly 2 questions (notice + rate), so you'll generate ${traitCount * 2} trait questions.

## Required Ending Questions (category: "overall", no beatType needed)

After all trait pairs, ALWAYS include these 3 questions:
1. Overall rating (scale 1-10, id: "overall-rating")
2. "Would you buy this wine again?" (multiple_choice, id: "overall-buy-again", options: "Yes, definitely!", "Maybe, at the right price", "No, not for me")
3. Final notes (text, id: "overall-notes")

## Canonical IDs

Use these exact ID patterns for reliable downstream mapping:
- \`{trait}-notice\` and \`{trait}-rate\` for each trait (e.g., "tannins-notice", "tannins-rate", "acidity-notice", "acidity-rate")
- \`overall-rating\`, \`overall-buy-again\`, \`overall-notes\` for ending questions

## Scale Rules

- ALL scale questions use 1-10 range
- Scale labels should reflect preference, not technical measurement
- For notice questions: labels describe the spectrum (e.g., "Silky smooth" to "Grippy and drying")
- For rate questions: labels describe enjoyment (e.g., "Not my style" to "Love it")

## Language Level: ${userLevel}

${userLevel === 'intro' ? `- Use everyday language and sensory comparisons (e.g., "like skim milk vs whole milk" for body)
- Keep educationalNotes simple and encouraging — no jargon
- Frame everything as discovery: "Let's find out what you like"
- Descriptions should include HOW to taste for each characteristic` : ''}
${userLevel === 'intermediate' ? `- Can use some wine terminology, but explain it briefly
- educationalNotes can introduce proper terms alongside everyday language
- Ask about specific flavor notes and regional characteristics
- Include "why" in rate questions: "Why did you enjoy/not enjoy this?"` : ''}
${userLevel === 'advanced' ? `- Use wine terminology freely — the user knows it
- educationalNotes can discuss terroir, winemaking techniques, vintage influence
- Explore nuance: balance, complexity, aging potential, finish length
- Rate questions can ask about context: "Would you pair this with food or drink it on its own?"` : ''}

## Question Types

- multiple_choice: provide 4-5 options specific to this wine type
- scale: ALWAYS 1-10 range
- text: use only for overall-notes

CRITICAL: This is preference discovery, not a quiz. Never ask "identify" or "name" — always ask "do you notice" and "do you enjoy."`;
}

function getUserPrompt(wineInfo: WineRecognitionResult, chapter?: Chapter, userLevel?: TastingLevel): string {
  // P1-004: Sanitize all user-controlled input before prompt interpolation
  const sanitized = sanitizeWineInfo({
    name: wineInfo.name,
    region: wineInfo.region,
    grapeVarieties: wineInfo.grapeVarieties,
    vintage: wineInfo.vintage,
    producer: wineInfo.producer
  });
  const varietal = sanitized.grapeVariety;

  // Determine wine type for tannins guidance
  const isRed = wineInfo.grapeVarieties?.some(g => {
    const lower = g.toLowerCase();
    return ['cabernet', 'merlot', 'pinot noir', 'syrah', 'shiraz', 'malbec', 'sangiovese',
            'nebbiolo', 'tempranillo', 'grenache', 'zinfandel', 'barbera', 'mourvèdre',
            'primitivo', 'petite sirah', 'carmenere', 'tannat', 'gamay', 'pinotage'].some(r => lower.includes(r));
  });

  let prompt = `Generate three-beat tasting questions for this wine:

Wine: ${sanitized.name}
Varietal: ${varietal}
Region: ${sanitized.region}
Wine Type: ${isRed ? 'Red' : 'White/Other'} (${isRed ? 'include tannins trait' : 'skip tannins trait'})
${sanitized.vintage !== 'NV' ? `Vintage: ${sanitized.vintage}` : ''}
${sanitized.producer ? `Producer: ${sanitized.producer}` : ''}`;

  if (chapter) {
    const chapterTitle = sanitizeForPrompt(chapter.title, 100);
    const chapterDesc = sanitizeForPrompt(chapter.description, 200);
    prompt += `

Learning Context:
Chapter: ${chapterTitle}
${chapterDesc ? `Description: ${chapterDesc}` : ''}`;
  }

  // Add varietal-specific trait suggestions
  prompt += `

For ${varietal}, prioritize these traits in your notice+rate pairs:`;

  const varietalLower = varietal.toLowerCase();
  if (varietalLower.includes('sangiovese') || varietalLower.includes('chianti')) {
    prompt += `
- Cherry/red fruit notes (fruit), tomato-like acidity (acidity), earthy characteristics (secondary), tannin structure (tannins)`;
  } else if (varietalLower.includes('pinot noir')) {
    prompt += `
- Red fruit vs earth balance (fruit + secondary), mushroom/forest notes (tertiary), silky tannins (tannins), acidity (acidity)`;
  } else if (varietalLower.includes('cabernet')) {
    prompt += `
- Dark fruit intensity (fruit), green/herbal notes (secondary), oak influence (tertiary), tannin grip (tannins), body (body)`;
  } else if (varietalLower.includes('chardonnay')) {
    prompt += `
- Citrus vs tropical fruit (fruit), oak/butter influence (tertiary), minerality (secondary), body (body), acidity (acidity)`;
  } else if (varietalLower.includes('sauvignon blanc')) {
    prompt += `
- Citrus and tropical notes (fruit), grassy/herbal character (secondary), minerality (secondary), acidity (acidity)`;
  } else if (varietalLower.includes('riesling')) {
    prompt += `
- Sweetness perception (fruit), stone fruit notes (fruit), petrol/mineral (secondary), acidity (acidity)`;
  } else {
    prompt += `
- Choose the most interesting characteristics of ${varietal} from ${sanitized.region}`;
  }

  if (sanitized.region && sanitized.region !== 'Unknown Region') {
    prompt += `
- Include at least one trait pair that highlights what makes ${sanitized.region} wines distinctive`;
  }

  prompt += `

Remember: Each trait gets exactly 2 questions (notice + rate) with educationalNote on the notice question.
End with overall-rating, overall-buy-again, and overall-notes.`;

  return prompt;
}

/**
 * Get fallback questions if generation fails
 */
export function getFallbackQuestions(): GeneratedQuestion[] {
  return FALLBACK_QUESTIONS;
}
