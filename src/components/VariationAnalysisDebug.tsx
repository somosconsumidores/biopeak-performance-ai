import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";

interface DebugInfo {
  platform: string;
  isNative: boolean;
  authStatus: string;
  storageTest: string;
  chartDataAvailable: boolean;
  healthkitDataAvailable: boolean;
}

export function VariationAnalysisDebug({ activityId }: { activityId?: string }) {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    if (!activityId) return;
    
    setLoading(true);
    
    try {
      const info: DebugInfo = {
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform(),
        authStatus: user ? 'Authenticated' : 'Not authenticated',
        storageTest: 'Testing...',
        chartDataAvailable: false,
        healthkitDataAvailable: false
      };

      // Test storage
      try {
        if (Capacitor.isNativePlatform()) {
          const { Preferences } = await import('@capacitor/preferences');
          await Preferences.set({ key: 'test_key', value: 'test_value' });
          const { value } = await Preferences.get({ key: 'test_key' });
          info.storageTest = value === 'test_value' ? 'Native storage OK' : 'Native storage failed';
          await Preferences.remove({ key: 'test_key' });
        } else {
          localStorage.setItem('test_key', 'test_value');
          const value = localStorage.getItem('test_key');
          info.storageTest = value === 'test_value' ? 'Web storage OK' : 'Web storage failed';
          localStorage.removeItem('test_key');
        }
      } catch (error) {
        info.storageTest = `Storage error: ${error}`;
      }

      // Test chart data availability
      try {
        const { data: chartData, error } = await supabase
          .from('activity_chart_data')
          .select('series_data, activity_source')
          .eq('activity_id', activityId)
          .single();
        
        info.chartDataAvailable = !error && chartData && Array.isArray(chartData.series_data);
      } catch (error) {
        console.error('Chart data test error:', error);
      }

      // Test HealthKit data availability (only for HealthKit activities)
      try {
        const { data: healthkitData, error } = await supabase
          .from('healthkit_raw_workout_data')
          .select('heart_rate_data')
          .eq('healthkit_uuid', activityId)
          .single();
        
        info.healthkitDataAvailable = !error && !!healthkitData && Array.isArray(healthkitData.heart_rate_data);
      } catch (error) {
        console.error('HealthKit data test error:', error);
        info.healthkitDataAvailable = false;
      }

      setDebugInfo(info);
    } catch (error) {
      console.error('Diagnostics error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!activityId) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">No activity selected for diagnostics</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Variation Analysis Diagnostics</h3>
        <Button 
          onClick={runDiagnostics} 
          disabled={loading}
          size="sm"
        >
          {loading ? 'Running...' : 'Run Diagnostics'}
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Activity ID: {activityId}
      </div>

      {debugInfo && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>Platform: <Badge variant="outline">{debugInfo.platform}</Badge></div>
            <div>Native: <Badge variant={debugInfo.isNative ? "default" : "secondary"}>{debugInfo.isNative ? 'Yes' : 'No'}</Badge></div>
          </div>
          
          <div className="space-y-2">
            <div>Auth Status: <Badge variant={debugInfo.authStatus.includes('Auth') ? "default" : "destructive"}>{debugInfo.authStatus}</Badge></div>
            <div>Storage: <Badge variant={debugInfo.storageTest.includes('OK') ? "default" : "destructive"}>{debugInfo.storageTest}</Badge></div>
            <div>Chart Data: <Badge variant={debugInfo.chartDataAvailable ? "default" : "secondary"}>{debugInfo.chartDataAvailable ? 'Available' : 'Not found'}</Badge></div>
            <div>HealthKit Data: <Badge variant={debugInfo.healthkitDataAvailable ? "default" : "secondary"}>{debugInfo.healthkitDataAvailable ? 'Available' : 'Not found'}</Badge></div>
          </div>
        </div>
      )}
    </Card>
  );
}