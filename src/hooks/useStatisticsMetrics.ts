import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from './useAuth'

interface StatisticsMetrics {
  id: string
  user_id: string
  activity_id: string
  source_activity: string
  total_distance_km?: number
  total_time_minutes?: number
  average_pace_min_km?: number
  average_heart_rate?: number
  max_heart_rate?: number
  heart_rate_std_dev?: number
  pace_std_dev?: number
  heart_rate_cv_percent?: number
  pace_cv_percent?: number
  created_at: string
  updated_at: string
}

export function useStatisticsMetrics(activityId?: string) {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<StatisticsMetrics | null>(null)
  const [allMetrics, setAllMetrics] = useState<StatisticsMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch specific activity metrics
  useEffect(() => {
    if (!user || !activityId) return

    const fetchMetrics = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error: queryError } = await supabase
          .from('statistics_metrics')
          .select('*')
          .eq('user_id', user.id)
          .eq('activity_id', activityId)
          .single()

        if (queryError && queryError.code !== 'PGRST116') {
          throw queryError
        }

        setMetrics(data)
      } catch (err) {
        console.error('Error fetching statistics metrics:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [user, activityId])

  // Fetch all user metrics
  const fetchAllMetrics = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('statistics_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (queryError) {
        throw queryError
      }

      setAllMetrics(data || [])
    } catch (err) {
      console.error('Error fetching all statistics metrics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics for an activity
  const calculateMetrics = async (activityId: string, sourceActivity: string) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: funcError } = await supabase.functions.invoke(
        'calculate-statistics-metrics',
        {
          body: {
            activity_id: activityId,
            user_id: user.id,
            source_activity: sourceActivity
          }
        }
      )

      if (funcError) {
        throw funcError
      }

      // Refresh metrics after calculation
      if (activityId) {
        const { data: updatedMetrics } = await supabase
          .from('statistics_metrics')
          .select('*')
          .eq('user_id', user.id)
          .eq('activity_id', activityId)
          .single()

        setMetrics(updatedMetrics)
      }

      return data
    } catch (err) {
      console.error('Error calculating statistics metrics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Format metrics for display
  const formatMetrics = (metrics: StatisticsMetrics) => {
    return {
      distance: metrics.total_distance_km 
        ? `${metrics.total_distance_km.toFixed(2)} km`
        : 'N/A',
      time: metrics.total_time_minutes
        ? `${Math.floor(metrics.total_time_minutes / 60)}h ${Math.floor(metrics.total_time_minutes % 60)}m`
        : 'N/A',
      pace: metrics.average_pace_min_km
        ? `${Math.floor(metrics.average_pace_min_km)}:${String(Math.floor((metrics.average_pace_min_km % 1) * 60)).padStart(2, '0')}/km`
        : 'N/A',
      avgHeartRate: metrics.average_heart_rate
        ? `${Math.round(metrics.average_heart_rate)} bpm`
        : 'N/A',
      maxHeartRate: metrics.max_heart_rate
        ? `${metrics.max_heart_rate} bpm`
        : 'N/A',
      heartRateStdDev: metrics.heart_rate_std_dev
        ? `${metrics.heart_rate_std_dev.toFixed(1)} bpm`
        : 'N/A',
      paceStdDev: metrics.pace_std_dev
        ? `${metrics.pace_std_dev.toFixed(2)} min/km`
        : 'N/A',
      heartRateCV: metrics.heart_rate_cv_percent
        ? `${metrics.heart_rate_cv_percent.toFixed(1)}%`
        : 'N/A',
      paceCV: metrics.pace_cv_percent
        ? `${metrics.pace_cv_percent.toFixed(1)}%`
        : 'N/A'
    }
  }

  return {
    metrics,
    allMetrics,
    loading,
    error,
    fetchAllMetrics,
    calculateMetrics,
    formatMetrics
  }
}