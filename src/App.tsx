import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { usePlatform } from "./hooks/usePlatform";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { PlatformDebugger } from "./components/PlatformDebugger";
import { PermissionOnboarding } from "./components/PermissionOnboarding";
import { SurveyPopup } from "./components/SurveyPopup";
import { useSurveyPopup } from "./hooks/useSurveyPopup";
import { useState, useEffect } from "react";

import { LandingPage } from "./pages/LandingPage";
import { SalesLandingPage } from "./pages/SalesLandingPage";
import { Dashboard } from "./pages/Dashboard";
import { WorkoutSession } from "./pages/WorkoutSession";
import { WorkoutComparison } from "./pages/WorkoutComparison";
import { Insights } from "./pages/Insights";
import { Profile } from "./pages/Profile";
import { ProfileEdit } from "./pages/ProfileEdit";
import TrainingSession from "./components/TrainingSession";
import { Auth } from "./pages/Auth";
import { ResetPassword } from "./pages/ResetPassword";
import { GarminSync } from "./pages/GarminSync";
import { GarminCallback } from "./pages/GarminCallback";
import PolarCallback from "./pages/PolarCallback";
import StravaCallback from "./pages/StravaCallback";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { TermosCondicoes } from "./pages/TermosCondicoes";
import { AdminPanel } from "./pages/AdminPanel";
import { AdminSubscriptions } from "./pages/AdminSubscriptions";
import SleepFeedbacks from "./pages/SleepFeedbacks";
import { Onboarding } from "./pages/Onboarding";
import TrainingPlan from "./pages/TrainingPlan";
import { PremiumStats } from "./pages/PremiumStats";
import Paywall from "./pages/Paywall";
import Paywall2 from "./pages/Paywall2";
import MobileBottomBar from "./components/MobileBottomBar";
import { useOnboarding } from "./hooks/useOnboarding";

import RootErrorBoundary from "./components/RootErrorBoundary";

const queryClient = new QueryClient();

// App component that includes the route protection logic
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <ThemeProvider defaultTheme="dark" storageKey="biopeak-ui-theme">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <AppRoutes />
              {import.meta.env.DEV && <PlatformDebugger />}
              <PWAInstallPrompt />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </RootErrorBoundary>
    </QueryClientProvider>
  );
};

// Routes component that has access to AuthProvider
function AppRoutes() {
  const { user, loading } = useAuth();
  const { checkOnboardingStatus } = useOnboarding();
  const { currentSurvey, isVisible: isSurveyVisible, submitResponse, dismissSurvey } = useSurveyPopup();
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      // Check if user has seen permission onboarding
      const hasSeenPermissionDialog = localStorage.getItem('biopeak-permissions-onboarding');
      if (!hasSeenPermissionDialog) {
        setPermissionsDialogOpen(true);
      }
    }
  }, [user, loading]);

  const handlePermissionsComplete = () => {
    localStorage.setItem('biopeak-permissions-onboarding', 'true');
    setPermissionsDialogOpen(false);
  };

  // Use the platform hook for proper native detection
  const { isNative, platform } = usePlatform();
  
  // Debug logging
  console.log('🔍 Platform detection:', { platform, isNative, capacitor: !!(window as any)?.Capacitor });
  
  const Router = isNative ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        } />
        <Route path="/auth" element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        } />
        <Route path="/landingpage" element={
          <PublicRoute>
            <SalesLandingPage />
          </PublicRoute>
        } />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={
          <ProtectedRoute skipOnboardingCheck={true}>
            <Onboarding />
          </ProtectedRoute>
        } />
        <Route path="/garmin-callback" element={
          <ProtectedRoute skipOnboardingCheck={true}>
            <GarminCallback />
          </ProtectedRoute>
        } />
        <Route path="/polar-callback" element={
          <ProtectedRoute skipOnboardingCheck={true}>
            <PolarCallback />
          </ProtectedRoute>
        } />
        <Route path="/strava-callback" element={
          <ProtectedRoute skipOnboardingCheck={true}>
            <StravaCallback />
          </ProtectedRoute>
        } />
        <Route path="/garmin-sync" element={
          <ProtectedRoute skipOnboardingCheck={true}>
            <GarminSync />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/workouts" element={
          <ProtectedRoute>
            <WorkoutSession />
          </ProtectedRoute>
        } />
        <Route path="/comparison" element={
          <ProtectedRoute>
            <WorkoutComparison />
          </ProtectedRoute>
        } />
        <Route path="/insights" element={
          <ProtectedRoute>
            <Insights />
          </ProtectedRoute>
        } />
        <Route path="/sync" element={
          <ProtectedRoute skipOnboardingCheck={true}>
            <GarminSync />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/profile/edit" element={
          <ProtectedRoute>
            <ProfileEdit />
          </ProtectedRoute>
        } />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/termos-condicoes" element={<TermosCondicoes />} />
        <Route path="/training" element={
          <ProtectedRoute>
            <TrainingSession />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        } />
        <Route path="/admin/subscriptions" element={
          <ProtectedRoute>
            <AdminSubscriptions />
          </ProtectedRoute>
        } />
        <Route path="/sleep-feedbacks" element={
          <ProtectedRoute>
            <SleepFeedbacks />
          </ProtectedRoute>
        } />
        <Route path="/training-plan" element={
          <ProtectedRoute>
            <TrainingPlan />
          </ProtectedRoute>
        } />
        <Route path="/premium-stats" element={
          <ProtectedRoute>
            <PremiumStats />
          </ProtectedRoute>
        } />
        <Route path="/paywall" element={<Paywall2 />} />
        <Route path="/paywall2" element={<Paywall2 />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <MobileBottomBar />
      <PermissionOnboarding 
        open={permissionsDialogOpen} 
        onComplete={handlePermissionsComplete} 
      />
      
      {/* Survey Popup */}
      {isSurveyVisible && currentSurvey && (
        <SurveyPopup
          survey={currentSurvey}
          onSubmit={submitResponse}
          onDismiss={dismissSurvey}
        />
      )}
    </Router>
  );
}

// Protected Route Component - now inside AuthProvider context
function ProtectedRoute({ 
  children, 
  skipOnboardingCheck = false 
}: { 
  children: React.ReactNode;
  skipOnboardingCheck?: boolean;
}) {
  const { user, loading } = useAuth();
  const { checkOnboardingStatus, isOnboardingCompleted } = useOnboarding();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  
  useEffect(() => {
    const checkStatus = async () => {
      if (user && !skipOnboardingCheck) {
        console.log('🔍 PROTECTED_ROUTE: Checking onboarding status', { 
          userId: user.id, 
          localState: isOnboardingCompleted,
          pathname: window.location.pathname 
        });
        
        // If local state indicates completion, skip database check
        if (isOnboardingCompleted === true) {
          console.log('🔍 PROTECTED_ROUTE: Using local state - onboarding completed');
          setNeedsOnboarding(false);
          setIsCheckingOnboarding(false);
          return;
        }
        
        const isCompleted = await checkOnboardingStatus();
        console.log('🔍 PROTECTED_ROUTE: Database check result', { isCompleted });
        setNeedsOnboarding(!isCompleted);
      }
      setIsCheckingOnboarding(false);
    };
    
    if (user && !loading) {
      checkStatus();
    } else if (!loading) {
      setIsCheckingOnboarding(false);
    }
  }, [user, loading, skipOnboardingCheck, checkOnboardingStatus, isOnboardingCompleted]);
  
  if (loading || isCheckingOnboarding) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary">Carregando...</div>
    </div>;
  }
  
  if (!user) {
    console.log('🔍 PROTECTED_ROUTE: No user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }
  
  if (needsOnboarding && !skipOnboardingCheck && window.location.pathname !== '/onboarding') {
    console.log('🔍 PROTECTED_ROUTE: Needs onboarding, redirecting to /onboarding');
    return <Navigate to="/onboarding" replace />;
  }
  
  console.log('🔍 PROTECTED_ROUTE: Access granted', { 
    needsOnboarding, 
    skipOnboardingCheck, 
    pathname: window.location.pathname 
  });
  
  return <>{children}</>;
}

// Public Route Component - now inside AuthProvider context
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary">Carregando...</div>
    </div>;
  }
  
  // Se estiver na página de auth e houver parâmetro de plano, deixar a página processar
  const currentPath = window.location.pathname;
  const hasPlaneParam = window.location.search.includes('plan=');
  
  if (user && currentPath === '/auth' && hasPlaneParam) {
    console.log('🔍 PUBLIC_ROUTE: Permitindo processamento do auth com parâmetro de plano');
    return <>{children}</>;
  }
  
  // If user is authenticated, always redirect to dashboard
  // Don't check onboarding here as it can cause redirect loops
  if (user) {
    console.log('🔍 PUBLIC_ROUTE: Redirecionando usuário autenticado para dashboard');
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

export default App;