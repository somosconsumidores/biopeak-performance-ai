import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./components/providers/ThemeProvider";

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
import PolarCallback from "./pages/PolarCallback";
import StravaCallback from "./pages/StravaCallback";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { AdminPanel } from "./pages/AdminPanel";

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
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

// Routes component that has access to AuthProvider
function AppRoutes() {
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
        <Route path="/garmin-callback" element={
          <ProtectedRoute>
            <GarminCallback />
          </ProtectedRoute>
        } />
        <Route path="/polar-callback" element={
          <ProtectedRoute>
            <PolarCallback />
          </ProtectedRoute>
        } />
        <Route path="/strava-callback" element={
          <ProtectedRoute>
            <StravaCallback />
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
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        } />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

// Protected Route Component - now inside AuthProvider context
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
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

// Public Route Component - now inside AuthProvider context
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

export default App;
