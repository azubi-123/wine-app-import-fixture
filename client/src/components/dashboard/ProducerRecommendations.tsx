import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Wine, MapPin, DollarSign, Loader2, Store, AlertCircle } from "lucide-react";
import type { ProducerRecommendationsResponse } from "@shared/schema";

interface ProducerRecommendationsProps {
  email: string;
}

const PRICE_TIERS = [
  { id: 'budget', label: '$15-25', description: 'Great everyday wines' },
  { id: 'mid', label: '$25-50', description: 'Special occasion wines' },
  { id: 'premium', label: '$50+', description: 'Splurge-worthy bottles' },
] as const;

export function ProducerRecommendations({ email }: ProducerRecommendationsProps) {
  const [priceTier, setPriceTier] = useState<'budget' | 'mid' | 'premium'>('budget');

  // Fetch recommendations for current price tier
  const { data, isLoading, error, isFetching } = useQuery<ProducerRecommendationsResponse>({
    queryKey: [`/api/dashboard/${email}/producer-recommendations`, priceTier],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/${email}/producer-recommendations?tier=${priceTier}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },
    enabled: !!email,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  // Loading state (initial load)
  if (isLoading) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            Wines to Try
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-300 animate-spin mb-3" />
          <p className="text-purple-200 text-sm">Finding wines that match your taste...</p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            Wines to Try
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-purple-400/50 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Couldn't Load Recommendations</p>
          <p className="text-purple-200/70 text-sm">Try again in a moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 backdrop-blur-xl border-white/20 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            Wines to Try
          </CardTitle>

          {/* Price tier toggle */}
          <div className="flex bg-white/10 rounded-lg p-1">
            {PRICE_TIERS.map((tier) => (
              <Button
                key={tier.id}
                variant="ghost"
                size="sm"
                onClick={() => setPriceTier(tier.id)}
                className={`text-xs px-3 py-1 h-7 ${
                  priceTier === tier.id
                    ? 'bg-emerald-500/30 text-white'
                    : 'text-purple-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {tier.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Tier description */}
        <p className="text-purple-300/70 text-xs mt-2">
          {PRICE_TIERS.find(t => t.id === priceTier)?.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Loading overlay for tier switch */}
        {isFetching && !isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mr-2" />
            <span className="text-purple-200 text-sm">Updating recommendations...</span>
          </div>
        )}

        {/* Recommendations list */}
        {!isFetching && data?.recommendations && (
          <AnimatePresence mode="wait">
            <motion.div
              key={priceTier}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {data.recommendations.map((rec, index) => (
                <motion.div
                  key={`${rec.producerName}-${rec.wineName}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 rounded-xl p-4 space-y-3"
                >
                  {/* Header: Wine name and price */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">
                        {rec.wineName}
                      </h4>
                      <p className="text-purple-300 text-sm truncate">
                        {rec.producerName}
                      </p>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex-shrink-0">
                      <DollarSign className="w-3 h-3 mr-0.5" />
                      {rec.estimatedPrice}
                    </Badge>
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 text-purple-300">
                      <Wine className="w-3 h-3" />
                      <span>{rec.grapeVariety}</span>
                    </div>
                    <span className="text-purple-500">•</span>
                    <div className="flex items-center gap-1 text-purple-300">
                      <MapPin className="w-3 h-3" />
                      <span>{rec.region}</span>
                    </div>
                  </div>

                  {/* Why this wine */}
                  <p className="text-purple-200 text-sm leading-relaxed">
                    {rec.whyForYou}
                  </p>

                  {/* Tasting notes */}
                  {rec.tastingNotes && (
                    <p className="text-purple-300/70 text-xs italic">
                      {rec.tastingNotes}
                    </p>
                  )}

                  {/* Where to buy */}
                  {rec.whereToBuy && rec.whereToBuy.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                      <Store className="w-3 h-3 text-purple-400" />
                      <span className="text-purple-300 text-xs">
                        Find at: {rec.whereToBuy.join(', ')}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Empty state */}
        {!isFetching && (!data?.recommendations || data.recommendations.length === 0) && (
          <div className="text-center py-8">
            <Wine className="w-12 h-12 text-purple-400/50 mx-auto mb-4" />
            <p className="text-white font-medium mb-2">No Recommendations Yet</p>
            <p className="text-purple-200/70 text-sm">
              Keep tasting to get personalized wine suggestions.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        {data?.priceDisclaimer && (
          <p className="text-center text-purple-300/50 text-xs pt-2">
            {data.priceDisclaimer}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
