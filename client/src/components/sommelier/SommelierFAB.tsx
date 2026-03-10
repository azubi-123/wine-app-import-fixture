import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { SommelierChatSheet } from "./SommelierChatSheet";
import { useHaptics } from "@/hooks/useHaptics";

// Routes where the FAB should be hidden (active experiences)
const HIDDEN_ROUTE_PATTERNS = [
  /^\/onboarding$/,
  /^\/tasting\/[^/]+\/[^/]+$/, // /tasting/:sessionId/:participantId
  /^\/tasting\/new$/,
  /^\/solo\/new$/,
  /^\/completion\//,
  /^\/host\//,
];

// Routes where the FAB should be shown
const SHOWN_ROUTE_PATTERNS = [
  /^\/home/,
  /^\/journeys/,
  /^\/sommelier$/,
  /^\/editor\//,
  /^\/dashboard\//,
];

/** Minimal line-drawing icon: a figure swirling a wine glass */
function PierreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Head */}
      <circle cx="11" cy="6" r="2.8" />
      {/* Shoulder line */}
      <path d="M8 9 C6.5 10 6 12 6 14" />
      <path d="M14 9 C15 10 16 10.5 17.5 10.5" />
      {/* Wine glass */}
      <path d="M17 6.5 L18 9" />
      <path d="M21 6.5 L20 9" />
      <path d="M18 9 L20 9" />
      <line x1="19" y1="9" x2="19" y2="11" />
      <line x1="17.5" y1="11" x2="20.5" y2="11" />
      {/* Swirl arc */}
      <path d="M16.5 5.5 C17.5 3.5 20.5 4 21.5 5.5" opacity="0.6" />
    </svg>
  );
}

export function SommelierFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isWelcome, setIsWelcome] = useState(false);
  const [location] = useLocation();
  const { triggerHaptic } = useHaptics();

  // Use the same auth query as HomeV2 so they share cache state.
  // retry:1 + placeholderData prevents chat death on tab-switch refetch failures.
  const { data: authData } = useQuery<{ user: { id: number; email: string } }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const isAuthenticated = !!authData?.user;

  // Determine visibility — require auth + allowed route
  const isHidden = HIDDEN_ROUTE_PATTERNS.some((p) => p.test(location));
  const isShown = SHOWN_ROUTE_PATTERNS.some((p) => p.test(location));

  // Check sessionStorage for pierre_welcome flag (survives redirects unlike URL params).
  // Opens Pierre immediately — no setTimeout because any dependency change would
  // cancel the timeout after the flag is already consumed, with no way to retry.
  useEffect(() => {
    if (sessionStorage.getItem("pierre_welcome") && isAuthenticated && isShown && !isHidden) {
      sessionStorage.removeItem("pierre_welcome");
      setIsWelcome(true);
      setIsOpen(true);
    }
  }, [location, isAuthenticated, isShown, isHidden]);

  // FAB button only shows on allowed routes when not chatting
  const showFABButton = isAuthenticated && !isHidden && isShown && !isOpen;

  // Chat sheet stays mounted while open, regardless of route
  const showChatSheet = isAuthenticated && isOpen;

  return (
    <>
      <AnimatePresence>
        {showFABButton && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            onClick={() => {
              triggerHaptic("selection");
              setIsOpen(true);
            }}
            className="fixed right-4 bottom-24 z-40 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 shadow-lg shadow-purple-900/40 active:shadow-md"
            aria-label="Chat with Pierre, your AI sommelier"
          >
            <PierreIcon className="w-6 h-6 text-white" />
            <span className="text-sm font-medium text-white">Pierre</span>
          </motion.button>
        )}
      </AnimatePresence>

      {showChatSheet && (
        <SommelierChatSheet open={isOpen} onOpenChange={setIsOpen} isWelcome={isWelcome} />
      )}
    </>
  );
}
