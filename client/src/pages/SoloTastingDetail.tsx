import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { WineInsights } from "@/components/WineInsights";
import {
  ArrowLeft,
  Wine,
  Eye,
  Droplets,
  Grape,
  Scale,
  Star,
  Calendar,
  MapPin,
  Loader2,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import type { Tasting, WineCharacteristicsData } from "@shared/schema";

// Section info for display
const SECTIONS = {
  visual: { name: 'Visual', icon: Eye, color: 'from-blue-500 to-cyan-500' },
  aroma: { name: 'Aroma', icon: Droplets, color: 'from-purple-500 to-pink-500' },
  taste: { name: 'Taste', icon: Grape, color: 'from-red-500 to-orange-500' },
  structure: { name: 'Structure', icon: Scale, color: 'from-amber-500 to-yellow-500' },
  overall: { name: 'Overall', icon: Star, color: 'from-emerald-500 to-teal-500' }
} as const;

// Scale labels for displaying responses
const SCALE_LABELS: Record<string, [string, string]> = {
  clarity: ['Cloudy', 'Crystal Clear'],
  intensity: ['Pale/Faint', 'Deep/Powerful'],
  sweetness: ['Bone Dry', 'Sweet'],
  acidity: ['Flat', 'Crisp'],
  tannins: ['Silky', 'Grippy'],
  body: ['Light', 'Full'],
  balance: ['Unbalanced', 'Balanced'],
  finish: ['Short', 'Long'],
  complexity: ['Simple', 'Complex'],
  rating: ['Poor', 'Excellent']
};

// Color options for display
const COLOR_LABELS: Record<string, string> = {
  straw: 'Straw/Lemon',
  gold: 'Gold/Amber',
  ruby: 'Ruby/Garnet',
  purple: 'Purple/Violet',
  salmon: 'Salmon/Pink',
  brown: 'Brown/Tawny'
};

// Aroma options (includes both old detailed and new simplified options)
const AROMA_LABELS: Record<string, string> = {
  // New simplified options
  citrus: 'Citrus & Fresh Fruit',
  tropical: 'Tropical & Stone Fruit',
  berry: 'Berries & Dark Fruit',
  floral: 'Floral & Herbal',
  oak: 'Oak, Vanilla & Spice',
  earth: 'Earthy & Mineral',
  // Legacy detailed options
  stone: 'Stone Fruit (peach, apricot)',
  red_fruit: 'Red Fruit (cherry, raspberry)',
  dark_fruit: 'Dark Fruit (blackberry, plum)',
  vanilla: 'Vanilla/Oak',
  spice: 'Spice (pepper, cinnamon)',
  herbal: 'Herbal (mint, eucalyptus)',
  butter: 'Butter/Cream',
  smoke: 'Smoke/Toast'
};

// Flavor options (includes both old and new simplified options)
const FLAVOR_LABELS: Record<string, string> = {
  // New simplified options
  fruit: 'Fruity',
  spice: 'Spicy',
  oak: 'Oaky/Toasty',
  mineral: 'Mineral/Chalky',
  herbal: 'Herbal/Green',
  earthy: 'Earthy',
  // Legacy options
  fruit_forward: 'Fruit-forward',
  savory: 'Savory/Umami',
  spicy: 'Spicy',
  oaky: 'Oaky/Toasty',
  fresh: 'Fresh/Clean'
};

function ScaleBar({ value, max = 5, labels }: { value: number; max?: number; labels?: [string, string] }) {
  const percentage = ((value - 1) / (max - 1)) * 100;

  return (
    <div className="space-y-1">
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
        />
      </div>
      {labels && (
        <div className="flex justify-between text-xs text-white/50">
          <span>{labels[0]}</span>
          <span className="text-white/80 font-medium">{value}/{max}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

function ResponseSection({
  section,
  data
}: {
  section: keyof typeof SECTIONS;
  data: Record<string, any>;
}) {
  const info = SECTIONS[section];
  const Icon = info.icon;

  if (!data || Object.keys(data).length === 0) return null;

  const renderValue = (key: string, value: any) => {
    // Handle scale values (numbers)
    if (typeof value === 'number') {
      const labels = SCALE_LABELS[key];
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-white/70 capitalize">{key.replace(/_/g, ' ')}</span>
          </div>
          <ScaleBar value={value} labels={labels} />
        </div>
      );
    }

    // Handle color selection (string)
    if (key === 'color' && typeof value === 'string') {
      return (
        <div className="flex justify-between items-center">
          <span className="text-white/70 text-sm">Color</span>
          <span className="text-white text-sm bg-white/10 px-2 py-1 rounded">
            {COLOR_LABELS[value] || value}
          </span>
        </div>
      );
    }

    // Handle any multiple choice response (objects with 'selected' array)
    if (value && typeof value === 'object' && 'selected' in value) {
      const items = value.selected || [];
      if (items.length === 0) return null;

      // Determine label lookup based on key
      const labelMap = key === 'flavors' ? FLAVOR_LABELS : AROMA_LABELS;
      const displayKey = key === 'notes' ? 'Aromas' : key.replace(/_/g, ' ');

      return (
        <div className="space-y-2">
          <span className="text-white/70 text-sm capitalize">{displayKey}</span>
          <div className="flex flex-wrap gap-2">
            {items.map((item: string) => (
              <span key={item} className="text-white text-xs bg-white/10 px-2 py-1 rounded">
                {labelMap[item] || FLAVOR_LABELS[item] || AROMA_LABELS[item] || item}
              </span>
            ))}
          </div>
        </div>
      );
    }

    // Handle plain arrays (legacy format)
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      const labelMap = key === 'flavors' ? FLAVOR_LABELS : AROMA_LABELS;
      return (
        <div className="space-y-2">
          <span className="text-white/70 text-sm capitalize">{key.replace(/_/g, ' ')}</span>
          <div className="flex flex-wrap gap-2">
            {value.map((item: string) => (
              <span key={item} className="text-white text-xs bg-white/10 px-2 py-1 rounded">
                {labelMap[item] || item}
              </span>
            ))}
          </div>
        </div>
      );
    }

    // Handle buy again (boolean)
    if (key === 'buy_again') {
      return (
        <div className="flex justify-between items-center">
          <span className="text-white/70 text-sm">Would Buy Again</span>
          <span className={`flex items-center gap-1 text-sm ${value ? 'text-emerald-400' : 'text-red-400'}`}>
            {value ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
            {value ? 'Yes' : 'No'}
          </span>
        </div>
      );
    }

    // Handle notes (text)
    if (key === 'notes' && value) {
      return (
        <div className="space-y-2">
          <span className="text-white/70 text-sm">Tasting Notes</span>
          <p className="text-white/90 text-sm bg-white/5 p-3 rounded-lg italic">
            "{value}"
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${info.color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-white">{info.name}</h3>
      </div>

      <div className="space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>{renderValue(key, value)}</div>
        ))}
      </div>
    </motion.div>
  );
}

export default function SoloTastingDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const tastingId = params.id;

  const { data, isLoading, error } = useQuery<{ tasting: Tasting }>({
    queryKey: ['/api/solo/tastings', tastingId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/solo/tastings/${tastingId}`, null);
      if (!response.ok) {
        throw new Error('Failed to fetch tasting');
      }
      return response.json();
    },
    enabled: !!tastingId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error || !data?.tasting) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-center max-w-md">
          <Wine className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Tasting Not Found</h2>
          <p className="text-white/60 mb-4">
            This tasting may have been deleted or you don't have permission to view it.
          </p>
          <Button
            onClick={() => setLocation('/solo')}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const tasting = data.tasting;
  const responses = tasting.responses as Record<string, Record<string, any>>;

  return (
    <div className="min-h-screen bg-gradient-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation('/solo')}
              className="text-white/70 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white truncate">{tasting.wineName}</h1>
              <div className="flex items-center gap-3 text-sm text-white/60">
                {tasting.wineType && (
                  <span className="capitalize">{tasting.wineType}</span>
                )}
                {tasting.wineRegion && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {tasting.wineRegion}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 pb-24 space-y-4">
        {/* Wine Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Wine className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white mb-2">{tasting.wineName}</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                {tasting.wineType && (
                  <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded capitalize">
                    {tasting.wineType}
                  </span>
                )}
                {tasting.grapeVariety && (
                  <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded">
                    {tasting.grapeVariety}
                  </span>
                )}
                {tasting.wineVintage && (
                  <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded">
                    {tasting.wineVintage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-white/50 text-sm mt-2">
                <Calendar className="w-3 h-3" />
                <span>Tasted {new Date(tasting.tastedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Overall rating highlight */}
          {responses?.overall?.rating && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-white/70">Overall Rating</span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= responses.overall.rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Wine Intelligence - Compare user perception to typical characteristics */}
        {tasting.wineCharacteristics ? (
          <WineInsights
            characteristics={tasting.wineCharacteristics as WineCharacteristicsData}
            userRatings={{
              sweetness: responses?.taste?.sweetness,
              acidity: responses?.taste?.acidity,
              tannins: responses?.taste?.tannins,
              body: responses?.taste?.body
            }}
            overallRating={responses?.overall?.rating}
          />
        ) : null}

        {/* Response Sections */}
        {responses?.visual && <ResponseSection section="visual" data={responses.visual} />}
        {responses?.aroma && <ResponseSection section="aroma" data={responses.aroma} />}
        {responses?.taste && <ResponseSection section="taste" data={responses.taste} />}
        {responses?.structure && <ResponseSection section="structure" data={responses.structure} />}
        {responses?.overall && <ResponseSection section="overall" data={responses.overall} />}
      </main>
    </div>
  );
}
