import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Wine, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { BottomTabBar } from "./BottomTabBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HomeUserContext } from "@/contexts/HomeUserContext";
import type { User } from "@shared/schema";

interface HomeLayoutProps {
  children: ReactNode;
}

export function HomeLayout({ children }: HomeLayoutProps) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check if user is authenticated
  const { data: authData, isLoading: authLoading, refetch: refetchAuth } = useQuery<{ user: User }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/me", null);
      if (!response.ok) {
        throw new Error("Not authenticated");
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isAuthenticated = !!authData?.user;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await apiRequest("POST", "/api/auth", { email: email.trim() });
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

  const handleStartTasting = () => {
    setLocation("/tasting/new");
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
              <h1 className="text-2xl font-bold text-white mb-2">Cata</h1>
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

  // Authenticated layout with tab bar
  return (
    <HomeUserContext.Provider value={{ user: authData.user }}>
      <div className="min-h-screen bg-gradient-primary">
        {/* Main content area with bottom padding for tab bar */}
        <main className="pb-24">{children}</main>

        {/* Bottom Tab Bar */}
        <BottomTabBar onStartTasting={handleStartTasting} />
      </div>
    </HomeUserContext.Provider>
  );
}

export default HomeLayout;
