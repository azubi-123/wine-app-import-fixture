import { motion } from "framer-motion";
import {
  Lightbulb,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import type { WineCharacteristicsData } from "@shared/schema";

// Actionable recommendations based on preference signals
const PREFERENCE_RECOMMENDATIONS: Record<string, { higher: string; lower: string }> = {
  sweetness: {
    higher: "You might enjoy off-dry styles like Riesling Kabinett, Vouvray, or Gewürztraminer",
    lower: "You might prefer bone-dry wines like Chablis, Muscadet, or Albariño"
  },
  acidity: {
    higher: "You might enjoy crisp, zesty wines like Sancerre, Grüner Veltliner, or Vermentino",
    lower: "You might prefer softer, rounder wines like oaked Chardonnay or Viognier"
  },
  tannins: {
    higher: "You might enjoy bold reds like Cabernet Sauvignon, Nebbiolo, or Tannat",
    lower: "You might prefer silky reds like Pinot Noir, Gamay, or Grenache"
  },
  body: {
    higher: "You might enjoy full-bodied wines like Châteauneuf-du-Pape, Amarone, or oaked Chardonnay",
    lower: "You might prefer lighter styles like Beaujolais, Vinho Verde, or Prosecco"
  }
};

export interface UserTasteRatings {
  sweetness?: number;
  acidity?: number;
  tannins?: number;
  body?: number;
}

export interface WineInsightsProps {
  characteristics: WineCharacteristicsData;
  userRatings: UserTasteRatings;
  overallRating?: number;
  compact?: boolean;
}

export function WineInsights({
  characteristics,
  userRatings,
  overallRating,
  compact = false
}: WineInsightsProps) {
  // Generate insights by comparing user perception to typical characteristics
  const generateInsights = () => {
    const insights: Array<{
      type: 'higher' | 'lower' | 'match';
      label: string;
      description: string;
      recommendation?: string;
    }> = [];

    const comparisons = [
      { key: 'sweetness', label: 'Sweetness', low: 'drier', high: 'sweeter' },
      { key: 'acidity', label: 'Acidity', low: 'softer', high: 'more acidic' },
      { key: 'tannins', label: 'Tannins', low: 'smoother', high: 'more tannic' },
      { key: 'body', label: 'Body', low: 'lighter', high: 'fuller' }
    ];

    comparisons.forEach(({ key, label, low, high }) => {
      const userValue = userRatings[key as keyof UserTasteRatings];
      const wineValue = characteristics[key as keyof WineCharacteristicsData];

      if (typeof userValue === 'number' && typeof wineValue === 'number') {
        const diff = userValue - wineValue;
        const recs = PREFERENCE_RECOMMENDATIONS[key];

        if (diff >= 1) {
          insights.push({
            type: 'higher',
            label,
            description: `You found this wine ${high} than typical`,
            recommendation: recs?.higher
          });
        } else if (diff <= -1) {
          insights.push({
            type: 'lower',
            label,
            description: `You found this wine ${low} than typical`,
            recommendation: recs?.lower
          });
        }
      }
    });

    return insights;
  };

  const insights = generateInsights();
  const hasUserRatings = Object.values(userRatings).some(v => typeof v === 'number');

  if (!hasUserRatings) return null;

  const likedWine = overallRating && overallRating >= 4;

  if (compact) {
    return (
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg p-4 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span className="text-white font-medium text-sm">Wine Intelligence</span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
          <div className="text-center">
            <div className="text-white/60">Sweet</div>
            <div className="text-white">{characteristics.sweetness}/5</div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Acid</div>
            <div className="text-white">{characteristics.acidity}/5</div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Tannin</div>
            <div className="text-white">{characteristics.tannins}/5</div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Body</div>
            <div className="text-white">{characteristics.body}/5</div>
          </div>
        </div>

        {insights.length > 0 && (
          <div className="space-y-2">
            {insights.slice(0, 2).map((insight, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs ${
                  insight.type === 'higher'
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-blue-500/10 border border-blue-500/20'
                }`}
              >
                <div className="flex items-center gap-1">
                  {insight.type === 'higher' ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-blue-400" />
                  )}
                  <span className="text-white/90">{insight.description}</span>
                </div>
                {insight.recommendation && (
                  <p className="text-white/60 ml-4 mt-1">→ {insight.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {likedWine && insights.length === 0 && (
          <p className="text-white/70 text-xs">
            Your perception matches this wine's typical profile - {characteristics.style?.toLowerCase()} wines might be your style!
          </p>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/20"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Wine Intelligence</h3>
          <p className="text-white/60 text-sm">{characteristics.style}</p>
        </div>
      </div>

      {/* Typical Characteristics */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg">
        <p className="text-white/80 text-sm mb-2 font-medium">Typical Profile:</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Sweetness:</span>
            <span className="text-white">{characteristics.sweetness}/5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Acidity:</span>
            <span className="text-white">{characteristics.acidity}/5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Tannins:</span>
            <span className="text-white">{characteristics.tannins}/5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Body:</span>
            <span className="text-white">{characteristics.body}/5</span>
          </div>
        </div>
      </div>

      {/* Regional Character */}
      {characteristics.regionCharacter && (
        <p className="text-white/70 text-sm italic mb-4">
          "{characteristics.regionCharacter}"
        </p>
      )}

      {/* Insights with Actionable Recommendations */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <p className="text-white/80 text-sm font-medium">What This Tells Us:</p>
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                insight.type === 'higher'
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-blue-500/10 border border-blue-500/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {insight.type === 'higher' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-white/90 text-sm">{insight.description}</span>
              </div>
              {insight.recommendation && (
                <p className="text-white/70 text-sm ml-6 mt-1">
                  → {insight.recommendation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Liked wine - reinforce the style */}
      {likedWine && insights.length === 0 && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-white/90 text-sm">
            You rated this wine highly and your perception matches its typical profile.
            <span className="text-purple-300"> It seems like {characteristics.style?.toLowerCase()} wines might be your style!</span>
          </p>
        </div>
      )}

      {!likedWine && insights.length === 0 && (
        <p className="text-white/60 text-sm">
          Your perception aligns with this wine's typical characteristics.
        </p>
      )}
    </motion.div>
  );
}
