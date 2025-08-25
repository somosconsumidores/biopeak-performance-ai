import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface DanielsVo2MaxData {
  currentVo2Max: number | null;
  bestVo2Max: number | null;
  trend: 'up' | 'down' | 'stable' | null;
  change: number | null;
  bestActivity: {
    activityId: string;
    distance: number;
    time: number;
    date: string;
    type: string;
  } | null;
  loading: boolean;
  error: string | null;
}

// Daniels' VO2max calculation function
export function danielsVo2MaxFromActivity(
  distanceMeters: number,
  timeMinutes: number
): number | null {
  if (!distanceMeters || !timeMinutes || distanceMeters <= 0 || timeMinutes <= 0) {
    return null;
  }

  // Minimum distance threshold for meaningful calculation
  if (distanceMeters < 800) {
    return null;
  }

  // Calculate velocity in m/s
  const velocityMs = distanceMeters / (timeMinutes * 60);
  
  // Daniels' formula: VO2max = -4.6 + 0.182258 * (velocity in m/min) + 0.000104 * (velocity in m/min)^2
  const velocityMmin = velocityMs * 60; // Convert to m/min
  const vo2Result = -4.6 + 0.182258 * velocityMmin + 0.000104 * Math.pow(velocityMmin, 2);
  
  return vo2Result > 0 ? Math.round(vo2Result * 10) / 10 : null;
}

export function useDanielsVo2Max(): DanielsVo2MaxData {
  const { user } = useAuth();
  const [data, setData] = useState<DanielsVo2MaxData>({
    currentVo2Max: null,
    bestVo2Max: null,
    trend: null,
    change: null,
    bestActivity: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!user) {
      setData(prev => ({ ...prev, loading: false, error: null }));
      return;
    }

    fetchDanielsVo2Max();
  }, [user]);

  const fetchDanielsVo2Max = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Fetch running activities from the last 90 days for analysis
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: activities, error } = await supabase
        .from('v_all_activities_with_vo2_daniels')
        .select('*')
        .eq('user_id', user!.id)
        .gte('activity_date', ninetyDaysAgo.toISOString().split('T')[0])
        .not('vo2_max_daniels', 'is', null)
        .order('activity_date', { ascending: false });

      if (error) {
        console.error('Error fetching activities for Daniels VO2max:', error);
        setData(prev => ({ ...prev, loading: false, error: error.message }));
        return;
      }

      if (!activities || activities.length === 0) {
        setData(prev => ({
          ...prev,
          loading: false,
          currentVo2Max: null,
          bestVo2Max: null,
          trend: null,
          change: null,
          bestActivity: null
        }));
        return;
      }

      // Process activities
      const processedActivities = activities.map(activity => ({
        ...activity,
        vo2Max: activity.vo2_max_daniels,
        pace: activity.total_time_minutes && activity.total_distance_meters 
          ? (activity.total_time_minutes * 60) / (activity.total_distance_meters / 1000) 
          : null
      }));

      // Find best VO2max overall
      const bestVo2Max = Math.max(...processedActivities.map(a => a.vo2Max));
      const bestActivity = processedActivities.find(a => a.vo2Max === bestVo2Max);

      // Get recent VO2max (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentActivities = processedActivities.filter(
        activity => new Date(activity.activity_date!) >= thirtyDaysAgo
      );

      let currentVo2Max = null;
      if (recentActivities.length > 0) {
        // Use the best VO2max from recent activities
        currentVo2Max = Math.max(...recentActivities.map(a => a.vo2Max));
      }

      // Calculate trend (compare last 30 days vs previous 30 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      const previousActivities = processedActivities.filter(
        activity => {
          const activityDate = new Date(activity.activity_date!);
          return activityDate >= sixtyDaysAgo && activityDate < thirtyDaysAgo;
        }
      );

      let trend: 'up' | 'down' | 'stable' | null = null;
      let change: number | null = null;

      if (currentVo2Max && previousActivities.length > 0) {
        const previousVo2Max = Math.max(...previousActivities.map(a => a.vo2Max));
        change = currentVo2Max - previousVo2Max;
        
        if (Math.abs(change) < 1) {
          trend = 'stable';
        } else if (change > 0) {
          trend = 'up';
        } else {
          trend = 'down';
        }
      }

      setData({
        currentVo2Max,
        bestVo2Max,
        trend,
        change,
        bestActivity: bestActivity ? {
          activityId: bestActivity.activity_id!,
          distance: bestActivity.total_distance_meters || 0,
          time: bestActivity.total_time_minutes || 0,
          date: bestActivity.activity_date!,
          type: bestActivity.activity_type || 'Run'
        } : null,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error in fetchDanielsVo2Max:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  return data;
}