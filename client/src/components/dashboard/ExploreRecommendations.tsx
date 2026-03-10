import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, MapPin, Wine, ChevronDown, ChevronUp, Star, Loader2, ArrowRight } from "lucide-react";
import type { ExploreRecommendation } from "@shared/schema";

interface ExploreRecommendationsProps {
  email: string;
}

export function ExploreRecommendations({ email }: ExploreRecommendationsProps) {
  const [viewType, setViewType] = useState<'region' | 'grape'>('region');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // Fetch recommendations based on current view type
  const { data: recommendations, isLoading, error } = useQuery<ExploreRecommendation[]>({
    queryKey: [`/api/dashboard/${email}/explore-recommendations`, viewType],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/${email}/explore-recommendations?type=${viewType}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },
    enabled: !!email,
  });

  // Toggle expanded state for a card
  const toggleExpand = (index: number) => {
    setExpandedCard(expandedCard === index ? null : index);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-300" />
            Explore Your Palate
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Error or empty state
  if (error || !recommendations || recommendations.length === 0) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-300" />
            Explore Your Palate
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Compass className="w-12 h-12 text-purple-400/50 mx-auto mb-4" />
          <p className="text-lg font-medium text-white mb-2">
            Keep Tasting to Unlock Recommendations
          </p>
          <p className="text-sm text-purple-200/70">
            Rate a few more wines (3.5+ stars) and we'll suggest new regions and grapes to explore.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border-white/20 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-300" />
            Explore Your Palate
          </CardTitle>

          {/* Toggle between Region and Grape views */}
          <div className="flex bg-white/10 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewType('region')}
              className={`text-xs px-3 py-1 h-7 ${
                viewType === 'region'
                  ? 'bg-white/20 text-white'
                  : 'text-purple-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <MapPin className="w-3 h-3 mr-1" />
              By Region
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewType('grape')}
              className={`text-xs px-3 py-1 h-7 ${
                viewType === 'grape'
                  ? 'bg-white/20 text-white'
                  : 'text-purple-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Wine className="w-3 h-3 mr-1" />
              By Grape
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Header row */}
        <div className="grid grid-cols-2 gap-4 text-xs uppercase tracking-wide text-purple-300 px-2">
          <span>You Liked</span>
          <span>Try Next</span>
        </div>

        {/* Recommendation cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewType}
            initial={{ opacity: 0, x: viewType === 'region' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: viewType === 'region' ? 20 : -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {recommendations.map((rec, index) => (
              <motion.div
                key={`${rec.type}-${rec.likedWine.name}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 rounded-xl overflow-hidden"
              >
                {/* Main recommendation row */}
                <div className="grid grid-cols-2 gap-4 p-4">
                  {/* You Liked */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {viewType === 'region' ? (
                        <MapPin className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Wine className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="text-white font-medium text-sm">
                        {viewType === 'region' ? rec.likedWine.region : rec.likedWine.grape}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span className="text-purple-200 text-xs">{rec.likedWine.avgRating}/5</span>
                      </div>
                      <span className="text-purple-300/60 text-xs">
                        {rec.likedWine.wineCount} {rec.likedWine.wineCount === 1 ? 'wine' : 'wines'}
                      </span>
                    </div>

                    {rec.likedWine.descriptors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {rec.likedWine.descriptors.slice(0, 2).map((desc, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-purple-300 border-purple-500/30 bg-purple-500/10"
                          >
                            {desc}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Try Next */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-purple-400" />
                      <span className="text-white font-medium text-sm">
                        {rec.tryNext.name}
                      </span>
                    </div>

                    <p className="text-purple-200 text-xs leading-relaxed">
                      {rec.tryNext.whyYoullLikeIt}
                    </p>

                    {/* Why? button */}
                    <button
                      onClick={() => toggleExpand(index)}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {expandedCard === index ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          <span>Hide details</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          <span>Why?</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded explanation */}
                <AnimatePresence>
                  {expandedCard === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                          <p className="text-purple-100 text-sm leading-relaxed">
                            {rec.tryNext.deeperExplanation}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Footer hint */}
        <p className="text-center text-purple-300/60 text-xs pt-2">
          Recommendations based on your highest-rated {viewType === 'region' ? 'regions' : 'grape varieties'}
        </p>
      </CardContent>
    </Card>
  );
}
