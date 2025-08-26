import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { PermissionOnboarding } from "./components/PermissionOnboarding";
import { SurveyPopup } from "./components/SurveyPopup";
import { useSurveyPopup } from "./hooks/useSurveyPopup";
import { useState, useEffect } from "react";

import { LandingPage } from "./pages/LandingPage";
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
import { AdminPanel } from "./pages/AdminPanel";
import SleepFeedbacks from "./pages/SleepFeedbacks";
import { Onboarding } from "./pages/Onboarding";
import TrainingPlan from "./pages/TrainingPlan";
import MobileBottomBar from "./components/MobileBottomBar";
import { useOnboarding } from "./hooks/useOnboarding";

const queryClient = new QueryClient();

// App component that includes the route protection logic
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="biopeak-ui-theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <AppRoutes />
            <PWAInstallPrompt />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
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

  return (
    <BrowserRouter>
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
    </BrowserRouter>
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
  
  // If user is authenticated, always redirect to dashboard
  // Don't check onboarding here as it can cause redirect loops
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

export default App;