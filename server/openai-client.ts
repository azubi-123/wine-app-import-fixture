import { openai } from './lib/openai';
import { sanitizeForPrompt, sanitizeWineInfo, sanitizeTastingText } from './lib/sanitize';

export interface TextAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // 1-10 scale (1 = very negative, 10 = very positive)
  confidence: number; // 0-1 scale
  keywords: string[];
  summary?: string;
}

export interface WineTextAnalysis {
  wineId: string;
  participantId: string;
  textResponses: Array<{
    slideId: string;
    questionTitle: string;
    textContent: string;
    analysis: TextAnalysisResult;
  }>;
  overallSentiment: TextAnalysisResult;
}

/**
 * Analyze sentiment of a single text response using ChatGPT
 */
export async function analyzeSingleTextSentiment(
  textContent: string,
  questionContext: string
): Promise<TextAnalysisResult> {
  try {
    // Return default if OpenAI not configured
    if (!openai) {
      return {
        sentiment: 'neutral',
        sentimentScore: 5,
        confidence: 0,
        keywords: [],
        summary: 'AI analysis unavailable - OPENAI_API_KEY not configured'
      };
    }

    // Skip empty or very short text
    if (!textContent || textContent.trim().length < 3) {
      return {
        sentiment: 'neutral',
        sentimentScore: 5,
        confidence: 0.2,
        keywords: [],
        summary: 'Text too short for analysis'
      };
    }

    // P1-004: Sanitize user input before prompt interpolation
    const sanitizedQuestion = sanitizeForPrompt(questionContext, 100);
    const sanitizedText = sanitizeTastingText(textContent);

    const prompt = `Analyze the sentiment of the following wine tasting note for the question "${sanitizedQuestion}":

Text: "${sanitizedText}"

Please provide:
1. Overall sentiment (positive, neutral, or negative)
2. A sentiment score from 1-10 where:
   - 1-3: Very negative (harsh criticism, strong dislike)
   - 4-5: Somewhat negative (mild criticism, lukewarm response)
   - 6: Neutral (balanced, objective description)
   - 7-8: Positive (appreciation, enjoyment expressed)
   - 9-10: Very positive (high praise, exceptional experience)
3. Confidence level (0-1) based on clarity of sentiment indicators
4. Key descriptive words/phrases (maximum 5)
5. A brief summary if the text is long (maximum 50 words)

Focus on wine-specific language and context. Consider that technical descriptions might be neutral even if they mention challenging aspects.

Respond in JSON format only:
{
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 1-10,
  "confidence": 0-1,
  "keywords": ["word1", "word2"],
  "summary": "brief summary if needed"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini", // Upgraded from gpt-3.5-turbo - better accuracy, still cheap
      messages: [
        {
          role: "system",
          content: "You are an expert wine sommelier and sentiment analysis specialist. Analyze wine tasting notes objectively, considering that wine appreciation is subjective and technical language may be neutral. Focus on emotional indicators and evaluative language rather than descriptive terminology. Provide accurate sentiment scores that reflect the writer's actual experience and satisfaction level."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 350,
      response_format: { type: "json_object" } // Ensure JSON response
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response with better error handling
    let analysis: TextAnalysisResult;
    try {
      analysis = JSON.parse(response) as TextAnalysisResult;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', response);
      throw new Error('Invalid JSON response from OpenAI');
    }
    
    // Validate and sanitize the response with improved bounds checking
    return {
      sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment) 
        ? analysis.sentiment as 'positive' | 'neutral' | 'negative'
        : 'neutral',
      sentimentScore: Math.min(10, Math.max(1, Math.round(analysis.sentimentScore || 5))),
      confidence: Math.min(1, Math.max(0, analysis.confidence || 0.5)),
      keywords: Array.isArray(analysis.keywords) 
        ? analysis.keywords.slice(0, 5).filter(k => typeof k === 'string' && k.length > 0)
        : [],
      summary: typeof analysis.summary === 'string' 
        ? analysis.summary.substring(0, 100) 
        : undefined
    };

  } catch (error) {
    console.error('Error analyzing text sentiment:', error);
    
    // Fallback analysis based on simple keyword detection
    return getFallbackSentimentAnalysis(textContent);
  }
}

/**
 * Analyze multiple text responses for a wine and provide overall sentiment
 */
export async function analyzeWineTextResponses(
  textResponses: Array<{
    slideId: string;
    questionTitle: string;
    textContent: string;
  }>,
  wineId: string,
  participantId: string
): Promise<WineTextAnalysis> {
  try {
    console.log(`🤖 Analyzing ${textResponses.length} text responses for wine ${wineId}`);

    // Analyze each text response individually
    const analyzedResponses = await Promise.all(
      textResponses.map(async (response) => ({
        ...response,
        analysis: await analyzeSingleTextSentiment(response.textContent, response.questionTitle)
      }))
    );

    // Calculate overall sentiment
    const totalScore = analyzedResponses.reduce((sum, r) => sum + r.analysis.sentimentScore, 0);
    const averageScore = totalScore / analyzedResponses.length;
    
    const overallSentiment = averageScore <= 4 ? 'negative' : 
                           averageScore >= 7 ? 'positive' : 'neutral';
    
    const averageConfidence = analyzedResponses.reduce((sum, r) => sum + r.analysis.confidence, 0) / analyzedResponses.length;
    
    // Collect all keywords
    const allKeywords = analyzedResponses.flatMap(r => r.analysis.keywords);
    const keywordCounts = allKeywords.reduce((acc: Record<string, number>, keyword) => {
      acc[keyword] = (acc[keyword] || 0) + 1;
      return acc;
    }, {});
    
    // Get most frequent keywords
    const topKeywords = Object.entries(keywordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([keyword]) => keyword);

    const overallAnalysis: TextAnalysisResult = {
      sentiment: overallSentiment,
      sentimentScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
      confidence: Math.round(averageConfidence * 100) / 100, // Round to 2 decimals
      keywords: topKeywords,
      summary: `Overall ${overallSentiment} sentiment based on ${analyzedResponses.length} responses`
    };

    return {
      wineId,
      participantId,
      textResponses: analyzedResponses,
      overallSentiment: overallAnalysis
    };

  } catch (error) {
    console.error('Error analyzing wine text responses:', error);
    
    // Return fallback analysis
    return {
      wineId,
      participantId,
      textResponses: textResponses.map(response => ({
        ...response,
        analysis: getFallbackSentimentAnalysis(response.textContent)
      })),
      overallSentiment: {
        sentiment: 'neutral',
        sentimentScore: 5,
        confidence: 0.3,
        keywords: [],
        summary: 'Analysis unavailable - using fallback'
      }
    };
  }
}

/**
 * Analyze multiple text responses and generate a comprehensive summary instead of scores
 */
export async function analyzeWineTextResponsesForSummary(
  textResponses: Array<{
    slideId: string;
    questionTitle: string;
    textContent: string;
  }>,
  wineId: string,
  participantId: string
): Promise<WineTextAnalysis> {
  try {
    console.log(`🤖 Generating text summaries for ${textResponses.length} responses for wine ${wineId}`);

    if (!isOpenAIConfigured()) {
      console.log('⚠️ OpenAI not configured, using fallback summary analysis');
      return getFallbackWineTextAnalysis(textResponses, wineId, participantId);
    }

    // Group responses by question/slide for better analysis
    const responsesBySlide = new Map<string, { questionTitle: string; responses: string[] }>();
    
    textResponses.forEach(response => {
      if (!responsesBySlide.has(response.slideId)) {
        responsesBySlide.set(response.slideId, {
          questionTitle: response.questionTitle,
          responses: []
        });
      }
      responsesBySlide.get(response.slideId)!.responses.push(response.textContent);
    });

    // Analyze each question separately to generate meaningful summaries
    const analyzedResponses: Array<{
      slideId: string;
      questionTitle: string;
      textContent: string;
      analysis: TextAnalysisResult;
    }> = [];

    for (const [slideId, { questionTitle, responses }] of Array.from(responsesBySlide.entries())) {
      if (responses.length === 0) continue;
      
      const combinedText = responses.join('\n---\n');
      const analysis = await analyzeTextForSummary(combinedText, questionTitle);
      
      analyzedResponses.push({
        slideId,
        questionTitle,
        textContent: combinedText,
        analysis
      });
    }

    // Generate overall summary from all responses
    const allTexts = textResponses.map(r => r.textContent).filter(text => text.trim()).join('\n\n');
    const overallAnalysis = await analyzeTextForSummary(allTexts, "Overall wine experience");
    
    return {
      wineId,
      participantId,
      textResponses: analyzedResponses,
      overallSentiment: {
        sentiment: overallAnalysis.sentiment,
        sentimentScore: overallAnalysis.sentimentScore,
        confidence: overallAnalysis.confidence,
        keywords: overallAnalysis.keywords,
        summary: overallAnalysis.summary || "Overall wine experience analysis"
      }
    };

  } catch (error) {
    console.error('❌ Error in analyzeWineTextResponsesForSummary:', error);
    
    // Return fallback analysis
    return getFallbackWineTextAnalysis(textResponses, wineId, participantId);
  }
}

/**
 * Analyze text content and generate a comprehensive summary instead of numerical scores
 */
async function analyzeTextForSummary(textContent: string, questionContext: string): Promise<TextAnalysisResult> {
  // Return default if OpenAI not configured
  if (!openai) {
    return {
      sentiment: 'neutral',
      sentimentScore: 5,
      confidence: 0,
      keywords: [],
      summary: 'AI analysis unavailable - OPENAI_API_KEY not configured'
    };
  }

  if (!textContent.trim()) {
    return {
      sentiment: 'neutral',
      sentimentScore: 5,
      confidence: 0.1,
      keywords: [],
      summary: 'No response provided'
    };
  }

  try {
    // P1-004: Sanitize user input before prompt interpolation
    const sanitizedQuestion = sanitizeForPrompt(questionContext, 100);
    const sanitizedText = sanitizeTastingText(textContent);

    const prompt = `Analyze the following wine tasting responses for the question "${sanitizedQuestion}":

"${sanitizedText}"

Please provide a comprehensive written summary that captures the essence of these responses. Focus on:

1. Common themes and observations mentioned by participants
2. Overall sentiment and emotional tone expressed
3. Key descriptive elements about the wine characteristics
4. Notable patterns or consensus among responses
5. Specific wine attributes highlighted (aroma, taste, texture, finish, etc.)

Create a narrative summary that synthesizes the main points and provides meaningful insights about what participants experienced collectively.

Please provide:
1. Overall sentiment (positive, neutral, or negative)
2. A sentiment score from 1-10 (for internal processing only)
3. Confidence level (0-1) based on clarity and consistency
4. Key descriptive words/phrases (maximum 8 most relevant terms)
5. A comprehensive summary (50-150 words) that tells the story of the collective tasting experience

Focus on wine-specific language and create a narrative that would be valuable for understanding the group's tasting experience.

Respond in JSON format only:
{
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 1-10,
  "confidence": 0-1,
  "keywords": ["word1", "word2", "word3"],
  "summary": "comprehensive narrative summary of the responses focusing on wine characteristics and collective experience"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini", // Upgraded from gpt-3.5-turbo - better accuracy, still cheap
      messages: [
        {
          role: "system",
          content: "You are an expert wine sommelier and text analyst specializing in synthesizing wine tasting notes. Your task is to create coherent, informative summaries that capture the collective tasting experience from multiple participants. Focus on creating meaningful narrative summaries that highlight consensus, interesting observations, and key wine characteristics. Avoid numerical evaluations and instead provide rich, descriptive insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 600, // Increased for comprehensive summaries
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    let analysis: TextAnalysisResult;
    try {
      analysis = JSON.parse(response) as TextAnalysisResult;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', response);
      throw new Error('Invalid JSON response from OpenAI');
    }
    
    // Validate and sanitize the response
    return {
      sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment) 
        ? analysis.sentiment as 'positive' | 'neutral' | 'negative'
        : 'neutral',
      sentimentScore: Math.min(10, Math.max(1, Math.round(analysis.sentimentScore || 5))),
      confidence: Math.min(1, Math.max(0, analysis.confidence || 0.5)),
      keywords: Array.isArray(analysis.keywords) 
        ? analysis.keywords.slice(0, 8).filter(k => typeof k === 'string' && k.length > 0)
        : [],
      summary: typeof analysis.summary === 'string' 
        ? analysis.summary.substring(0, 500) // Allow longer summaries
        : 'Analysis could not be completed'
    };

  } catch (error) {
    console.error('❌ Error in text summary analysis:', error);
    
    // Return fallback analysis
    return getFallbackSentimentAnalysis(textContent);
  }
}

/**
 * Fallback text analysis that generates summaries when OpenAI is unavailable
 */
function getFallbackWineTextAnalysis(
  textResponses: Array<{
    slideId: string;
    questionTitle: string;
    textContent: string;
  }>,
  wineId: string,
  participantId: string
): WineTextAnalysis {
  const analyzedResponses = textResponses.map(response => ({
    slideId: response.slideId,
    questionTitle: response.questionTitle,
    textContent: response.textContent,
    analysis: getFallbackTextSummary(response.textContent, response.questionTitle)
  }));

  // Create overall summary
  const allTexts = textResponses.map(r => r.textContent).filter(text => text.trim());
  const overallSummary = getFallbackTextSummary(allTexts.join(' '), 'Overall wine experience');

  return {
    wineId,
    participantId,
    textResponses: analyzedResponses,
    overallSentiment: overallSummary
  };
}

/**
 * Generate a fallback text summary using keyword analysis
 */
function getFallbackTextSummary(textContent: string, questionContext: string): TextAnalysisResult {
  if (!textContent.trim()) {
    return {
      sentiment: 'neutral',
      sentimentScore: 5,
      confidence: 0.1,
      keywords: [],
      summary: 'No response provided for this question.'
    };
  }

  const fallbackAnalysis = getFallbackSentimentAnalysis(textContent);
  
  // Create a basic summary based on the text content
  const words = textContent.split(/\s+/).filter(word => word.length > 2);
  const summary = words.length > 20 
    ? `Participants provided detailed responses for "${questionContext}". Key themes include: ${fallbackAnalysis.keywords.join(', ')}. Overall sentiment appears ${fallbackAnalysis.sentiment}.`
    : `Brief responses were provided for "${questionContext}" with ${fallbackAnalysis.sentiment} sentiment noted.`;

  return {
    ...fallbackAnalysis,
    summary: summary.substring(0, 200) // Keep summaries concise
  };
}

/**
 * Fallback sentiment analysis using enhanced keyword matching
 */
export function getFallbackSentimentAnalysis(textContent: string): TextAnalysisResult {
  const positiveWords = [
    'excellent', 'amazing', 'wonderful', 'great', 'love', 'beautiful', 'perfect', 'fantastic', 
    'delicious', 'smooth', 'elegant', 'complex', 'rich', 'vibrant', 'balanced', 'exceptional',
    'outstanding', 'impressive', 'lovely', 'refreshing', 'crisp', 'fruity', 'aromatic',
    'well-structured', 'harmonious', 'sophisticated', 'refined', 'remarkable', 'divine',
    'exquisite', 'superb', 'magnificent', 'brilliant', 'marvelous'
  ];
  
  const negativeWords = [
    'terrible', 'awful', 'hate', 'disgusting', 'bad', 'poor', 'unpleasant', 'harsh', 
    'bitter', 'sour', 'off', 'flat', 'bland', 'boring', 'disappointing', 'weak',
    'thin', 'watery', 'metallic', 'corked', 'oxidized', 'musty', 'stale', 'dull',
    'unbalanced', 'cloying', 'overpowering', 'astringent', 'acidic', 'rough'
  ];
  
  const neutralWords = [
    'dry', 'sweet', 'medium', 'light', 'dark', 'red', 'white', 'oak', 'tannin',
    'acidity', 'finish', 'nose', 'palate', 'grape', 'vintage', 'region'
  ];
  
  const text = textContent.toLowerCase();
  const words = text.split(/\s+/);
  
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  const neutralCount = neutralWords.filter(word => text.includes(word)).length;
  
  // Enhanced scoring algorithm
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  let sentimentScore = 5;
  let confidence = 0.3; // Base confidence for fallback
  
  // Calculate total emotional indicators
  const totalEmotionalWords = positiveCount + negativeCount;
  const textLength = words.length;
  
  if (totalEmotionalWords > 0) {
    // Increase confidence based on emotional word density
    confidence = Math.min(0.7, 0.3 + (totalEmotionalWords / textLength) * 2);
    
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      sentimentScore = Math.min(10, 5 + (positiveCount * 1.5) + (positiveCount - negativeCount) * 0.5);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      sentimentScore = Math.max(1, 5 - (negativeCount * 1.5) - (negativeCount - positiveCount) * 0.5);
    } else {
      // Equal positive and negative - stay neutral but adjust slightly
      sentimentScore = neutralCount > 2 ? 5 : 4.5;
    }
  }
  
  // Extract found keywords
  const foundKeywords = [
    ...positiveWords.filter(word => text.includes(word)),
    ...negativeWords.filter(word => text.includes(word))
  ].slice(0, 5);
  
  return {
    sentiment,
    sentimentScore: Math.round(sentimentScore * 10) / 10, // Round to 1 decimal
    confidence: Math.round(confidence * 100) / 100, // Round to 2 decimals
    keywords: foundKeywords,
    summary: `Fallback analysis based on ${totalEmotionalWords} sentiment indicators`
  };
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// ===========================================
// NEXT BOTTLE RECOMMENDATIONS (Solo Tastings)
// ===========================================

import type { TastingRecommendation, TastingResponses, PriceRange } from "@shared/schema";

interface WineContext {
  wineName: string;
  grapeVariety?: string;
  wineRegion?: string;
  wineType?: string;
}

// Interface for raw recommendation from OpenAI response (before validation)
interface RawRecommendation {
  type?: string;
  wineName?: string;
  reason?: string;
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  askFor?: string;
}

interface RecommendationsResponse {
  recommendations?: RawRecommendation[];
}

/**
 * Generate AI-powered next bottle recommendations based on user's tasting responses
 */
export async function generateNextBottleRecommendations(
  tastedWine: WineContext,
  responses: TastingResponses
): Promise<TastingRecommendation[]> {
  if (!openai) {
    console.warn('OpenAI not configured - returning default recommendations');
    return getDefaultRecommendations(tastedWine);
  }

  try {
    // P1-004: Sanitize all user-controlled input
    const sanitized = sanitizeWineInfo({
      name: tastedWine.wineName,
      region: tastedWine.wineRegion,
      grapeVariety: tastedWine.grapeVariety,
      wineType: tastedWine.wineType
    });
    const sanitizedNotes = sanitizeTastingText(responses.overall?.notes);
    const sanitizedFlavors = (responses.taste?.flavors || [])
      .slice(0, 10)
      .map(f => sanitizeForPrompt(String(f), 30));

    const prompt = `A user just tasted ${sanitized.name} (${sanitized.grapeVariety} from ${sanitized.region}).

Their tasting responses:
- Sweetness: ${responses.taste?.sweetness || 'Not recorded'}/5
- Acidity: ${responses.taste?.acidity || 'Not recorded'}/5
- Tannins: ${responses.taste?.tannins || 'Not recorded'}/5
- Body: ${responses.taste?.body || 'Not recorded'}/5
- Flavors: ${JSON.stringify(sanitizedFlavors)}
- Overall rating: ${responses.overall?.rating || 'Not recorded'}/10
- Notes: "${sanitizedNotes || 'No notes provided'}"

Based on what they enjoyed (and didn't enjoy), suggest 3 wines to try next:

1. **Similar style** - Another wine they'll likely enjoy for the same reasons
2. **Step up** - A more interesting/complex version of what they liked
3. **Exploration** - Something different that might expand their palate

For each recommendation include:
- Wine name/type (e.g., "Willamette Valley Pinot Noir")
- Why you're recommending it based on their responses
- Price range to expect (min and max in USD)
- What to ask for at a wine shop

Return as JSON with this exact structure:
{
  "recommendations": [
    {
      "type": "similar",
      "wineName": "...",
      "reason": "...",
      "priceRange": { "min": 15, "max": 30, "currency": "USD" },
      "askFor": "..."
    },
    {
      "type": "step_up",
      "wineName": "...",
      "reason": "...",
      "priceRange": { "min": 30, "max": 50, "currency": "USD" },
      "askFor": "..."
    },
    {
      "type": "exploration",
      "wineName": "...",
      "reason": "...",
      "priceRange": { "min": 20, "max": 40, "currency": "USD" },
      "askFor": "..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `You are a friendly sommelier helping someone discover their next favorite wine.

Your job is to give them specific, actionable recommendations they can actually find and buy:
- Name real wines or specific grape + region combinations (e.g., "Marlborough Sauvignon Blanc" not just "a white wine")
- Keep prices realistic and accessible - most recommendations should be $15-35
- Make "askFor" something natural they could actually say out loud: "Do you have any Malbec from Argentina?" not wine-jargon

For the three recommendation types:
1. SIMILAR: Something they'll definitely like for the same reasons. Safe, satisfying choice.
2. STEP UP: A more interesting version - better quality or more character, worth spending a bit more.
3. EXPLORATION: Something that expands their horizons. New grape OR new region (not both at once). Should feel like an adventure, not a risk.

Base everything on their actual responses - what they rated highly, what flavors they noted, what they said in their notes.
Make them feel like you really understood what they liked about this wine.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('No content in OpenAI response, using default recommendations');
      return getDefaultRecommendations(tastedWine);
    }

    const parsed: RecommendationsResponse = JSON.parse(content);

    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      console.warn('Invalid recommendations format, using defaults');
      return getDefaultRecommendations(tastedWine);
    }

    // Validate and return recommendations
    return parsed.recommendations.map((rec: RawRecommendation): TastingRecommendation => ({
      type: (rec.type && ['similar', 'step_up', 'exploration'].includes(rec.type))
        ? rec.type as 'similar' | 'step_up' | 'exploration'
        : 'similar',
      wineName: rec.wineName || 'Unknown Wine',
      reason: rec.reason || 'Based on your tasting preferences',
      priceRange: {
        min: rec.priceRange?.min || 15,
        max: rec.priceRange?.max || 30,
        currency: rec.priceRange?.currency || 'USD'
      },
      askFor: rec.askFor || `Ask for ${rec.wineName || 'a similar wine'}`
    }));

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return getDefaultRecommendations(tastedWine);
  }
}

/**
 * Default recommendations when AI is unavailable
 */
function getDefaultRecommendations(wine: WineContext): TastingRecommendation[] {
  const isRed = wine.wineType === 'red' ||
    ['cabernet', 'pinot noir', 'merlot', 'syrah', 'shiraz', 'nebbiolo', 'sangiovese'].some(
      v => wine.grapeVariety?.toLowerCase().includes(v)
    );

  if (isRed) {
    return [
      {
        type: 'similar',
        wineName: 'Côtes du Rhône Red',
        reason: 'A versatile red blend with similar fruit-forward character and approachable tannins',
        priceRange: { min: 12, max: 20, currency: 'USD' },
        askFor: 'Ask for a Côtes du Rhône red blend, something fruit-forward and easy drinking'
      },
      {
        type: 'step_up',
        wineName: 'Châteauneuf-du-Pape',
        reason: 'A more complex version of the Rhône style with depth and aging potential',
        priceRange: { min: 35, max: 60, currency: 'USD' },
        askFor: 'Ask for a Châteauneuf-du-Pape, preferably from a recent vintage'
      },
      {
        type: 'exploration',
        wineName: 'Oregon Pinot Noir',
        reason: 'Try something lighter and more elegant to explore the other end of the red wine spectrum',
        priceRange: { min: 20, max: 35, currency: 'USD' },
        askFor: 'Ask for a Willamette Valley Pinot Noir, something with bright fruit and earthy notes'
      }
    ];
  }

  // White/other wines
  return [
    {
      type: 'similar',
      wineName: 'Marlborough Sauvignon Blanc',
      reason: 'A crisp, refreshing white with vibrant acidity and citrus notes',
      priceRange: { min: 12, max: 18, currency: 'USD' },
      askFor: 'Ask for a Marlborough Sauvignon Blanc from New Zealand'
    },
    {
      type: 'step_up',
      wineName: 'Pouilly-Fumé',
      reason: 'A more refined Loire Valley Sauvignon Blanc with mineral complexity',
      priceRange: { min: 25, max: 40, currency: 'USD' },
      askFor: 'Ask for a Pouilly-Fumé or Sancerre from the Loire Valley'
    },
    {
      type: 'exploration',
      wineName: 'Grüner Veltliner',
      reason: 'Explore Austrian whites - crisp, peppery, and wonderfully food-friendly',
      priceRange: { min: 15, max: 25, currency: 'USD' },
      askFor: 'Ask for an Austrian Grüner Veltliner, something fresh and zippy'
    }
  ];
}
