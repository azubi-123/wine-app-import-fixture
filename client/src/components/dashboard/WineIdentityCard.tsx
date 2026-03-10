import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wine, Star, TrendingUp, Loader2, Sparkles } from "lucide-react";
import type { ConversationStarters, SommelierTips } from "@shared/schema";

interface UnifiedPreferences {
  sweetness: number | null;
  acidity: number | null;
  tannins: number | null;
  body: number | null;
  totalTastings: number;
  soloTastings: number;
  groupTastings: number;
}

interface WineIdentityCardProps {
  email: string;
  preferences?: UnifiedPreferences | null;
  hasSommelierFeedback: boolean;
}

// Helper to describe preference values
function describePreference(value: number | null, type: 'sweetness' | 'acidity' | 'tannins' | 'body'): string {
  if (value === null) return 'Exploring';

  const descriptors: Record<string, Record<string, string>> = {
    sweetness: {
      low: 'Dry wines',
      medium: 'Off-dry wines',
      high: 'Sweet wines'
    },
    acidity: {
      low: 'Soft & smooth',
      medium: 'Balanced acidity',
      high: 'Crisp & bright'
    },
    tannins: {
      low: 'Silky & soft',
      medium: 'Moderate grip',
      high: 'Bold & structured'
    },
    body: {
      low: 'Light-bodied',
      medium: 'Medium-bodied',
      high: 'Full-bodied'
    }
  };

  const level = value < 2.5 ? 'low' : value < 3.5 ? 'medium' : 'high';
  return descriptors[type][level];
}

export function WineIdentityCard({ email, preferences, hasSommelierFeedback }: WineIdentityCardProps) {
  // Fetch conversation starters (always available from DB)
  const { data: starters, isLoading: startersLoading } = useQuery<ConversationStarters>({
    queryKey: [`/api/dashboard/${email}/conversation-starters`],
    enabled: !!email,
  });

  // Optionally fetch GPT-enhanced tips for archetype
  const { data: sommelierTips, isLoading: tipsLoading } = useQuery<SommelierTips>({
    queryKey: [`/api/dashboard/${email}/sommelier-tips`],
    enabled: !!email && hasSommelierFeedback,
    retry: false,
  });

  // Show loading state
  if (startersLoading) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!starters || starters.quickFacts.totalWines === 0) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-300" />
            Your Wine Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-purple-200">
          <Wine className="w-12 h-12 mx-auto mb-4 text-purple-400/50" />
          <p className="text-lg font-medium mb-2">Your Identity is Forming</p>
          <p className="text-sm text-purple-200/70">
            Complete a few tastings to discover your wine personality.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get archetype from tips or generate fallback
  const archetype = sommelierTips?.wineArchetype || generateFallbackArchetype(starters, preferences);

  return (
    <Card className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 backdrop-blur-xl border-white/20 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          Your Wine Identity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Archetype Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4"
        >
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-lg px-4 py-2 mb-3">
            {tipsLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Discovering...
              </span>
            ) : (
              `The ${archetype}`
            )}
          </Badge>

          {sommelierTips?.preferenceProfile && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-purple-200 text-sm leading-relaxed max-w-md mx-auto mt-3"
            >
              {sommelierTips.preferenceProfile}
            </motion.p>
          )}
        </motion.div>

        {/* What Defines Your Taste */}
        {preferences && preferences.totalTastings > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <h4 className="text-white/80 text-sm font-medium uppercase tracking-wide">
              What Defines Your Taste
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Body', value: preferences.body, type: 'body' as const },
                { label: 'Tannins', value: preferences.tannins, type: 'tannins' as const },
                { label: 'Sweetness', value: preferences.sweetness, type: 'sweetness' as const },
                { label: 'Acidity', value: preferences.acidity, type: 'acidity' as const },
              ].map((pref) => (
                <div key={pref.label} className="bg-white/5 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <span className="text-purple-300 text-xs">{pref.label}</span>
                    {pref.value !== null && (
                      <span className="text-white/50 text-xs">{Number(pref.value).toFixed(1)}/5</span>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium mt-1">
                    {describePreference(pref.value, pref.type)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Signature Wines */}
        {(starters.signatureWines.red || starters.signatureWines.white) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <h4 className="text-white/80 text-sm font-medium uppercase tracking-wide">
              Your Signature Wines
            </h4>

            <div className="space-y-2">
              {starters.signatureWines.red && (
                <div className="flex items-center gap-3 bg-red-500/10 rounded-lg p-3">
                  <div className="p-2 bg-red-500/20 rounded-full">
                    <Wine className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {starters.signatureWines.red.name}
                    </p>
                    <p className="text-purple-300 text-xs truncate">
                      {starters.signatureWines.red.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-white text-sm">{starters.signatureWines.red.rating}</span>
                  </div>
                </div>
              )}

              {starters.signatureWines.white && (
                <div className="flex items-center gap-3 bg-yellow-500/10 rounded-lg p-3">
                  <div className="p-2 bg-yellow-500/20 rounded-full">
                    <Wine className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {starters.signatureWines.white.name}
                    </p>
                    <p className="text-purple-300 text-xs truncate">
                      {starters.signatureWines.white.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-white text-sm">{starters.signatureWines.white.rating}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Quick Stats Footer */}
        <div className="flex items-center justify-center gap-6 pt-2 border-t border-white/10">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{starters.quickFacts.totalWines}</p>
            <p className="text-purple-300 text-xs">Wines Tasted</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <p className="text-2xl font-bold text-white">{starters.quickFacts.avgRating}</p>
            </div>
            <p className="text-purple-300 text-xs">Avg Rating</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-white">{starters.quickFacts.preferredStyle}</p>
            <p className="text-purple-300 text-xs">Your Style</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Generate a fallback archetype when GPT is unavailable
function generateFallbackArchetype(
  starters: ConversationStarters,
  preferences?: UnifiedPreferences | null
): string {
  // Based on favorite grape/region
  if (starters.favoriteGrape) {
    const boldGrapes = ['Cabernet Sauvignon', 'Malbec', 'Syrah', 'Shiraz', 'Nebbiolo'];
    const elegantGrapes = ['Pinot Noir', 'Burgundy', 'Sangiovese', 'Grenache'];
    const crispGrapes = ['Sauvignon Blanc', 'Riesling', 'Pinot Grigio', 'Albariño'];
    const richWhites = ['Chardonnay', 'Viognier', 'Marsanne'];

    const grape = starters.favoriteGrape.grape;

    if (boldGrapes.some(g => grape.toLowerCase().includes(g.toLowerCase()))) {
      return 'Bold Explorer';
    }
    if (elegantGrapes.some(g => grape.toLowerCase().includes(g.toLowerCase()))) {
      return 'Elegant Traditionalist';
    }
    if (crispGrapes.some(g => grape.toLowerCase().includes(g.toLowerCase()))) {
      return 'Crisp Connoisseur';
    }
    if (richWhites.some(g => grape.toLowerCase().includes(g.toLowerCase()))) {
      return 'Rich Palate';
    }
  }

  // Based on preferences
  if (preferences) {
    if (preferences.body && preferences.body > 3.5) return 'Bold Explorer';
    if (preferences.acidity && preferences.acidity > 3.5) return 'Crisp Seeker';
    if (preferences.tannins && preferences.tannins > 3.5) return 'Structure Lover';
  }

  // Based on variety
  if (starters.quickFacts.totalWines > 15) return 'Curious Wanderer';
  if (starters.quickFacts.totalWines > 5) return 'Rising Enthusiast';

  return 'Wine Explorer';
}
