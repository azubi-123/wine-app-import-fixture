import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { BottomNav } from "@/components/home/BottomNav";
import { JoinSessionView } from "@/components/gateway/JoinSessionView";
import { HostSessionView } from "@/components/gateway/HostSessionView";
import { QRScanner } from "@/components/QRScanner";
import { SessionRestoreModal } from "@/components/SessionRestoreModal";
import { useHaptics } from "@/hooks/useHaptics";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Wine,
  Users,
  BarChart3,
  Plus,
  ChevronRight,
  Loader2,
  Calendar,
  Star,
  User as UserIcon,
  Sparkles,
  ArrowLeft,
  GraduationCap,
  Clock,
  MapPin,
  Globe,
  LogOut,
  ChevronDown,
} from "lucide-react";
import type { User, Tasting } from "@shared/schema";

type TabKey = "solo" | "group" | "dashboard";

// Type for group tasting history items
interface GroupTasting {
  sessionId: string;
  packageName: string;
  winesTasted: number;
  startedAt: string;
  completedAt: string | null;
  source: "group" | "solo";
  userScore: string;
  groupScore: string;
}

// ============================================================================
// USER MENU COMPONENT
// ============================================================================

function UserMenu({
  userEmail,
  onLogout
}: {
  userEmail: string;
  onLogout: () => void;
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2 text-white/60 hover:text-white/80 transition-colors text-sm"
      >
        <span className="hidden sm:block truncate max-w-[150px]">
          {userEmail}
        </span>
        <UserIcon className="w-5 h-5 sm:hidden" />
        <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {showUserMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-white/40 text-xs">Signed in as</p>
              <p className="text-white text-sm truncate">{userEmail}</p>
            </div>
            <button
              onClick={() => {
                setShowUserMenu(false);
                onLogout();
              }}
              className="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// HEADER COMPONENT WITH USER MENU
// ============================================================================

function HomeHeader({
  userEmail,
  onLogout
}: {
  userEmail: string;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <img
          src="/logo-cata-horizontal.svg"
          alt="Cata"
          className="h-8 w-auto"
        />
        <UserMenu userEmail={userEmail} onLogout={onLogout} />
      </div>
    </header>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HomeV2() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Logout handler
  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", null);
      localStorage.removeItem("cata_user_email");
      queryClient.clear();
      setLocation("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Determine active tab based on current path
  const getActiveTab = (): TabKey => {
    if (location.includes("/group")) return "group";
    if (location.includes("/dashboard")) return "dashboard";
    return "solo";
  };

  const activeTab = getActiveTab();

  // Check if user is authenticated
  const {
    data: authData,
    isLoading: authLoading,
    refetch: refetchAuth,
  } = useQuery<{ user: User }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/me", null);
      if (!response.ok) {
        throw new Error("Not authenticated");
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const isAuthenticated = !!authData?.user;
  const user = authData?.user;

  // Redirect new users (0 tastings, onboarding not done) to onboarding quiz
  useEffect(() => {
    if (
      user &&
      !user.onboardingCompleted &&
      (user.tastingsCompleted ?? 0) === 0
    ) {
      setLocation("/onboarding");
    }
  }, [user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await apiRequest("POST", "/api/auth", {
        email: email.trim(),
      });
      if (response.ok) {
        refetchAuth();
      } else {
        const error = await response.json();
        setLoginError(error.error || "Login failed");
      }
    } catch (error) {
      setLoginError("Login failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  // Login view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
            <div className="text-center mb-8">
              <img
                src="/logo-cata.svg"
                alt="Cata - Wine Tasting"
                className="w-20 h-20 mx-auto mb-4"
              />
              <h1 className="text-2xl font-bold text-white mb-2">
                Cata
              </h1>
              <p className="text-white/60">Your personal sommelier</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="bg-white/10 border-white/10 text-white placeholder:text-white/40 py-3"
                  required
                />
              </div>

              {loginError && (
                <p className="text-red-400 text-sm text-center">{loginError}</p>
              )}

              <Button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 rounded-xl"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            <p className="text-white/40 text-xs text-center mt-6">
              No password required. We'll create an account if you're new.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Authenticated layout with three tabs
  return (
    <div className="min-h-screen bg-gradient-primary">
      <main className="pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "solo" && (
            <motion.div
              key="solo"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <SoloTabContent user={user!} onLogout={handleLogout} />
            </motion.div>
          )}
          {activeTab === "group" && (
            <motion.div
              key="group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <GroupTabContent user={user!} onLogout={handleLogout} />
            </motion.div>
          )}
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <DashboardTabContent user={user!} onLogout={handleLogout} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} />
    </div>
  );
}

// ============================================================================
// SOLO TAB CONTENT
// ============================================================================

interface TabContentProps {
  user: User;
  onLogout: () => void;
}

interface TastingStats {
  total: number;
  solo: number;
  group: number;
}

interface PreferencesData {
  preferences: Record<string, number | null>;
  tastingCount: number;
  summary: string;
}

interface DashboardData {
  user: {
    email: string;
    displayName: string;
  };
  topPreferences?: {
    topRegion: { name: string; count: number; avgRating: number };
    topGrape: { name: string; count: number; avgRating: number };
    averageRating: { score: number; totalWines: number };
  };
  unifiedTastingStats?: TastingStats;
}

function SoloTabContent({ user, onLogout }: TabContentProps) {
  const [, setLocation] = useLocation();

  // Get dashboard data with unified stats
  const { data: dashboardData } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard", user.email],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/dashboard/${encodeURIComponent(user.email)}`,
        null
      );
      if (!response.ok) throw new Error("Failed to fetch dashboard");
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Get solo tastings
  const { data: tastingsData, isLoading: tastingsLoading } = useQuery<{
    tastings: Tasting[];
    total: number;
  }>({
    queryKey: ["/api/solo/tastings"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/solo/tastings?limit=10",
        null
      );
      return response.json();
    },
  });

  // Get preferences
  const { data: preferencesData } = useQuery<PreferencesData>({
    queryKey: ["/api/solo/preferences"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/solo/preferences", null);
      return response.json();
    },
  });

  // Get active journey
  const { data: journeysData } = useQuery<{ journeys: any[] }>({
    queryKey: ["/api/journeys/user/progress"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/journeys/user/progress",
        null
      );
      if (!response.ok) return { journeys: [] };
      return response.json();
    },
  });

  const stats = dashboardData?.unifiedTastingStats || {
    total: preferencesData?.tastingCount || 0,
    solo: preferencesData?.tastingCount || 0,
    group: 0,
  };

  const activeJourney = journeysData?.journeys?.find(
    (j) => j.completedChapters < j.totalChapters
  );

  return (
    <div className="min-h-screen">
      <HomeHeader userEmail={user.email} onLogout={onLogout} />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-white mb-1">Solo Tastings</h1>
          <p className="text-white/60">
            Your personal wine journey & learning
          </p>
        </motion.div>

        {/* Two Primary Actions - Equal Weight */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          {/* Solo Tasting Card */}
          <motion.button
            onClick={() => setLocation("/tasting/new")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-left min-h-[160px] flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-white card-shimmer shadow-lg shadow-rose-500/25"
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
              <Wine className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Solo Tasting</h3>
            <p className="text-white/70 text-sm">Record your wine experience</p>
          </motion.button>

          {/* Learning Journeys Card - EQUAL styling */}
          <motion.button
            onClick={() => setLocation("/journeys")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-left min-h-[160px] flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-white card-shimmer shadow-lg shadow-indigo-500/25"
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Learning Journeys</h3>
            <p className="text-white/70 text-sm">Structured wine education</p>
          </motion.button>
        </motion.div>

        {/* Continue Journey Card */}
        {activeJourney && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">
                Continue Journey
              </h2>
            </div>
            <h3 className="text-white font-medium mb-2">
              {activeJourney.journeyTitle}
            </h3>
            <div className="flex items-center gap-2 text-sm text-white/60 mb-3">
              <span>
                Chapter {activeJourney.completedChapters + 1} of{" "}
                {activeJourney.totalChapters}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{
                  width: `${(activeJourney.completedChapters / activeJourney.totalChapters) * 100}%`,
                }}
              />
            </div>
            <Button
              onClick={() => setLocation(`/journeys/${activeJourney.journeyId}`)}
              className="w-full bg-white/10 hover:bg-white/20 text-white"
            >
              Continue Learning
            </Button>
          </motion.div>
        )}

        {/* Taste Profile Summary */}
        {preferencesData &&
          preferencesData.tastingCount > 0 &&
          preferencesData.summary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">
                  Your Taste Profile
                </h2>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                {preferencesData.summary}
              </p>

              {dashboardData?.topPreferences && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {dashboardData.topPreferences.topRegion?.name && (
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                      {dashboardData.topPreferences.topRegion.name}
                    </span>
                  )}
                  {dashboardData.topPreferences.topGrape?.name && (
                    <span className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-xs">
                      {dashboardData.topPreferences.topGrape.name}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}

        {/* Recent Tastings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Recent Solo Tastings
          </h2>

          {tastingsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : tastingsData?.tastings && tastingsData.tastings.length > 0 ? (
            <div className="space-y-3">
              {tastingsData.tastings.slice(0, 5).map((tasting, index) => (
                <motion.div
                  key={tasting.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  onClick={() => setLocation(`/solo/tasting/${tasting.id}`)}
                  className={`bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 cursor-pointer hover:bg-white/15 transition-colors border-l-[3px] ${
                    tasting.wineType === "red"
                      ? "border-l-red-500"
                      : tasting.wineType === "white"
                        ? "border-l-yellow-400"
                        : tasting.wineType === "rosé" || tasting.wineType === "rose"
                          ? "border-l-pink-400"
                          : tasting.wineType === "sparkling"
                            ? "border-l-amber-300"
                            : "border-l-purple-400"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {tasting.wineName}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-sm text-white/60 mt-1">
                        {tasting.wineType && (
                          <span className="bg-white/10 px-2 py-0.5 rounded capitalize">
                            {tasting.wineType}
                          </span>
                        )}
                        {tasting.wineRegion && (
                          <span className="truncate">{tasting.wineRegion}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-sm">
                            {(tasting.responses as Record<string, any>)?.overall
                              ?.rating || "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-white/40 text-xs mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(tasting.tastedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/40" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center py-14 bg-gradient-to-br from-white/5 to-white/0 rounded-2xl border border-dashed border-white/15"
            >
              <motion.div
                animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Wine className="w-14 h-14 text-purple-400/40 mx-auto mb-4" />
              </motion.div>
              <p className="text-white/70 text-lg font-medium mb-2">Your journal awaits</p>
              <p className="text-white/40 text-sm mb-6 max-w-[240px] mx-auto">
                Taste your first wine and start building your personal palate profile
              </p>
              <Button
                onClick={() => setLocation("/tasting/new")}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                First Tasting
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================================
// GROUP TAB CONTENT
// ============================================================================

type GroupMode = "selection" | "join" | "host";

function GroupTabContent({ user, onLogout }: TabContentProps) {
  const [, setLocation] = useLocation();
  const [groupMode, setGroupMode] = useState<GroupMode>("selection");
  const [sessionId, setSessionId] = useState("");
  const [packageCode, setPackageCode] = useState("");
  const [hostDisplayName, setHostDisplayName] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [sessionValidationError, setSessionValidationError] = useState<
    string | null
  >(null);
  const { triggerHaptic } = useHaptics();
  const { activeSession, endSession } = useSessionPersistence();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch group tasting history
  const { data: groupHistoryData, isLoading: historyLoading } = useQuery<GroupTasting[]>({
    queryKey: ["dashboard", "history", user.email, "group"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/dashboard/${encodeURIComponent(user.email)}/history?limit=10`,
        null
      );
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch history");
      }
      const data = await response.json();
      const history = data.history || [];
      return history.filter((t: GroupTasting) => t.source === "group");
    },
    enabled: !!user.email,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  // Check for active session on mount
  useEffect(() => {
    if (activeSession && activeSession.isActive) {
      setShowRestoreModal(true);
    }
  }, [activeSession]);

  // Clear validation error when session ID changes
  useEffect(() => {
    if (sessionValidationError && sessionId) {
      setSessionValidationError(null);
    }
  }, [sessionId, sessionValidationError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Mutation for creating a new session (host flow)
  const createSessionMutation = useMutation({
    mutationFn: async (data: {
      packageCode: string;
      hostDisplayName: string;
    }) => {
      const sessionResponse = await apiRequest("POST", "/api/sessions", {
        packageCode: data.packageCode,
        hostDisplayName: data.hostDisplayName.trim() || "Host",
        createHost: true,
      });

      if (!sessionResponse.ok) {
        throw new Error("Failed to create session");
      }

      return sessionResponse.json();
    },
    onSuccess: (sessionData) => {
      triggerHaptic("success");
      setLocation(
        `/host/${sessionData.session.id}/${sessionData.hostParticipantId}`
      );
    },
    onError: () => {
      triggerHaptic("error");
    },
  });

  // Mutation for validating session before joining
  const validateSessionMutation = useMutation({
    mutationFn: async (sessionCode: string) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/sessions/${sessionCode}`, {
        credentials: "include",
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "Session not found. Please check your code and try again."
          );
        }
        throw new Error("Failed to validate session");
      }

      const session = await response.json();

      if (session.status !== "active") {
        throw new Error("Session is not active. Please check with the host.");
      }

      return session;
    },
    onSuccess: () => {
      triggerHaptic("success");
      setSessionValidationError(null);
      setLocation(
        `/join?sessionId=${encodeURIComponent(sessionId.trim().toUpperCase())}`
      );
    },
    onError: (error: Error) => {
      if (error.name !== "AbortError") {
        triggerHaptic("error");
        setSessionValidationError(error.message);
      }
    },
  });

  const handleJoinSession = () => {
    if (sessionId.trim().length >= 4) {
      setSessionValidationError(null);
      validateSessionMutation.mutate(sessionId.trim().toUpperCase());
    }
  };

  const handleHostSession = () => {
    if (packageCode.trim().length === 6 && hostDisplayName.trim()) {
      triggerHaptic("success");
      createSessionMutation.mutate({
        packageCode: packageCode.trim().toUpperCase(),
        hostDisplayName: hostDisplayName.trim(),
      });
    }
  };

  const handleQRScan = (scannedData: string) => {
    setSessionId(scannedData);
    setShowQRScanner(false);
    setSessionValidationError(null);
    validateSessionMutation.mutate(scannedData.trim().toUpperCase());
  };

  const handleBack = () => {
    triggerHaptic("navigation");
    setGroupMode("selection");
    setSessionId("");
    setPackageCode("");
    setHostDisplayName("");
    setSessionValidationError(null);
  };

  const handleRestoreSession = () => {
    if (activeSession) {
      setShowRestoreModal(false);
      triggerHaptic("success");
      setLocation(
        `/session/${activeSession.sessionId}/${activeSession.participantId}`
      );
    }
  };

  const handleStartFresh = async () => {
    setShowRestoreModal(false);
    await endSession();
    triggerHaptic("navigation");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {groupMode !== "selection" ? (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-400" />
              <span className="text-white font-semibold">Group Tastings</span>
            </div>
          )}
          <UserMenu userEmail={user.email} onLogout={onLogout} />
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {groupMode === "selection" && (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Welcome Section */}
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  Group Sessions
                </h1>
                <p className="text-white/60">
                  Host or join live wine tasting experiences
                </p>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Join Session Card */}
                <motion.button
                  onClick={() => setGroupMode("join")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-left"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Join Session
                  </h3>
                  <p className="text-white/70 text-sm">
                    Enter a code or scan QR to join a live tasting
                  </p>
                </motion.button>

                {/* Host Session Card */}
                <motion.button
                  onClick={() => setGroupMode("host")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-left"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Host Session
                  </h3>
                  <p className="text-white/70 text-sm">
                    Start a wine tasting with your package code
                  </p>
                </motion.button>
              </div>

              {/* Active Session Card */}
              {activeSession && activeSession.isActive && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-green-500/20 to-green-500/5 backdrop-blur-xl rounded-2xl p-5 border border-green-500/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <h2 className="text-lg font-semibold text-white">
                      Active Session
                    </h2>
                  </div>
                  <p className="text-white/70 text-sm mb-4">
                    You have an active session in progress
                  </p>
                  <Button
                    onClick={() =>
                      setLocation(
                        `/session/${activeSession.sessionId}/${activeSession.participantId}`
                      )
                    }
                    className="w-full bg-green-500 hover:bg-green-600 text-white"
                  >
                    Rejoin Session
                  </Button>
                </motion.div>
              )}

              {/* Recent Group Tastings */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">
                  Recent Group Tastings
                </h2>

                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  </div>
                ) : groupHistoryData && groupHistoryData.length > 0 ? (
                  <div className="space-y-3">
                    {groupHistoryData.slice(0, 5).map((tasting) => (
                      <motion.div
                        key={tasting.sessionId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() =>
                          setLocation(
                            `/dashboard/${encodeURIComponent(user.email)}/tasting/${tasting.sessionId}`
                          )
                        }
                        className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 cursor-pointer hover:bg-white/15 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-medium truncate">
                              {tasting.packageName}
                            </h3>
                            <div className="flex flex-wrap gap-2 text-sm text-white/60 mt-1">
                              <span>{tasting.winesTasted} wines</span>
                              <span>•</span>
                              <span>
                                {new Date(tasting.startedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-white/40" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gradient-to-br from-white/5 to-white/0 rounded-2xl border border-white/10">
                    <Users className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <p className="text-white/60">
                      Your group tasting history will appear here
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {groupMode === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <JoinSessionView
                sessionId={sessionId}
                setSessionId={setSessionId}
                handleJoinSession={handleJoinSession}
                setShowQRScanner={setShowQRScanner}
                triggerHaptic={triggerHaptic}
                isValidating={validateSessionMutation.isPending}
                validationError={sessionValidationError}
              />
            </motion.div>
          )}

          {groupMode === "host" && (
            <motion.div
              key="host"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <HostSessionView
                packageCode={packageCode}
                setPackageCode={setPackageCode}
                hostDisplayName={hostDisplayName}
                setHostDisplayName={setHostDisplayName}
                handleHostSession={handleHostSession}
                isCreatingSession={createSessionMutation.isPending}
                triggerHaptic={triggerHaptic}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showQRScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowQRScanner(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">Scan QR Code</h3>
                <Button
                  variant="ghost"
                  onClick={() => setShowQRScanner(false)}
                  className="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10"
                >
                  <ArrowLeft size={20} />
                </Button>
              </div>

              <div className="relative mb-6">
                <QRScanner
                  onScan={handleQRScan}
                  onError={() => setShowQRScanner(false)}
                  className="w-full rounded-2xl overflow-hidden"
                />
              </div>

              <div className="text-center space-y-3">
                <p className="text-white/80 text-base font-medium">
                  Point camera at QR code
                </p>
                <p className="text-white/60 text-sm">
                  Make sure the code is clearly visible
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Restore Modal */}
      <SessionRestoreModal
        isOpen={showRestoreModal}
        sessionData={activeSession}
        onRestore={handleRestoreSession}
        onStartFresh={handleStartFresh}
      />
    </div>
  );
}

// ============================================================================
// DASHBOARD TAB CONTENT
// ============================================================================

interface UserDashboardData {
  user: {
    email: string;
    displayName: string;
    totalSessions: number;
    completedSessions: number;
    totalResponses: number;
    uniqueWinesTasted: number;
  };
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

interface TasteProfile {
  redWineProfile: {
    summary?: string;
  };
  whiteWineProfile: {
    summary?: string;
  };
}

interface SommelierTips {
  preferenceProfile: string;
  redDescription: string;
  whiteDescription: string;
  questions: string[];
}

function DashboardTabContent({ user, onLogout }: TabContentProps) {
  const [, setLocation] = useLocation();

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } =
    useQuery<UserDashboardData>({
      queryKey: [`/api/dashboard/${user.email}`],
      enabled: !!user.email,
    });

  // Fetch solo preferences
  const { data: soloPreferences } = useQuery<PreferencesData>({
    queryKey: ["/api/solo/preferences"],
  });

  // Fetch taste profile
  const { data: tasteProfile } = useQuery<TasteProfile>({
    queryKey: [`/api/dashboard/${user.email}/taste-profile`],
    enabled: !!user.email,
  });

  // Fetch sommelier tips
  const { data: sommelierTips, isLoading: tipsLoading } =
    useQuery<SommelierTips>({
      queryKey: [`/api/dashboard/${user.email}/sommelier-tips`],
      enabled: !!user.email,
    });

  const stats = dashboardData?.unifiedTastingStats || {
    total:
      (dashboardData?.stats?.totalTastings || 0) +
      (soloPreferences?.tastingCount || 0),
    solo: soloPreferences?.tastingCount || 0,
    group: dashboardData?.stats?.totalTastings || 0,
  };

  if (dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-purple-400" />
            <span className="text-white font-semibold">Your Dashboard</span>
          </div>
          <UserMenu userEmail={user.email} onLogout={onLogout} />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-white mb-1">All Your Data</h1>
          <p className="text-white/60">
            Combined insights from solo & group tastings
          </p>
        </motion.div>

        {/* Unified Stats */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-3 gap-3"
        >
          <StatCard
            icon={Wine}
            label="Total"
            value={stats.total}
            color="purple"
          />
          <StatCard
            icon={UserIcon}
            label="Solo"
            value={stats.solo}
            color="blue"
          />
          <StatCard icon={Users} label="Group" value={stats.group} color="pink" />
        </motion.div>

        {/* Top Preferences */}
        {dashboardData?.topPreferences && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-purple-400" />
                <span className="text-white/60 text-sm">Top Region</span>
              </div>
              <p className="text-white font-semibold">
                {dashboardData.topPreferences.topRegion?.name || "Not enough data"}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Wine className="w-4 h-4 text-pink-400" />
                <span className="text-white/60 text-sm">Top Grape</span>
              </div>
              <p className="text-white font-semibold">
                {dashboardData.topPreferences.topGrape?.name || "Not enough data"}
              </p>
            </div>
          </motion.div>
        )}

        {/* Wine Profiles */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-semibold text-white">Wine Profiles</h2>

          {/* Red Wine Profile */}
          <motion.div
            whileHover={{ scale: 1.01, y: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-gradient-to-br from-red-500/10 to-white/5 backdrop-blur-xl rounded-2xl p-5 border border-red-500/20 cursor-pointer hover:border-red-500/40 transition-colors"
          >
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              Red Wine Profile
            </h3>
            <p className="text-white/70 text-sm">
              {tasteProfile?.redWineProfile?.summary ||
                "Continue tasting red wines to build your profile"}
            </p>
          </motion.div>

          {/* White Wine Profile */}
          <motion.div
            whileHover={{ scale: 1.01, y: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-gradient-to-br from-yellow-500/10 to-white/5 backdrop-blur-xl rounded-2xl p-5 border border-yellow-500/20 cursor-pointer hover:border-yellow-500/40 transition-colors"
          >
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              White Wine Profile
            </h3>
            <p className="text-white/70 text-sm">
              {tasteProfile?.whiteWineProfile?.summary ||
                "Continue tasting white wines to build your profile"}
            </p>
          </motion.div>
        </motion.div>

        {/* Sommelier Tips */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">
              What to Say at the Restaurant
            </h2>
          </div>

          {tipsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            </div>
          ) : sommelierTips ? (
            <div className="space-y-4">
              <p className="text-white/80 text-sm">
                {sommelierTips.preferenceProfile}
              </p>
              {sommelierTips.questions && sommelierTips.questions.length > 0 && (
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">
                    Questions to Ask:
                  </h3>
                  <ul className="space-y-2">
                    {sommelierTips.questions.slice(0, 3).map((q, i) => (
                      <li
                        key={i}
                        className="text-white/70 text-sm flex items-start gap-2"
                      >
                        <span className="text-purple-400">•</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-white/60 text-sm">
              Complete more tastings to get personalized sommelier tips
            </p>
          )}
        </motion.div>

        {/* View Full Dashboard Link */}
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.3 }}
          onClick={() => setLocation(`/dashboard/${encodeURIComponent(user.email)}`)}
          className="w-full bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex items-center justify-between group hover:bg-white/15 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-white font-semibold text-lg">
                Full Dashboard
              </h3>
              <p className="text-white/60 text-sm">
                Wine collection, filters, map & more
              </p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
        </motion.button>
      </div>
    </div>
  );
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function CountUp({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current || target === 0) return;
    hasAnimated.current = true;

    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return <span ref={ref}>{count}</span>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Wine;
  label: string;
  value: number;
  color: "purple" | "blue" | "pink";
}) {
  const colorClasses = {
    purple: "bg-purple-500/20 text-purple-400",
    blue: "bg-blue-500/20 text-blue-400",
    pink: "bg-pink-500/20 text-pink-400",
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorClasses[color]}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-bold text-white">
        <CountUp target={value} />
      </div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
