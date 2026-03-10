import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Wine, BarChart3, Clock, Star, MapPin, Filter,
  ArrowLeft, Search, Calendar, Trophy, TrendingUp,
  Heart, Eye, Share2, Download, MoreHorizontal,
  Globe, Users, Map, Menu, AlertCircle, RefreshCcw, Wifi, WifiOff, LogOut,
  User, Users2, GraduationCap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/home/BottomNav";
import WineMap from "@/components/WineMap";
import { WineInsights } from "@/components/WineInsights";
import { ConversationStarters } from "@/components/dashboard/ConversationStarters";
import { WineIdentityCard } from "@/components/dashboard/WineIdentityCard";
import { ExploreRecommendations } from "@/components/dashboard/ExploreRecommendations";
import { ProducerRecommendations } from "@/components/dashboard/ProducerRecommendations";
import { JourneyRecommendations } from "@/components/dashboard/JourneyRecommendations";
import type { WineCharacteristicsData } from "@shared/schema";

interface UserDashboardData {
  user: {
    email: string;
    displayName: string;
    totalSessions: number;
    completedSessions: number;
    totalResponses: number;
    uniqueWinesTasted: number;
  };
  recentSessions: Array<{
    id: string;
    packageId: string;
    status: string;
    startedAt: string;
    completedAt: string;
  }>;
  stats: {
    averageScore: number;
    favoriteWineType: string;
    totalTastings: number;
  };
  topPreferences?: {
    topRegion: { name: string; count: number; avgRating: number };
    topGrape: { name: string; count: number; avgRating: number };
    averageRating: { score: number; totalWines: number };
  };
  unifiedTastingStats?: {
    total: number;
    solo: number;
    group: number;
  };
}

interface WineScore {
  wineId: string;
  wineName: string;
  wineDescription: string;
  wineImageUrl: string;
  producer?: string;
  region?: string;
  vintage?: number;
  wineType?: string;
  grapeVarietals?: string[];
  alcoholContent?: string;
  scores: number[];
  averageScore: number;
  totalRatings: number;
  isFavorite: boolean;
  expectedCharacteristics?: Record<string, any>;
  source?: 'solo' | 'group';
  wineCharacteristics?: WineCharacteristicsData;
  tastingResponses?: {
    sweetness?: number;
    acidity?: number;
    tannins?: number;
    body?: number;
  };
}

// Sprint 4.1: Unified preferences from both solo + group tastings
interface UnifiedPreferences {
  sweetness: number | null;
  acidity: number | null;
  tannins: number | null;
  body: number | null;
  totalTastings: number;
  soloTastings: number;
  groupTastings: number;
}

interface TastingHistory {
  sessionId: string;
  packageId: string;
  packageName: string;
  status: string;
  startedAt: string;
  completedAt: string;
  activeParticipants: number;
  sommelier: {
    name: string;
    title: string;
    avatar: string;
  };
  winesTasted: number;
  userScore: number;
  groupScore: number;
  duration: number;
  location: string;
  source?: 'solo' | 'group';
  // Solo tasting specific fields
  wineName?: string;
  wineRegion?: string;
  wineVintage?: number;
  wineType?: string;
  photoUrl?: string;
  wineCharacteristics?: WineCharacteristicsData;
}

interface TasteProfile {
  redWineProfile: {
    stylePreference: string;
    preferredVarieties: Array<{ grape: string; averageScore: number; count: number }>;
    favoriteRegions: Array<{ region: string; count: number }>;
    commonFlavorNotes: string[];
    traits?: {
      body: string[];
      acidity: number[];
      sweetness: string[];
      fruits: string[];
    };
    regionsTop3: string[];
    summary?: string;
  };
  whiteWineProfile: {
    stylePreference: string;
    preferredVarieties: Array<{ grape: string; averageScore: number; count: number }>;
    favoriteRegions: Array<{ region: string; count: number }>;
    commonFlavorNotes: string[];
    traits?: {
      body: string[];
      acidity: number[];
      sweetness: string[];
      fruits: string[];
    };
    regionsTop3: string[];
    summary?: string;
  };
  overallStats: {
    totalWines: number;
    averageRating: number;
    topRegion: { name: string; count: number; percentage: number };
    topGrape: { name: string; count: number; percentage: number };
  };
}

export default function UserDashboard() {
  const { email } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'collection' | 'tastings'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [wineSearchTerm, setWineSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);

  // Wine collection filters
  const [selectedVintage, setSelectedVintage] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedVariety, setSelectedVariety] = useState('all');
  const [minRating, setMinRating] = useState(1);
  const [sortBy, setSortBy] = useState('rating');

  // Error Component for consistent error display
  const ErrorCard = ({ 
    title, 
    message, 
    error, 
    onRetry, 
    actionLabel = "Try Again",
    icon: Icon = AlertCircle 
  }: { 
    title: string; 
    message: string; 
    error?: any; 
    onRetry?: () => void; 
    actionLabel?: string;
    icon?: any;
  }) => (
    <Card className="bg-red-50 border-red-200">
      <CardContent className="p-6 text-center">
        <Icon className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800 mb-2">{title}</h3>
        <p className="text-red-600 mb-4">{message}</p>
        {error && (
          <details className="text-sm text-red-500 mb-4">
            <summary className="cursor-pointer hover:text-red-700">Technical Details</summary>
            <p className="mt-2 p-2 bg-red-100 rounded text-left">
              {error?.message || JSON.stringify(error, null, 2)}
            </p>
          </details>
        )}
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="text-red-600 border-red-300 hover:bg-red-100">
            <RefreshCcw className="w-4 h-4 mr-2" />
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  // Empty State Component
  const EmptyState = ({ 
    title, 
    message, 
    action,
    icon: Icon = Wine 
  }: { 
    title: string; 
    message: string; 
    action?: { label: string; onClick: () => void };
    icon?: any;
  }) => (
    <Card className="bg-purple-50 border-purple-200">
      <CardContent className="p-8 text-center">
        <Icon className="w-16 h-16 text-purple-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-purple-800 mb-2">{title}</h3>
        <p className="text-purple-600 mb-4">{message}</p>
        {action && (
          <Button onClick={action.onClick} className="bg-purple-600 hover:bg-purple-700">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  // Network status checking
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopMenuOpen || mobileMenuOpen) {
        const target = event.target as HTMLElement;
        const isInsideDropdown = target.closest('.dropdown-menu') || target.closest('button');
        if (!isInsideDropdown) {
          setDesktopMenuOpen(false);
          setMobileMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [desktopMenuOpen, mobileMenuOpen]);

  // Show offline message if no internet connection
  if (!isOnline) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <WifiOff className="w-16 h-16 text-white/60 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">You're Offline</h2>
            <p className="text-white/80 mb-6">
              Please check your internet connection and try again.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="text-white border-white hover:bg-white/10"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery<UserDashboardData>({
    queryKey: [`/api/dashboard/${email}`],
    enabled: !!email,
    retry: false, // Don't retry 404 errors
  });

  // Use dashboard data directly
  const finalDashboardData = dashboardData;

  // Fetch wine scores
  const { data: wineScores, isLoading: scoresLoading, error: scoresError, refetch: refetchScores } = useQuery<{ scores: WineScore[] }>({
    queryKey: [`/api/dashboard/${email}/scores`],
    enabled: !!email,
    retry: false, // Don't retry 404 errors
  });

  // Use wine scores directly
  const finalWineScores = wineScores;

  // Fetch tasting history
  const { data: tastingHistory, isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useQuery<{ history: TastingHistory[], total: number }>({
    queryKey: [`/api/dashboard/${email}/history`],
    enabled: !!email,
    retry: false, // Don't retry 404 errors
  });

  // Use tasting history directly
  const finalTastingHistory = tastingHistory;

  // Fetch taste profile
  const { data: tasteProfile, isLoading: profileLoading, error: profileError } = useQuery<TasteProfile>({
    queryKey: [`/api/dashboard/${email}/taste-profile`],
    enabled: !!email,
    retry: false, // Don't retry 404 errors
  });

  // Use taste profile directly
  const finalTasteProfile = tasteProfile;

  // Sprint 4.1: Fetch unified preferences (solo + group combined)
  const { data: unifiedPreferences } = useQuery<UnifiedPreferences>({
    queryKey: [`/api/dashboard/${email}/preferences`],
    enabled: !!email,
  });

  // Fetch sommelier feedback to check if user has received feedback
  // (used to enable GPT-enhanced tips in ConversationStarters component)
  const { data: sommelierFeedback } = useQuery<string[]>({
    queryKey: [`/api/dashboard/${email}/sommelier-feedback`],
    enabled: !!email,
  });

  // Comprehensive error checking
  const hasServerError = dashboardError && !dashboardError.message?.includes('404');
  const hasNetworkError = dashboardError?.message?.includes('Network') ||
                          scoresError?.message?.includes('Network') ||
                          historyError?.message?.includes('Network') ||
                          profileError?.message?.includes('Network');

  // Show loading state
  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="text-white">
          <LoadingOverlay
              isVisible={dashboardLoading}
              message="Loading your wine dashboard..."
          />
        </div>
      </div>
    );
  }

  // Show network error
  if (hasNetworkError) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <WifiOff className="w-16 h-16 text-white/60 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Connection Error</h2>
            <p className="text-white/80 mb-6">
              Unable to connect to our servers. Please check your internet connection.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="text-white border-white hover:bg-white/10"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show server error
  if (hasServerError) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-white/60 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Server Error</h2>
            <p className="text-white/80 mb-4">
              We're experiencing technical difficulties. Our team has been notified.
            </p>
            <details className="text-sm text-white/60 mb-6 text-left">
              <summary className="cursor-pointer hover:text-white/80 text-center">Technical Details</summary>
              <p className="mt-2 p-3 bg-white/10 rounded">
                {dashboardError?.message || "Unknown server error"}
              </p>
            </details>
            <div className="space-y-2">
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                className="text-white border-white hover:bg-white/10 w-full"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                onClick={() => setLocation('/')} 
                variant="ghost" 
                className="text-white/60 hover:text-white hover:bg-white/10 w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show no data found
  if (!finalDashboardData) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Wine className="w-16 h-16 text-white/60 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">No Tasting Data Found</h2>
            <p className="text-white/80 mb-6">
              We couldn't find any wine tasting data for <strong>{email}</strong>. 
              Have you participated in any wine tasting sessions yet?
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => setLocation('/join')} 
                className="bg-white/20 hover:bg-white/30 text-white w-full"
              >
                Join a Tasting Session
              </Button>
              <Button 
                onClick={() => setLocation('/')} 
                variant="ghost" 
                className="text-white/60 hover:text-white hover:bg-white/10 w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper functions to get unique filter values
  const getUniqueVintages = (wines: WineScore[]) => {
    const vintages = wines.map(wine => wine.vintage).filter(Boolean);
    return Array.from(new Set(vintages)).sort((a, b) => (b || 0) - (a || 0));
  };

  const getUniqueRegions = (wines: WineScore[]) => {
    const regions = wines.map(wine => wine.region).filter(Boolean);
    return Array.from(new Set(regions)).sort();
  };

  const getUniqueVarieties = (wines: WineScore[]) => {
    const varieties = wines.flatMap(wine => wine.grapeVarietals || []);
    return Array.from(new Set(varieties)).sort();
  };

  // Apply all filters and sorting
  const filteredWines = finalWineScores?.scores.filter(wine => {
    // Search term filter
    const matchesSearch = wine.wineName.toLowerCase().includes(wineSearchTerm.toLowerCase()) ||
      (wine.producer && wine.producer.toLowerCase().includes(wineSearchTerm.toLowerCase()));
    
    // Vintage filter
    const matchesVintage = selectedVintage === 'all' || wine.vintage === parseInt(selectedVintage);
    
    // Region filter
    const matchesRegion = selectedRegion === 'all' || wine.region === selectedRegion;
    
    // Variety filter
    const matchesVariety = selectedVariety === 'all' || 
      (wine.grapeVarietals && wine.grapeVarietals.includes(selectedVariety));
    
    // Rating filter - ensure we're comparing numbers
    const matchesRating = wine.averageScore >= Number(minRating);
    
    return matchesSearch && matchesVintage && matchesRegion && matchesVariety && matchesRating;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.wineName.localeCompare(b.wineName);
      case 'rating':
        return b.averageScore - a.averageScore;
      case 'vintage':
        return (b.vintage || 0) - (a.vintage || 0);
      default:
        return b.averageScore - a.averageScore;
    }
  }) || [];

  const filteredHistory = finalTastingHistory?.history.filter(session =>
    session.packageName.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterType === 'all' || session.status === filterType)
  ) || [];

  // Get unique values for dropdowns
  const availableWines = finalWineScores?.scores || [];
  const uniqueVintages = getUniqueVintages(availableWines);
  const uniqueRegions = getUniqueRegions(availableWines);
  const uniqueVarieties = getUniqueVarieties(availableWines);

  // Clear all filters function
  const clearAllFilters = () => {
    setWineSearchTerm('');
    setSelectedVintage('all');
    setSelectedRegion('all');
    setSelectedVariety('all');
    setMinRating(1);
    setSortBy('rating');
  };


  const wineProfiles = [
    {
      wineType: 'red',
      traits: tasteProfile?.redWineProfile?.traits || {},
      regionsTop3: tasteProfile?.redWineProfile?.regionsTop3 || [],
      color: "purple",
      summary: tasteProfile?.redWineProfile?.summary,
      // tasteProfile: finalTasteProfile?.redWineProfile
    },
    {
      wineType: 'white',
      traits: tasteProfile?.whiteWineProfile?.traits || {},
      regionsTop3: tasteProfile?.whiteWineProfile?.regionsTop3 || [],
      color: "yellow",
      summary: tasteProfile?.whiteWineProfile?.summary,
      // tasteProfile: finalTasteProfile?.whiteWineProfile
    }
  ];


  return (
    <div className="min-h-screen bg-gradient-primary">
      <div className="container mx-auto px-4 py-8 pb-24 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            {/*<Button*/}
            {/*  variant="ghost"*/}
            {/*  onClick={() => setLocation('/')}*/}
            {/*  className="text-white hover:bg-white/10"*/}
            {/*>*/}
            {/*  <ArrowLeft className="w-4 h-4 mr-2" />*/}
            {/*  <span className="hidden sm:inline">Back</span>*/}
            {/*</Button>*/}
            <div>
              <h1 className="text-3xl font-bold text-white">Cata</h1>
              <p className="text-purple-200">Your personal sommelier</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Hamburger menu for mobile */}
            <Button
                variant="ghost"
                className="text-white hover:bg-white/10 md:hidden"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </Button>

            {/* Inline actions for desktop */}
            <div className="hidden md:flex items-center space-x-4 relative">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-white/10"
                onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
              
              {/* Desktop dropdown menu */}
             {desktopMenuOpen && (
               <div className="dropdown-menu absolute right-12 top-12 z-50 bg-white/90 backdrop-blur-xl rounded-lg shadow-lg border border-white/20 py-2 min-w-[180px]">
                 <div
                   className="flex items-center w-full px-4 py-2 cursor-pointer text-purple-900 hover:bg-purple-100 hover:text-black rounded transition"
                   onClick={() => {
                     setDesktopMenuOpen(false);
                     setLocation('/journeys');
                   }}
                 >
                   <GraduationCap className="w-4 h-4 mr-2" />
                   Learning Journeys
                 </div>
                 <div
                   className="flex items-center w-full px-4 py-2 cursor-pointer text-purple-900 hover:bg-purple-100 hover:text-black rounded transition"
                   onClick={() => {
                     setDesktopMenuOpen(false);
                     setLocation('/solo');
                   }}
                 >
                   <Wine className="w-4 h-4 mr-2" />
                   Solo Tasting
                 </div>
                 <div className="border-t border-purple-200 my-1" />
                 <div
                   className="flex items-center w-full px-4 py-2 cursor-pointer text-purple-900 hover:bg-purple-100 hover:text-black rounded transition"
                   onClick={() => {
                     setDesktopMenuOpen(false);
                     setLocation('/',  { replace: true });
                   }}
                 >
                   <LogOut className="w-4 h-4 mr-2" />
                   Logout
                 </div>
               </div>
             )}
              
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-white/20 text-white">
                  {finalDashboardData.user.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Mobile dropdown menu */}
            {mobileMenuOpen && (
                <div className="dropdown-menu absolute right-4 top-16 z-50 flex flex-col bg-white/90 rounded-lg shadow-lg p-4 space-y-2 md:hidden min-w-[180px]">
                  <Button
                    variant="ghost"
                    className="text-purple-900 hover:bg-purple-100 justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setLocation('/journeys');
                    }}
                  >
                    <GraduationCap className="w-5 h-5 mr-2" />
                    Learning Journeys
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-purple-900 hover:bg-purple-100 justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setLocation('/solo');
                    }}
                  >
                    <Wine className="w-5 h-5 mr-2" />
                    Solo Tasting
                  </Button>
                  <div className="border-t border-purple-200 my-1" />
                  <Button
                    variant="ghost"
                    className="text-purple-900 hover:bg-purple-100 justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setLocation('/');
                    }}
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    Logout
                  </Button>
                </div>
            )}
          </div>
        </div>

        {/* Unified Tasting Stats Banner */}
        {finalDashboardData.unifiedTastingStats && finalDashboardData.unifiedTastingStats.total > 0 && (
          <div className="mb-6 p-4 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
            <div className="flex flex-wrap items-center justify-center gap-4 text-center">
              <div className="flex items-center gap-2">
                <Wine className="w-5 h-5 text-purple-300" />
                <span className="text-white font-medium">
                  {finalDashboardData.unifiedTastingStats.total} Total Tastings
                </span>
              </div>
              <div className="hidden sm:block text-purple-300">•</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span className="text-purple-200">
                    {finalDashboardData.unifiedTastingStats.solo} Solo
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users2 className="w-4 h-4 text-blue-400" />
                  <span className="text-purple-200">
                    {finalDashboardData.unifiedTastingStats.group} Group
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sprint 4.1: Unified Preference Bars */}
        {unifiedPreferences && unifiedPreferences.totalTastings > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mb-6 p-5 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/10"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-white">Taste Profile</h2>
              <span className="text-white/40 text-sm ml-auto">
                Based on {unifiedPreferences.totalTastings} tastings
              </span>
            </div>

            {/* Preference Bars */}
            <div className="space-y-3">
              {[
                { label: 'Sweetness', value: unifiedPreferences.sweetness, color: 'from-pink-500 to-rose-500' },
                { label: 'Acidity', value: unifiedPreferences.acidity, color: 'from-yellow-500 to-orange-500' },
                { label: 'Tannins', value: unifiedPreferences.tannins, color: 'from-red-500 to-red-700' },
                { label: 'Body', value: unifiedPreferences.body, color: 'from-purple-500 to-indigo-500' },
              ].map((pref) => (
                <div key={pref.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/70">{pref.label}</span>
                    <span className="text-white/50">{pref.value !== null ? `${Number(pref.value).toFixed(1)}/5` : '-'}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: pref.value !== null ? `${(Number(pref.value) / 5) * 100}%` : '0%' }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className={`h-full bg-gradient-to-r ${pref.color} rounded-full`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList className="bg-white/10 backdrop-blur-xl border-white/20">
            <TabsTrigger value="overview" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2 hide-on-xs" />
              Taste Profile
            </TabsTrigger>
            <TabsTrigger value="collection" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
              <Wine className="w-4 h-4 mr-2 hide-on-xs" />
              Wine Collection
            </TabsTrigger>
            <TabsTrigger value="tastings" className="text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2 hide-on-xs" />
              Tastings
            </TabsTrigger>
          </TabsList>
 
          {/* Taste Profile Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Network status warning */}
            {!isOnline && (
              <div className="bg-orange-500/20 border border-orange-500 rounded-lg p-4 text-orange-200">
                <div className="flex items-center">
                  <WifiOff className="w-5 h-5 mr-2" />
                  You're currently offline. Data may not be up to date.
                </div>
              </div>
            )}

            {/* Error states for overview data */}
            {(scoresError || historyError) && (
              <ErrorCard
                title="Unable to Load Dashboard Data"
                message={
                  !isOnline
                    ? "You're offline. Please check your internet connection and try again."
                    : "There was an error loading your dashboard data. Please try again."
                }
                onRetry={() => {
                  refetchScores();
                  refetchHistory();
                }}
              />
            )}

            {/* Loading overlay - show loading state for all data except sommelier tips */}
            {(scoresLoading || historyLoading || dashboardLoading || profileLoading) && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-300 mx-auto mb-4"></div>
                  <p className="text-purple-200">Loading your taste profile...</p>
                </div>
              </div>
            )}

            {/* Only show content when main data is loaded */}
            {!scoresLoading && !historyLoading && !dashboardLoading && !profileLoading && !(scoresError || historyError) && (
              <>
            {/* Stats Overview - Only visible on Taste Profile tab */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
            >
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-purple-500/20 rounded-full">
                      <Wine className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-200">Total Wines</p>
                      <p className="text-2xl font-bold text-white">{finalDashboardData.user.uniqueWinesTasted}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-yellow-500/20 rounded-full">
                      <Star className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-200">Avg Rating</p>
                      <p className="text-2xl font-bold text-white">{finalDashboardData.stats.averageScore?.toFixed(1) || "0.0"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-full">
                      <Globe className="w-6 h-6 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-200">Regions</p>
                      <p className="text-2xl font-bold text-white">{finalDashboardData.user.uniqueWinesTasted}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/*<Card className="bg-white/10 backdrop-blur-xl border-white/20">*/}
              {/*  <CardContent className="p-6">*/}
              {/*    <div className="flex items-center space-x-4">*/}
              {/*      <div className="p-3 bg-red-500/20 rounded-full">*/}
              {/*        <Heart className="w-6 h-6 text-red-300" />*/}
              {/*      </div>*/}
              {/*      <div>*/}
              {/*        <p className="text-sm text-purple-200">Favorites</p>*/}
              {/*        <p className="text-2xl font-bold text-white">{Math.floor(finalDashboardData.user.uniqueWinesTasted * 0.3)}</p>*/}
              {/*      </div>*/}
              {/*    </div>*/}
              {/*  </CardContent>*/}
              {/*</Card>*/}
            </motion.div>

            {/* Top Preferences - Only visible on Taste Profile tab */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <MapPin className="w-5 h-5 text-purple-300" />
                    <div>
                      <p className="text-sm text-purple-200">Favorite Region</p>
                      <p className="text-lg font-semibold text-white">{finalDashboardData.topPreferences?.topRegion?.name || "None"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-white font-medium">{finalDashboardData.topPreferences?.topRegion?.avgRating || 0}/10</span>
                      <span className="text-purple-300 text-sm ml-1">avg</span>
                    </div>
                    <span className="text-purple-200 text-sm">
                      {finalDashboardData.topPreferences?.topRegion?.count || 0} {(finalDashboardData.topPreferences?.topRegion?.count || 0) === 1 ? 'wine' : 'wines'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Wine className="w-5 h-5 text-purple-300" />
                    <div>
                      <p className="text-sm text-purple-200">Favorite Grape</p>
                      <p className="text-lg font-semibold text-white">{finalDashboardData.topPreferences?.topGrape?.name || "None"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-white font-medium">{finalDashboardData.topPreferences?.topGrape?.avgRating || 0}/10</span>
                      <span className="text-purple-300 text-sm ml-1">avg</span>
                    </div>
                    <span className="text-purple-200 text-sm">
                      {finalDashboardData.topPreferences?.topGrape?.count || 0} {(finalDashboardData.topPreferences?.topGrape?.count || 0) === 1 ? 'wine' : 'wines'}
                    </span>
                  </div>
                </CardContent>
              </Card>

            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {wineProfiles.map(({ wineType, traits, regionsTop3, color, summary }) => {
                return (
                  <Card key={wineType} className="bg-white/10 backdrop-blur-xl border-white/20">
                    <CardHeader>
                      <CardTitle className="text-white">{wineType.charAt(0).toUpperCase() + wineType.slice(1)} Wine Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className={`text-white-200 leading-relaxed`}>
                          <p>
                            {summary || 
                              `Based on your tasting history, we're still building your ${wineType} wine preference profile. Continue tasting to develop more detailed insights.`
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </motion.div>
              </>
            )}

            {/* Phase 1: Wine Identity Card - Shows archetype and preference breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
            >
              <WineIdentityCard
                email={email || ''}
                preferences={unifiedPreferences}
                hasSommelierFeedback={Boolean(sommelierFeedback && sommelierFeedback.length > 0)}
              />
            </motion.div>

            {/* Phase 1: Conversation Starters - Always renders from DB, GPT tips as enhancement */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
            >
              <ConversationStarters
                email={email || ''}
                hasSommelierFeedback={Boolean(sommelierFeedback && sommelierFeedback.length > 0)}
              />
            </motion.div>

            {/* Phase 2: Explore Recommendations - "You liked X → Try Y" */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
            >
              <ExploreRecommendations email={email || ''} />
            </motion.div>

            {/* Phase 3: Producer Recommendations - Specific wines to buy */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
            >
              <ProducerRecommendations email={email || ''} />
            </motion.div>

            {/* Phase 4: Journey Recommendations - Learning paths based on taste */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
            >
              <JourneyRecommendations email={email || ''} />
            </motion.div>
          </TabsContent>

          {/* Wine Collection Tab */}
          <TabsContent value="collection" className="space-y-6">
            {/* Error handling for wine scores */}
            {scoresError && !finalWineScores && (
              <ErrorCard
                title="Unable to Load Wine Collection"
                message="We couldn't load your wine collection data. This might be due to a temporary server issue."
                error={scoresError}
                onRetry={() => window.location.reload()}
                actionLabel="Refresh Page"
              />
            )}

            {/* Loading state for wine scores */}
            {scoresLoading && (
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-8 text-center">
                  <LoadingOverlay
                    isVisible={true}
                    message="Loading your wine collection..."
                  />
                </CardContent>
              </Card>
            )}

            {/* Wine collection content */}
            {finalWineScores && finalWineScores.scores && finalWineScores.scores.length > 0 ? (
              <>
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300 w-4 h-4" />
                <Input
                  placeholder="Search by names..."
                  value={wineSearchTerm}
                  onChange={(e) => setWineSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-purple-300"
                />
              </div>
              <select 
                value={selectedVintage}
                onChange={(e) => setSelectedVintage(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-md"
              >
                <option className="bg-black" value="all">All Years</option>
                {uniqueVintages.map(vintage => (
                  <option key={vintage} className="bg-black" value={vintage?.toString()}>
                    {vintage}
                  </option>
                ))}
              </select>
              <select 
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-md"
              >
                <option className="bg-black" value="all">All Regions</option>
                {uniqueRegions.map(region => (
                  <option key={region} className="bg-black" value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <select 
                value={selectedVariety}
                onChange={(e) => setSelectedVariety(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-md"
              >
                <option className="bg-black" value="all">All Varieties</option>
                {uniqueVarieties.map(variety => (
                  <option key={variety} className="bg-black" value={variety}>
                    {variety}
                  </option>
                ))}
              </select>
              <Button 
                variant="outline" 
                className="border-white/20 text-white hover:bg-white/10"
                onClick={clearAllFilters}
              >
                Clear All Filters
              </Button>
            </div>

            {/* Collection Header */}
            <div className="flex items-center justify-between">
              <p className="text-white">Showing {filteredWines.length} wines</p>
              <div className="flex items-center space-x-4">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1 bg-white/10 border border-white/20 text-white rounded text-sm"
                >
                  <option className="bg-black" value="rating">Sort by Rating</option>
                  <option className="bg-black" value="name">Sort by Name</option>
                  <option className="bg-black" value="vintage">Sort by Vintage</option>
                </select>
                <div className="flex border border-white/20 rounded">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="text-white"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="text-white"
                  >
                    <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                      <div className="bg-current w-1 h-1"></div>
                      <div className="bg-current w-1 h-1"></div>
                      <div className="bg-current w-1 h-1"></div>
                      <div className="bg-current w-1 h-1"></div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>

            {/* Wine Grid/List */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWines.map((wine) => (
                  <Card key={wine.wineId} className="bg-white/10 backdrop-blur-xl border-white/20 hover:bg-white/15 transition-colors">
                    <CardContent className="p-6">
                      <div className="aspect-square mb-4 rounded-lg overflow-hidden bg-white/5">
                        {wine.wineImageUrl ? (
                          <img 
                            src={wine.wineImageUrl} 
                            alt={wine.wineName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Wine className="w-12 h-12 text-purple-300" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{wine.wineName}</h3>
                      {wine.vintage && wine.region && (
                        <p className="text-sm text-purple-200 mb-2">{wine.vintage} {wine.region}</p>
                      )}
                      {wine.grapeVarietals && (
                        <p className="text-sm text-purple-200 mb-2">{wine.grapeVarietals.join(', ')}</p>
                      )}
                      <div className="flex items-center space-x-1 mb-2">
                      <Star
                        className={`w-4 h-4 ${wine.averageScore >= 1 ? 'text-yellow-400 fill-current' : 'text-gray-400'}`}
                      />

                        <span className="text-white ml-1">{wine.averageScore.toFixed(1)}</span>
                      </div>
                      <p className="text-sm text-purple-200 mb-4 line-clamp-2">{wine.wineDescription}</p>

                      {/* Wine Insights - show when we have characteristics and user ratings */}
                      {wine.wineCharacteristics && wine.tastingResponses && (
                        <div className="mt-3">
                          <WineInsights
                            characteristics={wine.wineCharacteristics}
                            userRatings={wine.tastingResponses}
                            overallRating={wine.averageScore}
                            compact={true}
                          />
                        </div>
                      )}

                      {/* Expected Characteristics Chips - fallback when no WineInsights */}
                      {(!wine.wineCharacteristics || !wine.tastingResponses) &&
                        wine.expectedCharacteristics && Object.keys(wine.expectedCharacteristics).length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-white font-medium mb-2">Wine Characteristics</h4>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(wine.expectedCharacteristics).map(([category, value], index) => (
                              <Badge key={index} variant="outline" className="text-purple-200 border-purple-300">
                                {category}: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Source badge for solo wines */}
                      {wine.source === 'solo' && (
                        <Badge variant="outline" className="mt-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          <User className="w-3 h-3 mr-1" />Solo Tasting
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredWines.map((wine) => (
                  <Card key={wine.wineId} className="bg-white/10 backdrop-blur-xl border-white/20">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                          {wine.wineImageUrl ? (
                            <img 
                              src={wine.wineImageUrl} 
                              alt={wine.wineName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Wine className="w-6 h-6 text-purple-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-white mb-1">{wine.wineName}</h3>
                          {wine.vintage && wine.region && (
                            <p className="text-sm text-purple-200 mb-1">{wine.vintage} {wine.region}</p>
                          )}
                          {wine.grapeVarietals && (
                            <p className="text-sm text-purple-200 mb-2">{wine.grapeVarietals.join(', ')}</p>
                          )}
                          <p className="text-sm text-purple-200 line-clamp-2">{wine.wineDescription}</p>

                          {/* Wine Insights - show when we have characteristics and user ratings */}
                          {wine.wineCharacteristics && wine.tastingResponses && (
                            <div className="mt-3">
                              <WineInsights
                                characteristics={wine.wineCharacteristics}
                                userRatings={wine.tastingResponses}
                                overallRating={wine.averageScore}
                                compact={true}
                              />
                            </div>
                          )}

                          {/* Expected Characteristics Chips - fallback when no WineInsights */}
                          {(!wine.wineCharacteristics || !wine.tastingResponses) &&
                            wine.expectedCharacteristics && Object.keys(wine.expectedCharacteristics).length > 0 && (
                            <div className="mt-2">
                              <h4 className="text-white font-medium mb-2">Wine Characteristics</h4>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(wine.expectedCharacteristics).map(([category, value], index) => (
                                  <Badge key={index} variant="outline" className="text-purple-200 border-purple-300">
                                    {category}: {value}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Source badge for solo wines */}
                          {wine.source === 'solo' && (
                            <Badge variant="outline" className="mt-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              <User className="w-3 h-3 mr-1" />Solo Tasting
                            </Badge>
                          )}
                        </div>
                        {/* Desktop Rating - hidden on mobile */}
                        <div className="hidden sm:flex items-center space-x-1 mb-2">
                        <Star
                          className={`w-4 h-4 ${wine.averageScore >= 1 ? 'text-yellow-400 fill-current' : 'text-gray-400'}`}
                        />

                          <span className="text-white ml-1">{wine.averageScore.toFixed(1)}</span>
                        </div>
                        {/* <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`${wine.isFavorite ? 'text-red-400' : 'text-purple-300'} hover:bg-purple-500/20`}
                          >
                            <Heart className={`w-4 h-4 ${wine.isFavorite ? 'fill-current' : ''}`} />
                          </Button>
                        </div> */}
                      </div>
                      {/* Mobile Rating - shown only on mobile at bottom */}
                      <div className="sm:hidden flex items-center justify-center space-x-1 mt-3 pt-3 border-t border-white/10">
                      <Star
                        className={`w-4 h-4 ${wine.averageScore >= 1 ? 'text-yellow-400 fill-current' : 'text-gray-400'}`}
                      />
                        <span className="text-white ml-1">{wine.averageScore.toFixed(1)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredWines.length === 0 && (
              <div className="text-center py-12">
                <Wine className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                <p className="text-purple-200">No wines found matching your search.</p>
              </div>
            )}

            {/* Wine Origins Map */}
            {filteredWines.length > 0 && (
              <WineMap wines={filteredWines} />
            )}
              </>
            ) : (
              /* Empty state for wine collection */
              !scoresLoading && (
                <EmptyState
                  title="No Wines in Your Collection"
                  message="Start tasting wines to build your personal collection and track your preferences."
                  action={{ 
                    label: "Join a Tasting Session", 
                    onClick: () => setLocation('/join') 
                  }}
                />
              )
            )}
          </TabsContent>

          {/* Tastings Tab */}
          <TabsContent value="tastings" className="space-y-6">
            {/* Error handling for tasting history */}
            {historyError && !finalTastingHistory && (
              <ErrorCard
                title="Unable to Load Tasting History"
                message="We couldn't load your tasting history. This might be due to a temporary server issue."
                error={historyError}
                onRetry={() => window.location.reload()}
                actionLabel="Refresh Page"
              />
            )}

            {/* Loading state for tasting history */}
            {historyLoading && (
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-8 text-center">
                  <LoadingOverlay
                    isVisible={true}
                    message="Loading your tasting history..."
                  />
                </CardContent>
              </Card>
            )}

            {/* Tasting history content */}
            {finalTastingHistory && finalTastingHistory.history && finalTastingHistory.history.length > 0 ? (
              <>
                {/* Tastings Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-purple-500/20 rounded-full">
                      <Users className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-200">Total Tastings</p>
                      <p className="text-2xl font-bold text-white">{finalTastingHistory?.total || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-full">
                      <Wine className="w-6 h-6 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm text-purple-200">Wines Tasted</p>
                      <p className="text-2xl font-bold text-white">
                        {finalDashboardData?.user?.uniqueWinesTasted|| 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300 w-4 h-4" />
                <Input
                  placeholder="Search tastings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-purple-300"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-md"
              >
                <option className="bg-black" value="all">All Status</option>
                <option className="bg-black" value="waiting">Waiting</option>
                <option className="bg-black" value="active">Active</option>
                <option className="bg-black" value="completed">Completed</option>
              </select>
            </div>

            {/* Tasting History */}
            <div className="space-y-4">
              {filteredHistory.map((session) => {
                const isSolo = session.source === 'solo';

                return (
                  <Card
                    key={session.sessionId}
                    className="bg-white/10 backdrop-blur-xl border-white/20 hover:bg-white/15 transition-colors cursor-pointer"
                    onClick={() => !isSolo && setLocation(`/dashboard/${email}/tasting/${session.sessionId}`)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        {/* Avatar/Image */}
                        {isSolo && session.photoUrl ? (
                          <div className="h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
                            <img
                              src={session.photoUrl}
                              alt={session.wineName || 'Wine'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-white/20 text-white">
                              <Wine className="w-6 h-6" />
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold text-white">
                                  {isSolo ? session.wineName : session.packageName}
                                </h3>
                                {/* Source Badge */}
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    isSolo
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                  }`}
                                >
                                  {isSolo ? (
                                    <><User className="w-3 h-3 mr-1" />Solo</>
                                  ) : (
                                    <><Users2 className="w-3 h-3 mr-1" />Group</>
                                  )}
                                </Badge>
                              </div>

                              {isSolo ? (
                                <p className="text-sm text-purple-200 mb-1">
                                  {session.wineRegion && session.wineVintage
                                    ? `${session.wineRegion} • ${session.wineVintage}`
                                    : session.wineRegion || session.wineType || 'Personal Tasting'}
                                </p>
                              ) : (
                                <>
                                  <p className="text-sm text-purple-200 mb-1">Wine Tasting Experience</p>
                                  <p className="text-sm text-purple-200 line-clamp-2">
                                    An intimate journey through exceptional wines. Taste {session.winesTasted} carefully selected wines with expert guidance.
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center space-x-1 text-purple-200">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                            </div>
                            {!isSolo && (
                              <div className="flex items-center space-x-1 text-purple-200">
                                <Users className="w-4 h-4" />
                                <span>{session.activeParticipants} people</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col md:flex-row items-center justify-between mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-1">
                                <span className="text-purple-200">Your Score:</span>
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                <span className="text-white">{session.userScore}</span>
                              </div>
                              {!isSolo && (
                                <div className="flex items-center space-x-1">
                                  <span className="text-purple-200">Group Avg:</span>
                                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                  <span className="text-white">{session.groupScore}</span>
                                </div>
                              )}
                            </div>
                            {!isSolo && (
                              <div className="text-purple-200 text-sm mt-2 md:mt-0">
                                Click to view details →
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredHistory.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                <p className="text-purple-200">No tasting sessions found.</p>
              </div>
            )}
              </>
            ) : (
              /* Empty state for tasting history */
              !historyLoading && (
                <EmptyState
                  title="No Tasting History"
                  message="You haven't participated in any wine tasting sessions yet. Join a session to start building your tasting history."
                  action={{ 
                    label: "Join a Tasting Session", 
                    onClick: () => setLocation('/join') 
                  }}
                />
              )
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav activeTab="dashboard" />
    </div>
  );
} 