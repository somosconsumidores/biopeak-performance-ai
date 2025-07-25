import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import { useTokenRefresh } from "./hooks/useTokenRefresh";
import { LandingPage } from "./pages/LandingPage";
import { Dashboard } from "./pages/Dashboard";
import { WorkoutSession } from "./pages/WorkoutSession";
import { WorkoutComparison } from "./pages/WorkoutComparison";
import { Insights } from "./pages/Insights";
import { Profile } from "./pages/Profile";
import { ProfileEdit } from "./pages/ProfileEdit";
import { Auth } from "./pages/Auth";
import { ResetPassword } from "./pages/ResetPassword";
import { GarminSync } from "./pages/GarminSync";
import { GarminCallback } from "./pages/GarminCallback";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  // Initialize automatic token refresh for authenticated users
  useTokenRefresh();
  
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary">Carregando...</div>
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

// Public Route Component (redirects to dashboard if logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary">Carregando...</div>
    </div>;
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="biopeak-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
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
            <Route path="/garmin-callback" element={
              <ProtectedRoute>
                <GarminCallback />
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
              <ProtectedRoute>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </ThemeProvider>
  </QueryClientProvider>
);

export default App;
