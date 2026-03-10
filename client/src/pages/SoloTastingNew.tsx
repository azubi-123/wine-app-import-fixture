import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SoloTastingSession from "@/pages/SoloTastingSession";
import {
  ArrowLeft,
  Wine,
  Camera,
  MapPin,
  DollarSign,
  MessageCircle,
  ShoppingBag,
  Loader2,
  GraduationCap,
  ChevronRight,
  Sparkles,
  ImagePlus,
  Tag,
  ArrowRightLeft,
  Store
} from "lucide-react";
import type { WineOption } from "@shared/schema";

interface WineInfo {
  wineName: string;
  wineRegion?: string;
  wineVintage?: number;
  grapeVariety?: string;
  wineType?: 'red' | 'white' | 'rosé' | 'sparkling' | 'dessert' | 'fortified' | 'orange';
  photoUrl?: string;
}

interface Chapter {
  id: number;
  journeyId: number;
  chapterNumber: number;
  title: string;
  description: string | null;
  wineRequirements: {
    wineType?: string;
    region?: string;
    grapeVariety?: string;
    anyWine?: boolean;
  } | null;
  learningObjectives: string[] | null;
  tastingPrompts: Array<{ question: string; category?: string }> | null;
  shoppingTips: string | null;
  priceRange: { min: number; max: number; currency?: string } | null;
  alternatives: Array<{ name: string }> | null;
  askFor: string | null;
  wineOptions: WineOption[] | null;
}

interface Journey {
  id: number;
  title: string;
}

type ViewState = 'wine-entry' | 'tasting' | 'complete';

interface SoloTastingNewProps {
  returnPath?: string;
}

export default function SoloTastingNew({ returnPath = "/solo" }: SoloTastingNewProps) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams(search);
  const journeyId = params.get("journeyId");
  const chapterId = params.get("chapterId");
  const wineLevel = params.get("wineLevel") as 'budget' | 'splurge' | null;

  const [view, setView] = useState<ViewState>('wine-entry');
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [aiQuestions, setAiQuestions] = useState<any[] | null>(null);
  const [wineInfo, setWineInfo] = useState<WineInfo>({
    wineName: '',
    wineRegion: '',
    grapeVariety: '',
    wineType: undefined
  });

  // Wine label scanning mutation
  const scanWineMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/solo/wines/recognize', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to scan wine label');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.recognized && data.wine) {
        // Auto-fill form with recognized wine info
        setWineInfo(prev => ({
          ...prev,
          wineName: data.wine.wineName || prev.wineName,
          wineRegion: data.wine.wineRegion || prev.wineRegion,
          grapeVariety: data.wine.grapeVariety || prev.grapeVariety,
          wineVintage: data.wine.wineVintage || prev.wineVintage,
          wineType: data.wine.wineType || prev.wineType
        }));

        toast({
          title: "Wine Recognized!",
          description: data.wine.confidence > 0.7
            ? `Found: ${data.wine.wineName}`
            : `Found: ${data.wine.wineName} (verify details)`,
        });
      } else {
        toast({
          title: "Couldn't Recognize Wine",
          description: "Try taking a clearer photo of the label, or enter details manually.",
          variant: "destructive"
        });
      }
      setIsScanning(false);
    },
    onError: (error) => {
      console.error('Wine scan error:', error);
      toast({
        title: "Scan Failed",
        description: "Could not process the image. Please try again or enter details manually.",
        variant: "destructive"
      });
      setIsScanning(false);
    }
  });

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image under 10MB.",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true);
    scanWineMutation.mutate(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fetch chapter data if we have journeyId and chapterId
  const { data: chapterData, isLoading } = useQuery({
    queryKey: ["chapter", journeyId, chapterId],
    queryFn: async () => {
      const response = await fetch(`/api/journeys/${journeyId}`);
      if (!response.ok) throw new Error("Failed to fetch journey");
      const data = await response.json();
      const journey = data.journey?.journey as Journey;
      const chapters = data.journey?.chapters as Chapter[];
      const chapter = chapters?.find(c => c.id === parseInt(chapterId || "0"));
      return { journey, chapter };
    },
    enabled: !!journeyId && !!chapterId
  });

  const journey = chapterData?.journey;
  const chapter = chapterData?.chapter;

  // Pre-fill wine info from chapter requirements
  useEffect(() => {
    if (chapter?.wineRequirements) {
      setWineInfo(prev => ({
        ...prev,
        wineRegion: chapter.wineRequirements?.region || prev.wineRegion,
        grapeVariety: chapter.wineRequirements?.grapeVariety || prev.grapeVariety,
        wineType: (chapter.wineRequirements?.wineType as WineInfo['wineType']) || prev.wineType
      }));
    }
  }, [chapter]);

  // Complete chapter mutation
  const completeChapterMutation = useMutation({
    mutationFn: async (tastingId: number) => {
      if (!user?.email || !journeyId || !chapterId) return;

      const response = await fetch(`/api/journeys/${journeyId}/chapters/${chapterId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          tastingId
        })
      });

      if (!response.ok) throw new Error("Failed to complete chapter");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey-progress", journeyId] });
    }
  });

  const handleStartTasting = async () => {
    if (!wineInfo.wineName.trim()) return;

    // For journey chapters, validate wine and generate AI questions
    if (journeyId && chapterId && user?.email) {
      setIsValidating(true);
      setValidationError(null);

      try {
        // Convert wineInfo to WineRecognitionResult format for the API
        const wineRecognition = {
          name: wineInfo.wineName,
          region: wineInfo.wineRegion || 'Unknown',
          grapeVarieties: wineInfo.grapeVariety ? [wineInfo.grapeVariety] : [],
          vintage: wineInfo.wineVintage,
          confidence: 0.8 // Assume high confidence since user entered/verified
        };

        const response = await fetch(`/api/journeys/${journeyId}/chapters/${chapterId}/start-tasting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wineInfo: wineRecognition,
            email: user.email,
            userLevel: 'intro', // User's level will be fetched from their profile in production
            skipValidation: chapter?.wineRequirements?.anyWine || false
          }),
          credentials: 'include'
        });

        const result = await response.json();

        if (!result.success) {
          setValidationError(result.message || 'This wine does not match the chapter requirements.');
          setIsValidating(false);
          return;
        }

        // Store AI-generated questions
        if (result.questions && result.questions.length > 0) {
          setAiQuestions(result.questions);
        }

        setIsValidating(false);
        setView('tasting');
      } catch (error) {
        console.error('Error starting tasting:', error);
        setValidationError('Failed to validate wine. Please try again.');
        setIsValidating(false);
      }
    } else {
      // Non-journey tasting - go straight to tasting
      setView('tasting');
    }
  };

  const handleTastingComplete = async (tastingId?: number) => {
    if (journeyId && chapterId && tastingId) {
      try {
        await completeChapterMutation.mutateAsync(tastingId);
      } catch (error) {
        console.error("Failed to mark chapter complete:", error);
      }
    }
    setView('complete');
  };

  const handleTastingCancel = () => {
    setView('wine-entry');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0015] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Show tasting session
  if (view === 'tasting') {
    return (
      <SoloTastingSession
        wine={wineInfo}
        onComplete={handleTastingComplete}
        onCancel={handleTastingCancel}
        chapterContext={chapter ? {
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          tastingPrompts: chapter.tastingPrompts || [],
          learningObjectives: chapter.learningObjectives || []
        } : undefined}
        aiQuestions={aiQuestions || undefined}
      />
    );
  }

  // Show completion screen
  if (view === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0015] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full text-center border border-white/20"
        >
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-8 h-8 text-green-400" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Chapter Complete!</h2>

          {chapter && (
            <p className="text-purple-200/80 mb-6">
              You've finished "{chapter.title}"
            </p>
          )}

          {chapter?.learningObjectives && chapter.learningObjectives.length > 0 && (
            <div className="bg-black/20 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-purple-400 font-medium mb-2">What you learned:</p>
              <ul className="space-y-1">
                {chapter.learningObjectives.map((obj, i) => (
                  <li key={i} className="text-sm text-purple-200/80 flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => setLocation(`/journeys/${journeyId}`)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              Continue Journey
            </Button>
            <Button
              onClick={() => setLocation(returnPath)}
              variant="outline"
              className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            >
              View All Tastings
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Wine entry form
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#16082a] to-[#0d0015]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => journeyId ? setLocation(`/journeys/${journeyId}`) : setLocation(returnPath)}
              className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            {journey && (
              <span className="text-sm text-purple-300/70">{journey.title}</span>
            )}
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Chapter context */}
          {chapter && (
            <div className="bg-purple-500/10 rounded-xl p-4 mb-6 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">
                  Chapter {chapter.chapterNumber}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">{chapter.title}</h2>
              {chapter.description && (
                <p className="text-sm text-purple-200/70">{chapter.description}</p>
              )}
            </div>
          )}

          {/* Shopping Guide — selected wine option */}
          {chapter && wineLevel && chapter.wineOptions && (() => {
            const selectedOption = chapter.wineOptions.find(o => o.level === wineLevel);
            if (!selectedOption) return null;
            return (
              <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-xl p-4 mb-6 border border-purple-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Shopping Guide</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    wineLevel === 'budget' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {wineLevel === 'budget' ? 'Budget' : 'Splurge'}
                  </span>
                </div>

                <h4 className="text-white font-medium mb-2">{selectedOption.description}</h4>

                {selectedOption.priceRange && (
                  <div className="flex items-center gap-1 text-sm text-green-400/80 mb-3">
                    <DollarSign className="w-4 h-4" />
                    ${selectedOption.priceRange.min} – ${selectedOption.priceRange.max}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-purple-300/70 mb-0.5">Ask for:</p>
                      <p className="text-sm text-white">{selectedOption.askFor}</p>
                    </div>
                  </div>

                  {selectedOption.labelTips && (
                    <div className="flex items-start gap-2">
                      <Tag className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-purple-300/70 mb-0.5">Look for on the label:</p>
                        <p className="text-sm text-white/90">{selectedOption.labelTips}</p>
                      </div>
                    </div>
                  )}

                  {selectedOption.substitutes && selectedOption.substitutes.length > 0 && (
                    <div className="flex items-start gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-purple-300/70 mb-0.5">Also works:</p>
                        <p className="text-sm text-white/70">{selectedOption.substitutes.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {selectedOption.exampleProducers && selectedOption.exampleProducers.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Store className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-purple-300/70 mb-0.5">Examples:</p>
                        <p className="text-sm text-white/70">{selectedOption.exampleProducers.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Fallback shopping guide — when no wine option selected */}
          {chapter && !wineLevel && (chapter.shoppingTips || chapter.askFor || chapter.priceRange) && (
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-xl p-4 mb-6 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Shopping Guide</span>
              </div>

              {chapter.askFor && (
                <div className="mb-3">
                  <p className="text-xs text-purple-300/70 mb-1 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    Tell the wine shop:
                  </p>
                  <p className="text-sm text-white italic bg-black/20 rounded px-3 py-2">
                    "{chapter.askFor}"
                  </p>
                </div>
              )}

              {chapter.shoppingTips && (
                <p className="text-sm text-purple-200/80 mb-3">{chapter.shoppingTips}</p>
              )}

              {chapter.priceRange && (
                <div className="flex items-center gap-1 text-sm text-purple-300/70">
                  <DollarSign className="w-4 h-4" />
                  Budget: ${chapter.priceRange.min} – ${chapter.priceRange.max}
                </div>
              )}
            </div>
          )}

          {/* Wine Entry Form */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wine className="w-5 h-5 text-purple-400" />
              What wine did you get?
            </h3>

            {/* Scan Label Button */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/50 hover:to-pink-600/50 border border-purple-500/30 rounded-xl text-white transition-all disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analyzing wine label...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    <span>Scan Wine Label</span>
                    <Sparkles className="w-4 h-4 text-purple-300" />
                  </>
                )}
              </button>
              <p className="text-center text-purple-300/60 text-xs mt-2">
                Take a photo of the wine label to auto-fill details
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-[#1a0a2e] text-purple-300/60">or enter manually</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="wineName" className="text-purple-200">Wine Name *</Label>
                <Input
                  id="wineName"
                  placeholder="e.g., Château Margaux 2018"
                  value={wineInfo.wineName}
                  onChange={(e) => setWineInfo(prev => ({ ...prev, wineName: e.target.value }))}
                  className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-purple-300/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="region" className="text-purple-200">Region</Label>
                  <Input
                    id="region"
                    placeholder={chapter?.wineRequirements?.region || "e.g., Bordeaux"}
                    value={wineInfo.wineRegion}
                    onChange={(e) => setWineInfo(prev => ({ ...prev, wineRegion: e.target.value }))}
                    className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-purple-300/50"
                  />
                </div>
                <div>
                  <Label htmlFor="grape" className="text-purple-200">Grape Variety</Label>
                  <Input
                    id="grape"
                    placeholder={chapter?.wineRequirements?.grapeVariety || "e.g., Merlot"}
                    value={wineInfo.grapeVariety}
                    onChange={(e) => setWineInfo(prev => ({ ...prev, grapeVariety: e.target.value }))}
                    className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-purple-300/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vintage" className="text-purple-200">Vintage Year</Label>
                  <Input
                    id="vintage"
                    type="number"
                    placeholder="e.g., 2020"
                    value={wineInfo.wineVintage || ''}
                    onChange={(e) => setWineInfo(prev => ({ ...prev, wineVintage: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-purple-300/50"
                  />
                </div>
                <div>
                  <Label htmlFor="type" className="text-purple-200">Wine Type</Label>
                  <select
                    id="type"
                    value={wineInfo.wineType || ''}
                    onChange={(e) => setWineInfo(prev => ({ ...prev, wineType: e.target.value as WineInfo['wineType'] || undefined }))}
                    className="mt-1 w-full h-10 px-3 rounded-md bg-white/10 border border-white/20 text-white"
                  >
                    <option value="">Select type</option>
                    <option value="red">Red</option>
                    <option value="white">White</option>
                    <option value="rosé">Rosé</option>
                    <option value="sparkling">Sparkling</option>
                    <option value="dessert">Dessert</option>
                    <option value="fortified">Fortified</option>
                    <option value="orange">Orange</option>
                  </select>
                </div>
              </div>

              {/* Wine requirements hint */}
              {chapter?.wineRequirements && !chapter.wineRequirements.anyWine && (
                <div className="bg-purple-500/10 rounded-lg p-3 text-sm">
                  <p className="text-purple-300/70 mb-2">Looking for:</p>
                  <div className="flex flex-wrap gap-2">
                    {chapter.wineRequirements.wineType && (
                      <span className="px-2 py-1 bg-purple-500/20 rounded-full text-purple-200 text-xs">
                        {chapter.wineRequirements.wineType}
                      </span>
                    )}
                    {chapter.wineRequirements.region && (
                      <span className="px-2 py-1 bg-purple-500/20 rounded-full text-purple-200 text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {chapter.wineRequirements.region}
                      </span>
                    )}
                    {chapter.wineRequirements.grapeVariety && (
                      <span className="px-2 py-1 bg-purple-500/20 rounded-full text-purple-200 text-xs">
                        {chapter.wineRequirements.grapeVariety}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Validation error message */}
              {validationError && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mt-4">
                  <p className="text-red-300 text-sm">{validationError}</p>
                </div>
              )}

              <Button
                onClick={handleStartTasting}
                disabled={!wineInfo.wineName.trim() || isValidating}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg mt-4"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Preparing Tasting...
                  </>
                ) : (
                  'Start Tasting'
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
