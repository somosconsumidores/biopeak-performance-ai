import { Header } from '@/components/Header';
import { MetabolicCalibrationCard } from '@/components/nutrition/MetabolicCalibrationCard';
import { NutritionDashboard } from '@/components/nutrition/NutritionDashboard';
import { useNutritionalProfile } from '@/hooks/useNutritionalProfile';
import { Utensils } from 'lucide-react';

export default function Nutrition() {
  const { hasMetabolicData, loading } = useNutritionalProfile();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container max-w-lg mx-auto px-4 pt-20 pb-8">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <Utensils className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Nutrição</h1>
            <p className="text-sm text-muted-foreground">Assistência nutricional de elite</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-48 bg-muted/20 rounded-lg" />
            <div className="h-32 bg-muted/20 rounded-lg" />
          </div>
        ) : !hasMetabolicData ? (
          <MetabolicCalibrationCard />
        ) : (
          <NutritionDashboard />
        )}
      </main>
    </div>
  );
}
