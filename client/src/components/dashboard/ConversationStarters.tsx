import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Wine, MapPin, Star, MessageCircle, Loader2 } from "lucide-react";
import type { ConversationStarters as ConversationStartersType } from "@shared/schema";

interface SommelierTips {
  preferenceProfile: string;
  redDescription: string;
  whiteDescription: string;
  questions: string[];
  priceGuidance: string;
}

interface ConversationStartersProps {
  email: string;
  hasSommelierFeedback: boolean;
}

export function ConversationStarters({ email, hasSommelierFeedback }: ConversationStartersProps) {
  // Always fetch conversation starters from DB (fast, reliable)
  const { data: starters, isLoading: startersLoading } = useQuery<ConversationStartersType>({
    queryKey: [`/api/dashboard/${email}/conversation-starters`],
    enabled: !!email,
  });

  // Optionally fetch GPT-enhanced tips (async enhancement)
  const { data: sommelierTips, isLoading: tipsLoading } = useQuery<SommelierTips>({
    queryKey: [`/api/dashboard/${email}/sommelier-tips`],
    enabled: !!email && hasSommelierFeedback,
    retry: false,
  });

  // Show loading only if we don't have starters yet
  if (startersLoading) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Mic className="w-5 h-5" />
            <span>What to Say at the Restaurant</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
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
          <CardTitle className="text-white flex items-center space-x-2">
            <Mic className="w-5 h-5" />
            <span>What to Say at the Restaurant</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-purple-200">
          <p className="text-lg font-medium mb-2">Start Tasting to Unlock Tips</p>
          <p className="text-sm text-purple-200/70">
            Complete some wine tastings and we'll give you personalized conversation starters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur-xl border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Mic className="w-5 h-5" />
          <span>What to Say at the Restaurant</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Always-available database-driven suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h4 className="text-white font-medium flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-purple-300" />
            Things You Can Say
          </h4>

          <div className="space-y-3">
            {/* Region suggestion */}
            {starters.favoriteRegion && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium">
                      "{starters.favoriteRegion.suggestion}"
                    </p>
                    <p className="text-purple-300 text-xs mt-1">
                      Based on {starters.favoriteRegion.wines} wines rated {starters.favoriteRegion.avgRating}/5 avg
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Grape suggestion */}
            {starters.favoriteGrape && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <Wine className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white text-sm font-medium">
                      "{starters.favoriteGrape.suggestion}"
                    </p>
                    <p className="text-purple-300 text-xs mt-1">
                      Based on {starters.favoriteGrape.wines} wines rated {starters.favoriteGrape.avgRating}/5 avg
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Signature wines section */}
        {(starters.signatureWines.red || starters.signatureWines.white) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <h4 className="text-white font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              Your Signature Wines
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {starters.signatureWines.red && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-300 text-xs uppercase tracking-wide mb-1">Top Red</p>
                  <p className="text-white text-sm font-medium">{starters.signatureWines.red.name}</p>
                  <p className="text-purple-300 text-xs">{starters.signatureWines.red.description}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-white text-xs">{starters.signatureWines.red.rating}/5</span>
                  </div>
                </div>
              )}

              {starters.signatureWines.white && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-yellow-300 text-xs uppercase tracking-wide mb-1">Top White</p>
                  <p className="text-white text-sm font-medium">{starters.signatureWines.white.name}</p>
                  <p className="text-purple-300 text-xs">{starters.signatureWines.white.description}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-white text-xs">{starters.signatureWines.white.rating}/5</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* GPT-enhanced tips (loads async, shows when available) */}
        {hasSommelierFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4 pt-4 border-t border-white/10"
          >
            <h4 className="text-white font-medium">Personalized Questions to Ask</h4>

            {tipsLoading ? (
              <div className="flex items-center gap-2 text-purple-300 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading AI-powered suggestions...</span>
              </div>
            ) : sommelierTips ? (
              <div className="space-y-4">
                {/* Preference profile */}
                <div className="text-purple-200 text-sm leading-relaxed">
                  <p>{sommelierTips.preferenceProfile}</p>
                  {sommelierTips.redDescription && <p className="mt-2">{sommelierTips.redDescription}</p>}
                  {sommelierTips.whiteDescription && <p className="mt-2">{sommelierTips.whiteDescription}</p>}
                </div>

                {/* Questions */}
                <ul className="space-y-2 text-purple-200">
                  {sommelierTips.questions.map((question, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <span className="text-white mt-0.5">•</span>
                      <span>"{question}"</span>
                    </li>
                  ))}
                </ul>

                {/* Price guidance */}
                {sommelierTips.priceGuidance && (
                  <p className="text-purple-300 text-sm italic">
                    {sommelierTips.priceGuidance}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-purple-300 text-sm">
                Continue tasting to get personalized AI-powered suggestions.
              </p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
