import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, BookOpen, Loader2, Wine, ChevronRight, Sparkles } from "lucide-react";
import type { JourneyRecommendationsResponse, JourneyMatch } from "@shared/schema";
import { useLocation } from "wouter";

interface JourneyRecommendationsProps {
  email: string;
}

const difficultyColors: Record<string, { bg: string; text: string; border: string }> = {
  beginner: { bg: "bg-green-500/20", text: "text-green-300", border: "border-green-500/30" },
  intermediate: { bg: "bg-yellow-500/20", text: "text-yellow-300", border: "border-yellow-500/30" },
  advanced: { bg: "bg-red-500/20", text: "text-red-300", border: "border-red-500/30" }
};

const wineTypeIcons: Record<string, string> = {
  red: "🍷",
  white: "🥂",
  rosé: "🌸",
  sparkling: "✨",
  mixed: "🍇"
};

export function JourneyRecommendations({ email }: JourneyRecommendationsProps) {
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<JourneyRecommendationsResponse>({
    queryKey: [`/api/dashboard/${email}/recommended-journeys`],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/${email}/recommended-journeys`);
      if (!response.ok) throw new Error('Failed to fetch journey recommendations');
      return response.json();
    },
    enabled: !!email,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Map className="w-5 h-5 text-amber-300" />
            Your Next Journey
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-300 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Error or empty state
  if (error || !data || data.recommendations.length === 0) {
    return (
      <Card className="bg-white/10 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Map className="w-5 h-5 text-amber-300" />
            Your Next Journey
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <BookOpen className="w-12 h-12 text-amber-400/50 mx-auto mb-4" />
          <p className="text-lg font-medium text-white mb-2">
            No Journeys Available Yet
          </p>
          <p className="text-sm text-purple-200/70">
            Check back soon for guided wine learning experiences tailored to your taste.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { recommendations, userPreferences } = data;

  return (
    <Card className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 backdrop-blur-xl border-white/20 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Map className="w-5 h-5 text-amber-300" />
            Your Next Journey
          </CardTitle>
          <Badge
            variant="outline"
            className="text-xs text-amber-300 border-amber-500/30 bg-amber-500/10"
          >
            {userPreferences.preferredWineType === 'balanced' ? 'Exploring both' : `${userPreferences.preferredWineType} lover`}
          </Badge>
        </div>
        <p className="text-sm text-purple-200/70 mt-1">
          Curated journeys based on your taste preferences
        </p>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {recommendations.slice(0, 3).map((journey, index) => (
          <JourneyCard
            key={journey.journeyId}
            journey={journey}
            index={index}
            onClick={() => setLocation(`/journeys/${journey.journeyId}`)}
          />
        ))}

        {/* View all journeys link */}
        <button
          onClick={() => setLocation('/journeys')}
          className="w-full mt-2 py-3 text-amber-300 hover:text-amber-200 text-sm font-medium flex items-center justify-center gap-1 transition-colors"
        >
          Browse all journeys
          <ChevronRight className="w-4 h-4" />
        </button>
      </CardContent>
    </Card>
  );
}

interface JourneyCardProps {
  journey: JourneyMatch;
  index: number;
  onClick: () => void;
}

function JourneyCard({ journey, index, onClick }: JourneyCardProps) {
  const difficultyStyle = difficultyColors[journey.difficultyLevel] || difficultyColors.beginner;
  const isInProgress = journey.matchReasons.some(r => r.toLowerCase().includes('continue'));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="group cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-amber-500/10"
    >
      <div className="flex">
        {/* Cover Image */}
        <div className="relative w-24 h-24 flex-shrink-0 bg-gradient-to-br from-amber-900/50 to-orange-800/30 overflow-hidden">
          {journey.coverImageUrl ? (
            <img
              src={journey.coverImageUrl}
              alt={journey.title}
              className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Wine className="w-8 h-8 text-amber-500/30" />
            </div>
          )}

          {/* Wine type indicator */}
          {journey.wineType && (
            <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-sm">
              {wineTypeIcons[journey.wineType] || "🍇"}
            </div>
          )}

          {/* In progress indicator */}
          {isInProgress && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-500/80 rounded text-[10px] font-medium text-black">
              Continue
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-white font-medium text-sm leading-tight truncate">
              {journey.title}
            </h4>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-amber-300">{journey.matchScore}%</span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${difficultyStyle.bg} ${difficultyStyle.text} ${difficultyStyle.border}`}
            >
              {journey.difficultyLevel}
            </Badge>
            <span className="text-purple-300/60 text-xs">
              {journey.totalChapters} {journey.totalChapters === 1 ? 'chapter' : 'chapters'}
            </span>
          </div>

          {/* Match reasons */}
          {journey.matchReasons.length > 0 && (
            <p className="text-purple-200/70 text-xs line-clamp-2">
              {journey.matchReasons[0]}
            </p>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center pr-3">
          <ChevronRight className="w-4 h-4 text-amber-400/50 group-hover:text-amber-400 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}
