/**
 * Wine Recommendations Service
 * Phase 2: Provides "You liked X → Try Y" recommendations based on region and grape
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Recommendation with explanation
export interface WineRecommendation {
  name: string;
  region?: string;
  whyYoullLikeIt: string;  // Short tagline
  deeperExplanation: string;  // Expandable "Why?" text
}

// What the user liked
export interface LikedWine {
  name: string;
  region?: string;
  grape?: string;
  avgRating: number;
  descriptors: string[];
  wineCount: number;
}

// Full recommendation pair
export interface ExploreRecommendation {
  likedWine: LikedWine;
  tryNext: WineRecommendation;
  type: 'region' | 'grape';
}

/**
 * Static region recommendations
 * Maps a region to similar regions worth exploring
 */
export const REGION_RECOMMENDATIONS: Record<string, { regions: string[]; reasons: Record<string, { tagline: string; explanation: string }> }> = {
  // Argentina
  "Mendoza": {
    regions: ["Colchagua Valley", "Cahors", "Douro"],
    reasons: {
      "Colchagua Valley": {
        tagline: "Chile's bold reds rival Mendoza's intensity",
        explanation: "Chile's Colchagua Valley produces rich Carmenère and Cabernet that share Mendoza's ripe fruit character. The warm climate and Andean influence create similar full-bodied wines with smooth tannins."
      },
      "Cahors": {
        tagline: "France's original Malbec country",
        explanation: "Before Argentina, Cahors in Southwest France was Malbec's home. These wines are earthier and more tannic than Mendoza's fruit-forward style - a fascinating comparison for Malbec lovers."
      },
      "Douro": {
        tagline: "Portugal's bold, structured reds",
        explanation: "The Douro Valley produces powerful reds from indigenous grapes like Touriga Nacional. If you love Mendoza's intensity, Douro's concentrated, structured wines will feel familiar."
      }
    }
  },

  // California
  "Napa Valley": {
    regions: ["Stellenbosch", "Maipo Valley", "Bolgheri"],
    reasons: {
      "Stellenbosch": {
        tagline: "South Africa's answer to Napa",
        explanation: "Stellenbosch produces world-class Cabernet with similar power to Napa but often at better value. The Cape's unique terroir adds subtle earthy complexity."
      },
      "Maipo Valley": {
        tagline: "Chile's Cabernet capital",
        explanation: "Maipo Valley Cabernet rivals Napa in quality and intensity. You'll find the same bold cassis and structure you love, often with an herbaceous twist."
      },
      "Bolgheri": {
        tagline: "Italy's Super Tuscan playground",
        explanation: "Bolgheri pioneered Italian Cabernet blends. These 'Super Tuscans' combine Napa-like power with Italian elegance - the best of both worlds."
      }
    }
  },

  // France - Burgundy
  "Burgundy": {
    regions: ["Oregon Willamette Valley", "Marlborough", "Central Otago"],
    reasons: {
      "Oregon Willamette Valley": {
        tagline: "America's most Burgundian Pinot",
        explanation: "Oregon's cool climate produces Pinot Noir with Burgundy's elegance and earthy complexity. Many Burgundy producers have invested here - that's the ultimate endorsement."
      },
      "Marlborough": {
        tagline: "New Zealand's vibrant Pinot region",
        explanation: "While famous for Sauvignon Blanc, Marlborough's Pinot Noir offers bright cherry fruit and silky texture that Burgundy lovers appreciate."
      },
      "Central Otago": {
        tagline: "Pinot with alpine intensity",
        explanation: "The world's southernmost wine region produces Pinot with remarkable concentration. Expect Burgundy's elegance with added fruit depth."
      }
    }
  },

  // France - Bordeaux
  "Bordeaux": {
    regions: ["Margaret River", "Hawke's Bay", "Pauillac"],
    reasons: {
      "Margaret River": {
        tagline: "Australia's Bordeaux-style specialist",
        explanation: "Margaret River's maritime climate mirrors Bordeaux, producing elegant Cabernet-Merlot blends. Expect similar structure with Australian sunshine."
      },
      "Hawke's Bay": {
        tagline: "New Zealand's red wine gem",
        explanation: "Hawke's Bay excels at Bordeaux varieties, producing wines with classic structure and a distinctive New Zealand freshness."
      },
      "Pauillac": {
        tagline: "Bordeaux's heart of Cabernet",
        explanation: "If you love Bordeaux, exploring specific communes like Pauillac reveals incredible depth. These are among the world's most age-worthy reds."
      }
    }
  },

  // Italy
  "Tuscany": {
    regions: ["Rioja", "Piedmont", "Priorat"],
    reasons: {
      "Rioja": {
        tagline: "Spain's answer to Sangiovese",
        explanation: "Tempranillo shares Sangiovese's high acidity and food-friendliness. Rioja's oak aging adds vanilla and spice you might enjoy."
      },
      "Piedmont": {
        tagline: "Italy's other great red region",
        explanation: "If you love Tuscan Sangiovese, Piedmont's Nebbiolo offers similar acidity with added floral aromatics and firmer tannins. A natural progression."
      },
      "Priorat": {
        tagline: "Bold Spanish reds with character",
        explanation: "Priorat produces intense, mineral-driven Garnacha. Like Tuscany, it's a region where terroir truly shines through in concentrated, complex wines."
      }
    }
  },

  // Spain
  "Rioja": {
    regions: ["Tuscany", "Ribera del Duero", "Alentejo"],
    reasons: {
      "Tuscany": {
        tagline: "Italy's high-acid red specialist",
        explanation: "Sangiovese and Tempranillo are kindred spirits - both high-acid, cherry-driven, and perfect with food. Tuscany is a natural next step."
      },
      "Ribera del Duero": {
        tagline: "Tempranillo's bolder cousin",
        explanation: "Same grape, different expression. Ribera del Duero Tempranillo is more powerful and concentrated than Rioja - perfect when you want more intensity."
      },
      "Alentejo": {
        tagline: "Portugal's warm-climate charm",
        explanation: "Alentejo's rich, fruit-forward reds share Rioja's approachability. Portuguese varieties add exotic spice notes you might love."
      }
    }
  },

  // New Zealand
  "Marlborough": {
    regions: ["Loire Valley", "Sancerre", "Casablanca Valley"],
    reasons: {
      "Loire Valley": {
        tagline: "France's Sauvignon Blanc heartland",
        explanation: "Loire Sauvignon Blanc is more mineral and restrained than Marlborough's tropical style. It's a fascinating comparison that will deepen your appreciation."
      },
      "Sancerre": {
        tagline: "The original crisp white benchmark",
        explanation: "Sancerre set the standard for Sauvignon Blanc. These wines are leaner and more flinty - perfect for seeing where Marlborough got its inspiration."
      },
      "Casablanca Valley": {
        tagline: "Chile's cool-climate whites",
        explanation: "Casablanca produces vibrant Sauvignon Blanc with Marlborough's intensity but Chilean flair. Expect citrus, herbs, and excellent value."
      }
    }
  }
};

/**
 * Static grape recommendations
 * Maps a grape variety to similar varieties worth exploring
 */
export const GRAPE_RECOMMENDATIONS: Record<string, { grapes: string[]; reasons: Record<string, { tagline: string; explanation: string }> }> = {
  // Bold Reds
  "Malbec": {
    grapes: ["Carmenère", "Petit Verdot", "Tannat"],
    reasons: {
      "Carmenère": {
        tagline: "Same bold fruit, with a peppery kick",
        explanation: "Chile's signature grape shares Malbec's dark fruit intensity but adds green pepper and spice notes. It's like Malbec's more complex cousin."
      },
      "Petit Verdot": {
        tagline: "Malbec's inky, intense sibling",
        explanation: "Petit Verdot delivers even more color and concentration than Malbec. Usually a blending grape, but single-varietal versions are powerful and age-worthy."
      },
      "Tannat": {
        tagline: "Uruguay's bold answer to Malbec",
        explanation: "Tannat is bigger, bolder, and more tannic than Malbec. If you love intensity, this is your next frontier. Uruguay has mastered taming its tannins."
      }
    }
  },

  "Cabernet Sauvignon": {
    grapes: ["Merlot", "Cabernet Franc", "Carmenère"],
    reasons: {
      "Merlot": {
        tagline: "Cabernet's softer, plummier friend",
        explanation: "Merlot offers similar dark fruit but with plusher tannins and more immediate drinkability. Many great Bordeaux blend these two - try them side by side."
      },
      "Cabernet Franc": {
        tagline: "Cabernet's aromatic parent",
        explanation: "Cabernet Franc is actually Cabernet Sauvignon's parent grape. It's lighter, more aromatic, with violet and pepper notes. Loire Valley versions are exceptional."
      },
      "Carmenère": {
        tagline: "Bordeaux's lost grape, found in Chile",
        explanation: "Once grown in Bordeaux alongside Cabernet, Carmenère thrives in Chile. It shares Cabernet's structure but adds green pepper and smoky complexity."
      }
    }
  },

  // Elegant Reds
  "Pinot Noir": {
    grapes: ["Gamay", "Nebbiolo", "Mencía"],
    reasons: {
      "Gamay": {
        tagline: "Pinot's playful, fruity cousin",
        explanation: "Gamay (Beaujolais) shares Pinot's light body and bright acidity but is juicier and more immediately fun. It's Pinot Noir's party-loving relative."
      },
      "Nebbiolo": {
        tagline: "Pinot elegance with more structure",
        explanation: "Nebbiolo offers Pinot's aromatics and translucent color but with firmer tannins and remarkable aging potential. It's like Pinot Noir for when you're ready to level up."
      },
      "Mencía": {
        tagline: "Spain's hidden Pinot alternative",
        explanation: "Mencía from Bierzo has Pinot's red fruit elegance with a mineral edge. It's one of Spain's most exciting indigenous varieties - a sommelier favorite."
      }
    }
  },

  // Full-Bodied Whites
  "Chardonnay": {
    grapes: ["Viognier", "Marsanne", "Roussanne"],
    reasons: {
      "Viognier": {
        tagline: "Chardonnay's aromatic, peachy cousin",
        explanation: "Viognier is rich like Chardonnay but with explosive stone fruit and floral aromatics. If you love oaked Chardonnay's texture, Viognier adds perfume."
      },
      "Marsanne": {
        tagline: "Rhône's weighty white alternative",
        explanation: "Marsanne offers Chardonnay's full body with nutty, honeyed notes. It's less common but worth seeking out for its unique waxy texture."
      },
      "Roussanne": {
        tagline: "Elegant richness from the Rhône",
        explanation: "Roussanne combines Chardonnay's weight with herbal, tea-like complexity. Often blended with Marsanne, it adds finesse and aromatics."
      }
    }
  },

  // Crisp Whites
  "Sauvignon Blanc": {
    grapes: ["Albariño", "Grüner Veltliner", "Vermentino"],
    reasons: {
      "Albariño": {
        tagline: "Spain's coastal, mineral-driven white",
        explanation: "Albariño from Rías Baixas shares Sauvignon Blanc's crisp acidity but adds stone fruit and saline minerality. Perfect with seafood."
      },
      "Grüner Veltliner": {
        tagline: "Austria's food-friendly white",
        explanation: "Grüner has Sauvignon Blanc's herbal notes with a peppery, citrus edge. It's incredibly versatile with food - sommeliers love it."
      },
      "Vermentino": {
        tagline: "Mediterranean freshness in a glass",
        explanation: "Vermentino offers citrus and herbs like Sauvignon Blanc but with Italian sunshine. Sardinian and Corsican versions are particularly bright."
      }
    }
  },

  // Aromatic Whites
  "Riesling": {
    grapes: ["Gewürztraminer", "Chenin Blanc", "Torrontés"],
    reasons: {
      "Gewürztraminer": {
        tagline: "Riesling's exotic, spicy cousin",
        explanation: "If you love Riesling's aromatics, Gewürztraminer turns them up to eleven. Expect lychee, rose, and ginger in an explosively perfumed package."
      },
      "Chenin Blanc": {
        tagline: "Loire's versatile aromatic star",
        explanation: "Chenin Blanc spans dry to sweet like Riesling, with similar acidity but honeyed, lanolin notes. Loire Chenin is one of wine's great values."
      },
      "Torrontés": {
        tagline: "Argentina's aromatic white",
        explanation: "Torrontés has Riesling's floral lift with tropical fruit. It's Argentina's signature white - aromatic, refreshing, and perfect for warm weather."
      }
    }
  },

  // Italian Varieties
  "Sangiovese": {
    grapes: ["Tempranillo", "Grenache", "Barbera"],
    reasons: {
      "Tempranillo": {
        tagline: "Spain's high-acid, food-loving red",
        explanation: "Tempranillo and Sangiovese are kindred spirits - both high-acid, cherry-driven grapes that shine with food. Rioja is a natural next step."
      },
      "Grenache": {
        tagline: "Mediterranean warmth meets elegance",
        explanation: "Grenache offers Sangiovese's red fruit but with more richness and alcohol. Southern Rhône and Spanish Garnacha show its versatility."
      },
      "Barbera": {
        tagline: "Piedmont's everyday Italian red",
        explanation: "Barbera has even higher acidity than Sangiovese with juicy cherry fruit. It's Italy's most food-friendly red - perfect for pasta night."
      }
    }
  },

  // Syrah/Shiraz
  "Syrah": {
    grapes: ["Mourvèdre", "Petite Sirah", "Malbec"],
    reasons: {
      "Mourvèdre": {
        tagline: "Syrah's earthy, gamey partner",
        explanation: "Mourvèdre is often blended with Syrah in the Rhône. On its own, it's more savory and meaty - perfect if you love Syrah's darker side."
      },
      "Petite Sirah": {
        tagline: "Syrah's bolder American cousin",
        explanation: "Despite the name, Petite Sirah is even darker and more tannic than Syrah. If you want maximum intensity, this is your grape."
      },
      "Malbec": {
        tagline: "Argentina's answer to Shiraz",
        explanation: "Malbec shares Shiraz's bold fruit and smooth approachability. If you love Australian Shiraz, Mendoza Malbec is a natural crossover."
      }
    }
  }
};

/**
 * Get a region recommendation for a user's top region
 */
export function getRegionRecommendation(region: string): WineRecommendation | null {
  // Normalize region name for lookup
  const normalizedRegion = normalizeRegionName(region);

  const mapping = REGION_RECOMMENDATIONS[normalizedRegion];
  if (!mapping || mapping.regions.length === 0) {
    return null;
  }

  // Pick the first recommendation (could randomize or use preference matching)
  const recommendedRegion = mapping.regions[0];
  const reason = mapping.reasons[recommendedRegion];

  return {
    name: recommendedRegion,
    region: recommendedRegion,
    whyYoullLikeIt: reason.tagline,
    deeperExplanation: reason.explanation
  };
}

/**
 * Get a grape recommendation for a user's top grape
 */
export function getGrapeRecommendation(grape: string): WineRecommendation | null {
  // Normalize grape name for lookup
  const normalizedGrape = normalizeGrapeName(grape);

  const mapping = GRAPE_RECOMMENDATIONS[normalizedGrape];
  if (!mapping || mapping.grapes.length === 0) {
    return null;
  }

  // Pick the first recommendation
  const recommendedGrape = mapping.grapes[0];
  const reason = mapping.reasons[recommendedGrape];

  return {
    name: recommendedGrape,
    whyYoullLikeIt: reason.tagline,
    deeperExplanation: reason.explanation
  };
}

/**
 * Get all region recommendations for a user's top regions
 */
export function getAllRegionRecommendations(regions: LikedWine[]): ExploreRecommendation[] {
  const recommendations: ExploreRecommendation[] = [];

  for (const liked of regions) {
    if (!liked.region) continue;

    const normalizedRegion = normalizeRegionName(liked.region);
    const mapping = REGION_RECOMMENDATIONS[normalizedRegion];

    if (mapping && mapping.regions.length > 0) {
      const recommendedRegion = mapping.regions[0];
      const reason = mapping.reasons[recommendedRegion];

      recommendations.push({
        likedWine: liked,
        tryNext: {
          name: recommendedRegion,
          region: recommendedRegion,
          whyYoullLikeIt: reason.tagline,
          deeperExplanation: reason.explanation
        },
        type: 'region'
      });
    }
  }

  return recommendations;
}

/**
 * Get all grape recommendations for a user's top grapes
 */
export function getAllGrapeRecommendations(grapes: LikedWine[]): ExploreRecommendation[] {
  const recommendations: ExploreRecommendation[] = [];

  for (const liked of grapes) {
    if (!liked.grape) continue;

    const normalizedGrape = normalizeGrapeName(liked.grape);
    const mapping = GRAPE_RECOMMENDATIONS[normalizedGrape];

    if (mapping && mapping.grapes.length > 0) {
      const recommendedGrape = mapping.grapes[0];
      const reason = mapping.reasons[recommendedGrape];

      recommendations.push({
        likedWine: liked,
        tryNext: {
          name: recommendedGrape,
          whyYoullLikeIt: reason.tagline,
          deeperExplanation: reason.explanation
        },
        type: 'grape'
      });
    }
  }

  return recommendations;
}

/**
 * GPT fallback for generating recommendations when static mappings don't exist
 */
export async function generateGPTRecommendation(
  liked: LikedWine,
  type: 'region' | 'grape'
): Promise<WineRecommendation | null> {
  try {
    const prompt = type === 'region'
      ? `A wine enthusiast loves wines from ${liked.region}. They've rated ${liked.wineCount} wines from this region with an average rating of ${liked.avgRating}/5. Their taste notes suggest they enjoy: ${liked.descriptors.join(', ')}.

Recommend ONE region they should explore next. Provide:
1. The region name
2. A short tagline (under 10 words) explaining why they'll like it
3. A 2-3 sentence deeper explanation connecting their preferences to this new region

Return as JSON:
{
  "name": "Region Name",
  "whyYoullLikeIt": "Short tagline",
  "deeperExplanation": "Longer explanation"
}`
      : `A wine enthusiast loves ${liked.grape} wines. They've rated ${liked.wineCount} wines with this grape with an average rating of ${liked.avgRating}/5. Their taste notes suggest they enjoy: ${liked.descriptors.join(', ')}.

Recommend ONE grape variety they should explore next. Provide:
1. The grape name
2. A short tagline (under 10 words) explaining why they'll like it
3. A 2-3 sentence deeper explanation connecting their preferences to this new grape

Return as JSON:
{
  "name": "Grape Name",
  "whyYoullLikeIt": "Short tagline",
  "deeperExplanation": "Longer explanation"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 300,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content);
    return {
      name: result.name,
      region: type === 'region' ? result.name : undefined,
      whyYoullLikeIt: result.whyYoullLikeIt,
      deeperExplanation: result.deeperExplanation
    };
  } catch (error) {
    console.error('GPT recommendation generation failed:', error);
    return null;
  }
}

/**
 * Normalize region names for consistent lookup
 */
function normalizeRegionName(region: string): string {
  const normalized = region.trim();

  // Handle common variations
  const regionMappings: Record<string, string> = {
    "napa": "Napa Valley",
    "napa valley": "Napa Valley",
    "sonoma": "Sonoma",
    "sonoma coast": "Sonoma",
    "burgundy": "Burgundy",
    "bourgogne": "Burgundy",
    "bordeaux": "Bordeaux",
    "mendoza": "Mendoza",
    "argentina": "Mendoza",
    "tuscany": "Tuscany",
    "toscana": "Tuscany",
    "rioja": "Rioja",
    "marlborough": "Marlborough",
    "new zealand": "Marlborough",
    "willamette": "Oregon Willamette Valley",
    "willamette valley": "Oregon Willamette Valley",
    "oregon": "Oregon Willamette Valley"
  };

  const lowerRegion = normalized.toLowerCase();
  return regionMappings[lowerRegion] || normalized;
}

/**
 * Normalize grape names for consistent lookup
 */
function normalizeGrapeName(grape: string): string {
  const normalized = grape.trim();

  // Handle common variations
  const grapeMappings: Record<string, string> = {
    "cab": "Cabernet Sauvignon",
    "cabernet": "Cabernet Sauvignon",
    "cab sav": "Cabernet Sauvignon",
    "cabernet sauvignon": "Cabernet Sauvignon",
    "pinot": "Pinot Noir",
    "pinot noir": "Pinot Noir",
    "chard": "Chardonnay",
    "chardonnay": "Chardonnay",
    "sauv blanc": "Sauvignon Blanc",
    "sauvignon blanc": "Sauvignon Blanc",
    "malbec": "Malbec",
    "syrah": "Syrah",
    "shiraz": "Syrah",
    "riesling": "Riesling",
    "sangiovese": "Sangiovese",
    "tempranillo": "Tempranillo"
  };

  const lowerGrape = normalized.toLowerCase();
  return grapeMappings[lowerGrape] || normalized;
}
