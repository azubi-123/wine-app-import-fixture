import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlossaryProvider } from "@/contexts/GlossaryContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDynamicViewportHeight } from "@/hooks/useDynamicViewportHeight";

// Static imports — always needed on first load
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";

// Lazy-loaded page components
const HomeV2 = lazy(() => import("@/pages/HomeV2"));
const SoloTastingNew = lazy(() => import("@/pages/SoloTastingNew"));
const SoloTastingDetail = lazy(() => import("@/pages/SoloTastingDetail"));
const UserDashboard = lazy(() => import("@/pages/UserDashboard"));
const OnboardingQuiz = lazy(() => import("@/pages/OnboardingQuiz"));

import { SommelierFAB } from "@/components/sommelier/SommelierFAB";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/onboarding" component={OnboardingQuiz} />

      {/* Unified home experience - Solo + Dashboard */}
      <Route path="/home" component={HomeV2} />
      <Route path="/home/dashboard" component={HomeV2} />
      <Route path="/home/:rest*" component={HomeV2} />
      <Route path="/tasting/new">
        <SoloTastingNew returnPath="/home" />
      </Route>

      {/* Redirects from old routes to new unified home */}
      <Route path="/solo">
        <Redirect to="/home" />
      </Route>
      <Route path="/solo/journal">
        <Redirect to="/home" />
      </Route>
      <Route path="/solo/profile">
        <Redirect to="/home/profile" />
      </Route>

      {/* Solo tasting routes */}
      <Route path="/solo/new">
        <SoloTastingNew />
      </Route>
      <Route path="/solo/tasting/:id" component={SoloTastingDetail} />

      {/* Dashboard */}
      <Route path="/dashboard/:email" component={UserDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize dynamic viewport height for proper mobile layout
  useDynamicViewportHeight();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GlossaryProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
              <Router />
            </Suspense>
            <SommelierFAB />
          </TooltipProvider>
        </GlossaryProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
