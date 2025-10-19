export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      achievement_definitions: {
        Row: {
          achievement_key: string
          category: string
          color: string
          created_at: string
          description: string
          difficulty: string
          icon: string
          id: string
          is_active: boolean
          points: number
          requirement_metadata: Json | null
          requirement_type: string
          requirement_value: number | null
          title: string
          updated_at: string
        }
        Insert: {
          achievement_key: string
          category?: string
          color?: string
          created_at?: string
          description: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          points?: number
          requirement_metadata?: Json | null
          requirement_type: string
          requirement_value?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          achievement_key?: string
          category?: string
          color?: string
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          points?: number
          requirement_metadata?: Json | null
          requirement_type?: string
          requirement_value?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      achievement_progress: {
        Row: {
          achievement_key: string
          created_at: string
          current_value: number
          id: string
          last_updated: string
          metadata: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          created_at?: string
          current_value?: number
          id?: string
          last_updated?: string
          metadata?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          created_at?: string
          current_value?: number
          id?: string
          last_updated?: string
          metadata?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_best_segments: {
        Row: {
          activity_date: string | null
          activity_id: string
          best_1km_pace_min_km: number | null
          created_at: string
          id: string
          segment_duration_seconds: number | null
          segment_end_distance_meters: number | null
          segment_start_distance_meters: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date?: string | null
          activity_id: string
          best_1km_pace_min_km?: number | null
          created_at?: string
          id?: string
          segment_duration_seconds?: number | null
          segment_end_distance_meters?: number | null
          segment_start_distance_meters?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string | null
          activity_id?: string
          best_1km_pace_min_km?: number | null
          created_at?: string
          id?: string
          segment_duration_seconds?: number | null
          segment_end_distance_meters?: number | null
          segment_start_distance_meters?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_chart_cache: {
        Row: {
          activity_id: string
          activity_source: string
          build_status: string
          built_at: string
          created_at: string
          error_message: string | null
          id: string
          series: Json
          stats: Json | null
          updated_at: string
          user_id: string
          version: number
          zones: Json | null
        }
        Insert: {
          activity_id: string
          activity_source: string
          build_status?: string
          built_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          series?: Json
          stats?: Json | null
          updated_at?: string
          user_id: string
          version?: number
          zones?: Json | null
        }
        Update: {
          activity_id?: string
          activity_source?: string
          build_status?: string
          built_at?: string
          created_at?: string
          error_message?: string | null
          id?: string
          series?: Json
          stats?: Json | null
          updated_at?: string
          user_id?: string
          version?: number
          zones?: Json | null
        }
        Relationships: []
      }
      activity_chart_data: {
        Row: {
          activity_id: string
          activity_source: string
          avg_heart_rate: number | null
          avg_pace_min_km: number | null
          avg_speed_ms: number | null
          created_at: string
          data_points_count: number
          duration_seconds: number | null
          id: string
          max_heart_rate: number | null
          processed_at: string
          series_data: Json
          total_distance_meters: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_source?: string
          avg_heart_rate?: number | null
          avg_pace_min_km?: number | null
          avg_speed_ms?: number | null
          created_at?: string
          data_points_count?: number
          duration_seconds?: number | null
          id?: string
          max_heart_rate?: number | null
          processed_at?: string
          series_data?: Json
          total_distance_meters?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_source?: string
          avg_heart_rate?: number | null
          avg_pace_min_km?: number | null
          avg_speed_ms?: number | null
          created_at?: string
          data_points_count?: number
          duration_seconds?: number | null
          id?: string
          max_heart_rate?: number | null
          processed_at?: string
          series_data?: Json
          total_distance_meters?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_coordinates: {
        Row: {
          activity_id: string
          activity_source: string
          bounding_box: Json | null
          coordinates: Json
          created_at: string
          id: string
          sampled_points: number
          starting_latitude: number | null
          starting_longitude: number | null
          total_points: number
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_source?: string
          bounding_box?: Json | null
          coordinates?: Json
          created_at?: string
          id?: string
          sampled_points?: number
          starting_latitude?: number | null
          starting_longitude?: number | null
          total_points?: number
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_source?: string
          bounding_box?: Json | null
          coordinates?: Json
          created_at?: string
          id?: string
          sampled_points?: number
          starting_latitude?: number | null
          starting_longitude?: number | null
          total_points?: number
          user_id?: string
        }
        Relationships: []
      }
      activity_heart_rate_zones: {
        Row: {
          activity_id: string
          activity_source: string
          created_at: string
          id: string
          max_heart_rate: number
          total_time_seconds: number
          user_id: string
          zone_1_percentage: number | null
          zone_1_time_seconds: number | null
          zone_2_percentage: number | null
          zone_2_time_seconds: number | null
          zone_3_percentage: number | null
          zone_3_time_seconds: number | null
          zone_4_percentage: number | null
          zone_4_time_seconds: number | null
          zone_5_percentage: number | null
          zone_5_time_seconds: number | null
        }
        Insert: {
          activity_id: string
          activity_source?: string
          created_at?: string
          id?: string
          max_heart_rate: number
          total_time_seconds: number
          user_id: string
          zone_1_percentage?: number | null
          zone_1_time_seconds?: number | null
          zone_2_percentage?: number | null
          zone_2_time_seconds?: number | null
          zone_3_percentage?: number | null
          zone_3_time_seconds?: number | null
          zone_4_percentage?: number | null
          zone_4_time_seconds?: number | null
          zone_5_percentage?: number | null
          zone_5_time_seconds?: number | null
        }
        Update: {
          activity_id?: string
          activity_source?: string
          created_at?: string
          id?: string
          max_heart_rate?: number
          total_time_seconds?: number
          user_id?: string
          zone_1_percentage?: number | null
          zone_1_time_seconds?: number | null
          zone_2_percentage?: number | null
          zone_2_time_seconds?: number | null
          zone_3_percentage?: number | null
          zone_3_time_seconds?: number | null
          zone_4_percentage?: number | null
          zone_4_time_seconds?: number | null
          zone_5_percentage?: number | null
          zone_5_time_seconds?: number | null
        }
        Relationships: []
      }
      activity_segments: {
        Row: {
          activity_id: string
          activity_source: string
          avg_heart_rate: number | null
          avg_pace_min_km: number | null
          avg_speed_ms: number | null
          created_at: string
          duration_seconds: number | null
          elevation_gain_meters: number | null
          end_distance_meters: number
          id: string
          segment_number: number
          start_distance_meters: number
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_source?: string
          avg_heart_rate?: number | null
          avg_pace_min_km?: number | null
          avg_speed_ms?: number | null
          created_at?: string
          duration_seconds?: number | null
          elevation_gain_meters?: number | null
          end_distance_meters: number
          id?: string
          segment_number: number
          start_distance_meters: number
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_source?: string
          avg_heart_rate?: number | null
          avg_pace_min_km?: number | null
          avg_speed_ms?: number | null
          created_at?: string
          duration_seconds?: number | null
          elevation_gain_meters?: number | null
          end_distance_meters?: number
          id?: string
          segment_number?: number
          start_distance_meters?: number
          user_id?: string
        }
        Relationships: []
      }
      activity_variation_analysis: {
        Row: {
          activity_id: string
          activity_source: string
          created_at: string
          data_points: number
          diagnosis: string | null
          has_valid_data: boolean
          heart_rate_cv: number | null
          heart_rate_cv_category: string | null
          id: string
          pace_cv: number | null
          pace_cv_category: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_source?: string
          created_at?: string
          data_points?: number
          diagnosis?: string | null
          has_valid_data?: boolean
          heart_rate_cv?: number | null
          heart_rate_cv_category?: string | null
          id?: string
          pace_cv?: number | null
          pace_cv_category?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_source?: string
          created_at?: string
          data_points?: number
          diagnosis?: string | null
          has_valid_data?: boolean
          heart_rate_cv?: number | null
          heart_rate_cv_category?: string | null
          id?: string
          pace_cv?: number | null
          pace_cv_category?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_stats: {
        Row: {
          affiliate_login: string
          conversion_rate: number
          created_at: string
          id: string
          last_calculated_at: string
          paid_athletes: number
          total_athletes: number
          total_commission: number
          updated_at: string
        }
        Insert: {
          affiliate_login: string
          conversion_rate?: number
          created_at?: string
          id?: string
          last_calculated_at?: string
          paid_athletes?: number
          total_athletes?: number
          total_commission?: number
          updated_at?: string
        }
        Update: {
          affiliate_login?: string
          conversion_rate?: number
          created_at?: string
          id?: string
          last_calculated_at?: string
          paid_athletes?: number
          total_athletes?: number
          total_commission?: number
          updated_at?: string
        }
        Relationships: []
      }
      affiliates_login: {
        Row: {
          created_at: string
          id: string
          login: string
          password: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          login: string
          password: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          login?: string
          password?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_analysis_purchases: {
        Row: {
          activity_id: string
          activity_source: string
          amount_cents: number
          created_at: string
          id: string
          purchased_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_source?: string
          amount_cents?: number
          created_at?: string
          id?: string
          purchased_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_source?: string
          amount_cents?: number
          created_at?: string
          id?: string
          purchased_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_prescriptions: {
        Row: {
          actual_performance: Json
          adjustments_made: Json
          created_at: string
          goal_feasibility_score: number | null
          id: string
          planned_strategy: Json
          recommended_heart_rate_zone: string | null
          recommended_pace_min_km: number | null
          session_id: string
          updated_at: string
        }
        Insert: {
          actual_performance?: Json
          adjustments_made?: Json
          created_at?: string
          goal_feasibility_score?: number | null
          id?: string
          planned_strategy?: Json
          recommended_heart_rate_zone?: string | null
          recommended_pace_min_km?: number | null
          session_id: string
          updated_at?: string
        }
        Update: {
          actual_performance?: Json
          adjustments_made?: Json
          created_at?: string
          goal_feasibility_score?: number | null
          id?: string
          planned_strategy?: Json
          recommended_heart_rate_zone?: string | null
          recommended_pace_min_km?: number | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prescriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      all_activities: {
        Row: {
          active_kilocalories: number | null
          activity_date: string | null
          activity_id: string
          activity_source: string
          activity_type: string | null
          average_heart_rate: number | null
          created_at: string
          detected_workout_type: string | null
          device_name: string | null
          id: string
          max_heart_rate: number | null
          pace_min_per_km: number | null
          total_distance_meters: number | null
          total_elevation_gain_in_meters: number | null
          total_elevation_loss_in_meters: number | null
          total_time_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_kilocalories?: number | null
          activity_date?: string | null
          activity_id: string
          activity_source: string
          activity_type?: string | null
          average_heart_rate?: number | null
          created_at?: string
          detected_workout_type?: string | null
          device_name?: string | null
          id?: string
          max_heart_rate?: number | null
          pace_min_per_km?: number | null
          total_distance_meters?: number | null
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          total_time_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_kilocalories?: number | null
          activity_date?: string | null
          activity_id?: string
          activity_source?: string
          activity_type?: string | null
          average_heart_rate?: number | null
          created_at?: string
          detected_workout_type?: string | null
          device_name?: string | null
          id?: string
          max_heart_rate?: number | null
          pace_min_per_km?: number | null
          total_distance_meters?: number | null
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          total_time_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      faturamento: {
        Row: {
          created_at: string
          data_pagamento: string
          descricao: string | null
          id: string
          metadata: Json | null
          moeda: string
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string
          stripe_customer_id: string
          stripe_payment_id: string
          tipo_pagamento: string
          updated_at: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          data_pagamento: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          moeda?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status: string
          stripe_customer_id: string
          stripe_payment_id: string
          tipo_pagamento: string
          updated_at?: string
          user_id: string
          valor_centavos: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          moeda?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_payment_id?: string
          tipo_pagamento?: string
          updated_at?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: []
      }
      fitness_scores_daily: {
        Row: {
          atl_7day: number
          calendar_date: string
          capacity_score: number
          consistency_score: number
          created_at: string
          ctl_42day: number
          daily_strain: number
          fitness_score: number
          id: string
          recovery_balance_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          atl_7day: number
          calendar_date: string
          capacity_score: number
          consistency_score: number
          created_at?: string
          ctl_42day: number
          daily_strain: number
          fitness_score: number
          id?: string
          recovery_balance_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          atl_7day?: number
          calendar_date?: string
          capacity_score?: number
          consistency_score?: number
          created_at?: string
          ctl_42day?: number
          daily_strain?: number
          fitness_score?: number
          id?: string
          recovery_balance_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_activities: {
        Row: {
          active_kilocalories: number | null
          activity_date: string | null
          activity_id: string
          activity_type: string | null
          average_bike_cadence_in_rounds_per_minute: number | null
          average_heart_rate_in_beats_per_minute: number | null
          average_pace_in_minutes_per_kilometer: number | null
          average_push_cadence_in_pushes_per_minute: number | null
          average_run_cadence_in_steps_per_minute: number | null
          average_speed_in_meters_per_second: number | null
          average_swim_cadence_in_strokes_per_minute: number | null
          created_at: string
          device_name: string | null
          distance_in_meters: number | null
          duration_in_seconds: number | null
          id: string
          is_parent: boolean | null
          is_web_upload: boolean | null
          manual: boolean | null
          max_bike_cadence_in_rounds_per_minute: number | null
          max_heart_rate_in_beats_per_minute: number | null
          max_pace_in_minutes_per_kilometer: number | null
          max_push_cadence_in_pushes_per_minute: number | null
          max_run_cadence_in_steps_per_minute: number | null
          max_speed_in_meters_per_second: number | null
          number_of_active_lengths: number | null
          parent_summary_id: string | null
          pushes: number | null
          start_time_in_seconds: number | null
          start_time_offset_in_seconds: number | null
          starting_latitude_in_degree: number | null
          starting_longitude_in_degree: number | null
          steps: number | null
          summary_id: string
          synced_at: string
          total_elevation_gain_in_meters: number | null
          total_elevation_loss_in_meters: number | null
          updated_at: string
          user_id: string
          vo2_max: number | null
        }
        Insert: {
          active_kilocalories?: number | null
          activity_date?: string | null
          activity_id: string
          activity_type?: string | null
          average_bike_cadence_in_rounds_per_minute?: number | null
          average_heart_rate_in_beats_per_minute?: number | null
          average_pace_in_minutes_per_kilometer?: number | null
          average_push_cadence_in_pushes_per_minute?: number | null
          average_run_cadence_in_steps_per_minute?: number | null
          average_speed_in_meters_per_second?: number | null
          average_swim_cadence_in_strokes_per_minute?: number | null
          created_at?: string
          device_name?: string | null
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          id?: string
          is_parent?: boolean | null
          is_web_upload?: boolean | null
          manual?: boolean | null
          max_bike_cadence_in_rounds_per_minute?: number | null
          max_heart_rate_in_beats_per_minute?: number | null
          max_pace_in_minutes_per_kilometer?: number | null
          max_push_cadence_in_pushes_per_minute?: number | null
          max_run_cadence_in_steps_per_minute?: number | null
          max_speed_in_meters_per_second?: number | null
          number_of_active_lengths?: number | null
          parent_summary_id?: string | null
          pushes?: number | null
          start_time_in_seconds?: number | null
          start_time_offset_in_seconds?: number | null
          starting_latitude_in_degree?: number | null
          starting_longitude_in_degree?: number | null
          steps?: number | null
          summary_id: string
          synced_at?: string
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          updated_at?: string
          user_id: string
          vo2_max?: number | null
        }
        Update: {
          active_kilocalories?: number | null
          activity_date?: string | null
          activity_id?: string
          activity_type?: string | null
          average_bike_cadence_in_rounds_per_minute?: number | null
          average_heart_rate_in_beats_per_minute?: number | null
          average_pace_in_minutes_per_kilometer?: number | null
          average_push_cadence_in_pushes_per_minute?: number | null
          average_run_cadence_in_steps_per_minute?: number | null
          average_speed_in_meters_per_second?: number | null
          average_swim_cadence_in_strokes_per_minute?: number | null
          created_at?: string
          device_name?: string | null
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          id?: string
          is_parent?: boolean | null
          is_web_upload?: boolean | null
          manual?: boolean | null
          max_bike_cadence_in_rounds_per_minute?: number | null
          max_heart_rate_in_beats_per_minute?: number | null
          max_pace_in_minutes_per_kilometer?: number | null
          max_push_cadence_in_pushes_per_minute?: number | null
          max_run_cadence_in_steps_per_minute?: number | null
          max_speed_in_meters_per_second?: number | null
          number_of_active_lengths?: number | null
          parent_summary_id?: string | null
          pushes?: number | null
          start_time_in_seconds?: number | null
          start_time_offset_in_seconds?: number | null
          starting_latitude_in_degree?: number | null
          starting_longitude_in_degree?: number | null
          steps?: number | null
          summary_id?: string
          synced_at?: string
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          updated_at?: string
          user_id?: string
          vo2_max?: number | null
        }
        Relationships: []
      }
      garmin_activity_details: {
        Row: {
          activity_id: string
          activity_name: string | null
          activity_summary: Json | null
          activity_type: string | null
          clock_duration_in_seconds: number | null
          created_at: string
          device_name: string | null
          duration_in_seconds: number | null
          elevation_in_meters: number | null
          heart_rate: number | null
          id: string
          latitude_in_degree: number | null
          longitude_in_degree: number | null
          moving_duration_in_seconds: number | null
          power_in_watts: number | null
          sample_timestamp: number | null
          samples: Json | null
          speed_meters_per_second: number | null
          start_time_in_seconds: number | null
          steps_per_minute: number | null
          summary_id: string
          timer_duration_in_seconds: number | null
          total_distance_in_meters: number | null
          updated_at: string
          upload_time_in_seconds: number | null
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_name?: string | null
          activity_summary?: Json | null
          activity_type?: string | null
          clock_duration_in_seconds?: number | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          moving_duration_in_seconds?: number | null
          power_in_watts?: number | null
          sample_timestamp?: number | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          start_time_in_seconds?: number | null
          steps_per_minute?: number | null
          summary_id: string
          timer_duration_in_seconds?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          upload_time_in_seconds?: number | null
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_name?: string | null
          activity_summary?: Json | null
          activity_type?: string | null
          clock_duration_in_seconds?: number | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          moving_duration_in_seconds?: number | null
          power_in_watts?: number | null
          sample_timestamp?: number | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          start_time_in_seconds?: number | null
          steps_per_minute?: number | null
          summary_id?: string
          timer_duration_in_seconds?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          upload_time_in_seconds?: number | null
          user_id?: string
        }
        Relationships: []
      }
      garmin_backfill_requests: {
        Row: {
          activities_received: number | null
          activity_details_received: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          garmin_user_id: string | null
          id: string
          request_type: string
          status: string
          time_range_end: number
          time_range_start: number
          triggered_at: string
          updated_at: string
          user_id: string
          webhook_notifications: Json | null
        }
        Insert: {
          activities_received?: number | null
          activity_details_received?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          garmin_user_id?: string | null
          id?: string
          request_type: string
          status?: string
          time_range_end: number
          time_range_start: number
          triggered_at?: string
          updated_at?: string
          user_id: string
          webhook_notifications?: Json | null
        }
        Update: {
          activities_received?: number | null
          activity_details_received?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          garmin_user_id?: string | null
          id?: string
          request_type?: string
          status?: string
          time_range_end?: number
          time_range_start?: number
          triggered_at?: string
          updated_at?: string
          user_id?: string
          webhook_notifications?: Json | null
        }
        Relationships: []
      }
      garmin_blocked_tokens: {
        Row: {
          blocked_at: string
          created_at: string
          id: string
          reason: string
          token_hash: string
          user_id: string | null
        }
        Insert: {
          blocked_at?: string
          created_at?: string
          id?: string
          reason: string
          token_hash: string
          user_id?: string | null
        }
        Update: {
          blocked_at?: string
          created_at?: string
          id?: string
          reason?: string
          token_hash?: string
          user_id?: string | null
        }
        Relationships: []
      }
      garmin_daily_summaries: {
        Row: {
          active_kilocalories: number | null
          active_time_in_seconds: number | null
          activity_stress_duration_in_seconds: number | null
          activity_type: string | null
          average_heart_rate_in_beats_per_minute: number | null
          average_stress_level: number | null
          bmr_kilocalories: number | null
          calendar_date: string
          created_at: string
          distance_in_meters: number | null
          duration_in_seconds: number | null
          floors_climbed: number | null
          floors_climbed_goal: number | null
          high_stress_duration_in_seconds: number | null
          id: string
          intensity_duration_goal_in_seconds: number | null
          low_stress_duration_in_seconds: number | null
          max_heart_rate_in_beats_per_minute: number | null
          max_stress_level: number | null
          medium_stress_duration_in_seconds: number | null
          min_heart_rate_in_beats_per_minute: number | null
          moderate_intensity_duration_in_seconds: number | null
          push_distance_in_meters: number | null
          pushes: number | null
          pushes_goal: number | null
          rest_stress_duration_in_seconds: number | null
          resting_heart_rate_in_beats_per_minute: number | null
          start_time_in_seconds: number | null
          start_time_offset_in_seconds: number | null
          steps: number | null
          steps_goal: number | null
          stress_duration_in_seconds: number | null
          stress_qualifier: string | null
          summary_id: string
          time_offset_heart_rate_samples: Json | null
          updated_at: string
          user_id: string
          vigorous_intensity_duration_in_seconds: number | null
        }
        Insert: {
          active_kilocalories?: number | null
          active_time_in_seconds?: number | null
          activity_stress_duration_in_seconds?: number | null
          activity_type?: string | null
          average_heart_rate_in_beats_per_minute?: number | null
          average_stress_level?: number | null
          bmr_kilocalories?: number | null
          calendar_date: string
          created_at?: string
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          floors_climbed?: number | null
          floors_climbed_goal?: number | null
          high_stress_duration_in_seconds?: number | null
          id?: string
          intensity_duration_goal_in_seconds?: number | null
          low_stress_duration_in_seconds?: number | null
          max_heart_rate_in_beats_per_minute?: number | null
          max_stress_level?: number | null
          medium_stress_duration_in_seconds?: number | null
          min_heart_rate_in_beats_per_minute?: number | null
          moderate_intensity_duration_in_seconds?: number | null
          push_distance_in_meters?: number | null
          pushes?: number | null
          pushes_goal?: number | null
          rest_stress_duration_in_seconds?: number | null
          resting_heart_rate_in_beats_per_minute?: number | null
          start_time_in_seconds?: number | null
          start_time_offset_in_seconds?: number | null
          steps?: number | null
          steps_goal?: number | null
          stress_duration_in_seconds?: number | null
          stress_qualifier?: string | null
          summary_id: string
          time_offset_heart_rate_samples?: Json | null
          updated_at?: string
          user_id: string
          vigorous_intensity_duration_in_seconds?: number | null
        }
        Update: {
          active_kilocalories?: number | null
          active_time_in_seconds?: number | null
          activity_stress_duration_in_seconds?: number | null
          activity_type?: string | null
          average_heart_rate_in_beats_per_minute?: number | null
          average_stress_level?: number | null
          bmr_kilocalories?: number | null
          calendar_date?: string
          created_at?: string
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          floors_climbed?: number | null
          floors_climbed_goal?: number | null
          high_stress_duration_in_seconds?: number | null
          id?: string
          intensity_duration_goal_in_seconds?: number | null
          low_stress_duration_in_seconds?: number | null
          max_heart_rate_in_beats_per_minute?: number | null
          max_stress_level?: number | null
          medium_stress_duration_in_seconds?: number | null
          min_heart_rate_in_beats_per_minute?: number | null
          moderate_intensity_duration_in_seconds?: number | null
          push_distance_in_meters?: number | null
          pushes?: number | null
          pushes_goal?: number | null
          rest_stress_duration_in_seconds?: number | null
          resting_heart_rate_in_beats_per_minute?: number | null
          start_time_in_seconds?: number | null
          start_time_offset_in_seconds?: number | null
          steps?: number | null
          steps_goal?: number | null
          stress_duration_in_seconds?: number | null
          stress_qualifier?: string | null
          summary_id?: string
          time_offset_heart_rate_samples?: Json | null
          updated_at?: string
          user_id?: string
          vigorous_intensity_duration_in_seconds?: number | null
        }
        Relationships: []
      }
      garmin_function_calls: {
        Row: {
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          ip_address: string | null
          referer: string | null
          request_type: string | null
          response_time_ms: number | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          ip_address?: string | null
          referer?: string | null
          request_type?: string | null
          response_time_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          ip_address?: string | null
          referer?: string | null
          request_type?: string | null
          response_time_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      garmin_health_reports: {
        Row: {
          created_at: string
          id: string
          report_data: Json
          status: string
          suspicious_users: number
          total_calls: number
          unique_users: number
        }
        Insert: {
          created_at?: string
          id?: string
          report_data: Json
          status: string
          suspicious_users?: number
          total_calls?: number
          unique_users?: number
        }
        Update: {
          created_at?: string
          id?: string
          report_data?: Json
          status?: string
          suspicious_users?: number
          total_calls?: number
          unique_users?: number
        }
        Relationships: []
      }
      garmin_orphaned_webhooks: {
        Row: {
          created_at: string
          error_message: string | null
          garmin_user_id: string
          id: string
          last_retry_at: string | null
          processed_at: string | null
          retry_count: number
          status: string
          user_id: string | null
          webhook_payload: Json
          webhook_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          garmin_user_id: string
          id?: string
          last_retry_at?: string | null
          processed_at?: string | null
          retry_count?: number
          status?: string
          user_id?: string | null
          webhook_payload: Json
          webhook_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          garmin_user_id?: string
          id?: string
          last_retry_at?: string | null
          processed_at?: string | null
          retry_count?: number
          status?: string
          user_id?: string | null
          webhook_payload?: Json
          webhook_type?: string
        }
        Relationships: []
      }
      garmin_rate_limits: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_attempt: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_sleep_summaries: {
        Row: {
          age_group: string | null
          avg_sleep_stress: number | null
          awake_duration_in_seconds: number | null
          awakening_count: number | null
          calendar_date: string
          created_at: string
          deep_sleep_duration_in_seconds: number | null
          id: string
          light_sleep_duration_in_seconds: number | null
          rem_sleep_duration_in_seconds: number | null
          sleep_end_time_in_seconds: number | null
          sleep_end_time_offset_in_seconds: number | null
          sleep_quality_type_name: string | null
          sleep_score: number | null
          sleep_score_feedback: string | null
          sleep_score_insight: string | null
          sleep_start_time_in_seconds: number | null
          sleep_start_time_offset_in_seconds: number | null
          sleep_time_in_seconds: number | null
          summary_id: string
          synced_at: string
          unmeasurable_sleep_in_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group?: string | null
          avg_sleep_stress?: number | null
          awake_duration_in_seconds?: number | null
          awakening_count?: number | null
          calendar_date: string
          created_at?: string
          deep_sleep_duration_in_seconds?: number | null
          id?: string
          light_sleep_duration_in_seconds?: number | null
          rem_sleep_duration_in_seconds?: number | null
          sleep_end_time_in_seconds?: number | null
          sleep_end_time_offset_in_seconds?: number | null
          sleep_quality_type_name?: string | null
          sleep_score?: number | null
          sleep_score_feedback?: string | null
          sleep_score_insight?: string | null
          sleep_start_time_in_seconds?: number | null
          sleep_start_time_offset_in_seconds?: number | null
          sleep_time_in_seconds?: number | null
          summary_id: string
          synced_at?: string
          unmeasurable_sleep_in_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_group?: string | null
          avg_sleep_stress?: number | null
          awake_duration_in_seconds?: number | null
          awakening_count?: number | null
          calendar_date?: string
          created_at?: string
          deep_sleep_duration_in_seconds?: number | null
          id?: string
          light_sleep_duration_in_seconds?: number | null
          rem_sleep_duration_in_seconds?: number | null
          sleep_end_time_in_seconds?: number | null
          sleep_end_time_offset_in_seconds?: number | null
          sleep_quality_type_name?: string | null
          sleep_score?: number | null
          sleep_score_feedback?: string | null
          sleep_score_insight?: string | null
          sleep_start_time_in_seconds?: number | null
          sleep_start_time_offset_in_seconds?: number | null
          sleep_time_in_seconds?: number | null
          summary_id?: string
          synced_at?: string
          unmeasurable_sleep_in_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_sync_control: {
        Row: {
          callback_url: string | null
          created_at: string | null
          id: string
          last_sync_at: string
          status: string | null
          sync_type: string
          triggered_by: string
          updated_at: string | null
          user_id: string
          webhook_payload: Json | null
        }
        Insert: {
          callback_url?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string
          status?: string | null
          sync_type: string
          triggered_by: string
          updated_at?: string | null
          user_id: string
          webhook_payload?: Json | null
        }
        Update: {
          callback_url?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string
          status?: string | null
          sync_type?: string
          triggered_by?: string
          updated_at?: string | null
          user_id?: string
          webhook_payload?: Json | null
        }
        Relationships: []
      }
      garmin_tokens: {
        Row: {
          access_token: string
          consumer_key: string | null
          created_at: string
          expires_at: string | null
          garmin_user_id: string | null
          id: string
          initial_sync_completed: boolean | null
          is_active: boolean | null
          oauth_verifier: string | null
          refresh_token: string | null
          refresh_token_expires_at: string | null
          token_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          consumer_key?: string | null
          created_at?: string
          expires_at?: string | null
          garmin_user_id?: string | null
          id?: string
          initial_sync_completed?: boolean | null
          is_active?: boolean | null
          oauth_verifier?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          token_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          consumer_key?: string | null
          created_at?: string
          expires_at?: string | null
          garmin_user_id?: string | null
          id?: string
          initial_sync_completed?: boolean | null
          is_active?: boolean | null
          oauth_verifier?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          token_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_user_mapping: {
        Row: {
          created_at: string
          garmin_user_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          garmin_user_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          garmin_user_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_user_permissions: {
        Row: {
          garmin_user_id: string
          granted_at: string
          id: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          garmin_user_id: string
          granted_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          garmin_user_id?: string
          granted_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      garmin_vo2max: {
        Row: {
          calendar_date: string
          created_at: string
          fitness_age: number | null
          garmin_user_id: string
          id: string
          vo2_max_cycling: number | null
          vo2_max_running: number | null
        }
        Insert: {
          calendar_date: string
          created_at?: string
          fitness_age?: number | null
          garmin_user_id: string
          id?: string
          vo2_max_cycling?: number | null
          vo2_max_running?: number | null
        }
        Update: {
          calendar_date?: string
          created_at?: string
          fitness_age?: number | null
          garmin_user_id?: string
          id?: string
          vo2_max_cycling?: number | null
          vo2_max_running?: number | null
        }
        Relationships: []
      }
      garmin_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          garmin_user_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string | null
          user_id: string | null
          webhook_type: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          garmin_user_id?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
          webhook_type: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          garmin_user_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
          webhook_type?: string
        }
        Relationships: []
      }
      healthkit_activities: {
        Row: {
          active_calories: number | null
          activity_date: string | null
          activity_type: string | null
          average_heart_rate: number | null
          created_at: string
          device_name: string | null
          distance_meters: number | null
          duration_seconds: number | null
          elevation_gain_meters: number | null
          elevation_loss_meters: number | null
          end_time: string | null
          healthkit_uuid: string
          id: string
          max_heart_rate: number | null
          pace_min_per_km: number | null
          raw_data: Json | null
          source_name: string | null
          start_time: string | null
          steps: number | null
          total_calories: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_calories?: number | null
          activity_date?: string | null
          activity_type?: string | null
          average_heart_rate?: number | null
          created_at?: string
          device_name?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_meters?: number | null
          elevation_loss_meters?: number | null
          end_time?: string | null
          healthkit_uuid: string
          id?: string
          max_heart_rate?: number | null
          pace_min_per_km?: number | null
          raw_data?: Json | null
          source_name?: string | null
          start_time?: string | null
          steps?: number | null
          total_calories?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_calories?: number | null
          activity_date?: string | null
          activity_type?: string | null
          average_heart_rate?: number | null
          created_at?: string
          device_name?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_meters?: number | null
          elevation_loss_meters?: number | null
          end_time?: string | null
          healthkit_uuid?: string
          id?: string
          max_heart_rate?: number | null
          pace_min_per_km?: number | null
          raw_data?: Json | null
          source_name?: string | null
          start_time?: string | null
          steps?: number | null
          total_calories?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      healthkit_sync_status: {
        Row: {
          activities_synced: number | null
          created_at: string
          error_message: string | null
          id: string
          last_sync_at: string | null
          permissions_granted: boolean | null
          sync_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activities_synced?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          permissions_granted?: boolean | null
          sync_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activities_synced?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          permissions_granted?: boolean | null
          sync_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      n8n_notification_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          name: string | null
          phone: string | null
          processed_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          processed_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          processed_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          redirect_uri: string
          state_value: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          provider: string
          redirect_uri: string
          state_value: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          redirect_uri?: string
          state_value?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_temp_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          oauth_token: string
          oauth_token_secret: string | null
          provider: string
          provider_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          oauth_token: string
          oauth_token_secret?: string | null
          provider?: string
          provider_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          oauth_token?: string
          oauth_token_secret?: string | null
          provider?: string
          provider_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          activity_id: string
          activity_source: string | null
          average_hr: number | null
          average_speed_kmh: number | null
          calculated_at: string
          created_at: string
          distance_per_minute: number | null
          efficiency_comment: string | null
          effort_beginning_bpm: number | null
          effort_distribution_comment: string | null
          effort_end_bpm: number | null
          effort_middle_bpm: number | null
          fatigue_index: number | null
          heart_rate_comment: string | null
          id: string
          max_hr: number | null
          movement_efficiency: number | null
          pace_comment: string | null
          pace_consistency: number | null
          pace_distribution_beginning: number | null
          pace_distribution_end: number | null
          pace_distribution_middle: number | null
          pace_variation_coefficient: number | null
          power_per_beat: number | null
          relative_intensity: number | null
          relative_reserve: number | null
          terrain_adaptation_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_source?: string | null
          average_hr?: number | null
          average_speed_kmh?: number | null
          calculated_at?: string
          created_at?: string
          distance_per_minute?: number | null
          efficiency_comment?: string | null
          effort_beginning_bpm?: number | null
          effort_distribution_comment?: string | null
          effort_end_bpm?: number | null
          effort_middle_bpm?: number | null
          fatigue_index?: number | null
          heart_rate_comment?: string | null
          id?: string
          max_hr?: number | null
          movement_efficiency?: number | null
          pace_comment?: string | null
          pace_consistency?: number | null
          pace_distribution_beginning?: number | null
          pace_distribution_end?: number | null
          pace_distribution_middle?: number | null
          pace_variation_coefficient?: number | null
          power_per_beat?: number | null
          relative_intensity?: number | null
          relative_reserve?: number | null
          terrain_adaptation_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_source?: string | null
          average_hr?: number | null
          average_speed_kmh?: number | null
          calculated_at?: string
          created_at?: string
          distance_per_minute?: number | null
          efficiency_comment?: string | null
          effort_beginning_bpm?: number | null
          effort_distribution_comment?: string | null
          effort_end_bpm?: number | null
          effort_middle_bpm?: number | null
          fatigue_index?: number | null
          heart_rate_comment?: string | null
          id?: string
          max_hr?: number | null
          movement_efficiency?: number | null
          pace_comment?: string | null
          pace_consistency?: number | null
          pace_distribution_beginning?: number | null
          pace_distribution_end?: number | null
          pace_distribution_middle?: number | null
          pace_variation_coefficient?: number | null
          power_per_beat?: number | null
          relative_intensity?: number | null
          relative_reserve?: number | null
          terrain_adaptation_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_snapshots: {
        Row: {
          calories_burned_so_far: number | null
          created_at: string
          current_heart_rate: number | null
          current_pace_min_km: number | null
          current_speed_ms: number | null
          deviation_from_target: Json
          elevation_meters: number | null
          id: string
          latitude: number | null
          longitude: number | null
          session_id: string
          snapshot_at_distance_meters: number
          snapshot_at_duration_seconds: number
        }
        Insert: {
          calories_burned_so_far?: number | null
          created_at?: string
          current_heart_rate?: number | null
          current_pace_min_km?: number | null
          current_speed_ms?: number | null
          deviation_from_target?: Json
          elevation_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          session_id: string
          snapshot_at_distance_meters: number
          snapshot_at_duration_seconds: number
        }
        Update: {
          calories_burned_so_far?: number | null
          created_at?: string
          current_heart_rate?: number | null
          current_pace_min_km?: number | null
          current_speed_ms?: number | null
          deviation_from_target?: Json
          elevation_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          session_id?: string
          snapshot_at_distance_meters?: number
          snapshot_at_duration_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      polar_activities: {
        Row: {
          activity_id: string
          activity_type: string | null
          average_heart_rate_bpm: number | null
          calories: number | null
          carbohydrate_percentage_of_calories: number | null
          club_id: number | null
          club_name: string | null
          created_at: string
          detailed_sport_info: string | null
          device: string | null
          device_id: string | null
          distance: number | null
          duration: string | null
          fat_percentage_of_calories: number | null
          has_route: boolean | null
          id: string
          maximum_heart_rate_bpm: number | null
          minimum_heart_rate_bpm: number | null
          polar_user: string | null
          polar_user_id: number | null
          protein_percentage_of_calories: number | null
          sport: string | null
          start_time: string | null
          start_time_utc_offset: number | null
          synced_at: string
          training_load: number | null
          transaction_id: number | null
          updated_at: string
          upload_time: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_type?: string | null
          average_heart_rate_bpm?: number | null
          calories?: number | null
          carbohydrate_percentage_of_calories?: number | null
          club_id?: number | null
          club_name?: string | null
          created_at?: string
          detailed_sport_info?: string | null
          device?: string | null
          device_id?: string | null
          distance?: number | null
          duration?: string | null
          fat_percentage_of_calories?: number | null
          has_route?: boolean | null
          id?: string
          maximum_heart_rate_bpm?: number | null
          minimum_heart_rate_bpm?: number | null
          polar_user?: string | null
          polar_user_id?: number | null
          protein_percentage_of_calories?: number | null
          sport?: string | null
          start_time?: string | null
          start_time_utc_offset?: number | null
          synced_at?: string
          training_load?: number | null
          transaction_id?: number | null
          updated_at?: string
          upload_time?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_type?: string | null
          average_heart_rate_bpm?: number | null
          calories?: number | null
          carbohydrate_percentage_of_calories?: number | null
          club_id?: number | null
          club_name?: string | null
          created_at?: string
          detailed_sport_info?: string | null
          device?: string | null
          device_id?: string | null
          distance?: number | null
          duration?: string | null
          fat_percentage_of_calories?: number | null
          has_route?: boolean | null
          id?: string
          maximum_heart_rate_bpm?: number | null
          minimum_heart_rate_bpm?: number | null
          polar_user?: string | null
          polar_user_id?: number | null
          protein_percentage_of_calories?: number | null
          sport?: string | null
          start_time?: string | null
          start_time_utc_offset?: number | null
          synced_at?: string
          training_load?: number | null
          transaction_id?: number | null
          updated_at?: string
          upload_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      polar_activity_details: {
        Row: {
          activity_id: string
          activity_name: string | null
          activity_summary: Json | null
          activity_type: string | null
          cadence: number | null
          created_at: string
          device_name: string | null
          duration_in_seconds: number | null
          elevation_in_meters: number | null
          heart_rate: number | null
          id: string
          latitude_in_degree: number | null
          longitude_in_degree: number | null
          polar_user_id: number | null
          power_in_watts: number | null
          sample_timestamp: number | null
          samples: Json | null
          speed_meters_per_second: number | null
          temperature_celsius: number | null
          total_distance_in_meters: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_name?: string | null
          activity_summary?: Json | null
          activity_type?: string | null
          cadence?: number | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          polar_user_id?: number | null
          power_in_watts?: number | null
          sample_timestamp?: number | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          temperature_celsius?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_name?: string | null
          activity_summary?: Json | null
          activity_type?: string | null
          cadence?: number | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          polar_user_id?: number | null
          power_in_watts?: number | null
          sample_timestamp?: number | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          temperature_celsius?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      polar_continuous_hr_events: {
        Row: {
          created_at: string
          event_date: string | null
          id: string
          payload: Json
          polar_user_id: number | null
          updated_at: string
          user_id: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          id?: string
          payload?: Json
          polar_user_id?: number | null
          updated_at?: string
          user_id: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string | null
          id?: string
          payload?: Json
          polar_user_id?: number | null
          updated_at?: string
          user_id?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      polar_continuous_hr_samples: {
        Row: {
          calendar_date: string
          created_at: string
          heart_rate: number
          id: string
          polar_user_id: number | null
          sample_time: string
          sample_timestamp: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_date: string
          created_at?: string
          heart_rate: number
          id?: string
          polar_user_id?: number | null
          sample_time: string
          sample_timestamp?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_date?: string
          created_at?: string
          heart_rate?: number
          id?: string
          polar_user_id?: number | null
          sample_time?: string
          sample_timestamp?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      polar_sleep: {
        Row: {
          continuity: number | null
          continuity_class: number | null
          created_at: string
          date: string
          deep_sleep: number | null
          device_id: string | null
          heart_rate_samples: Json | null
          hypnogram: Json | null
          id: string
          light_sleep: number | null
          long_interruption_duration: number | null
          polar_user_id: number | null
          rem_sleep: number | null
          short_interruption_duration: number | null
          sleep_charge: number | null
          sleep_cycles: number | null
          sleep_deficit: number | null
          sleep_efficiency: number | null
          sleep_end_time: string | null
          sleep_goal: number | null
          sleep_rating: number | null
          sleep_score: number | null
          sleep_start_time: string | null
          synced_at: string
          total_interruption_duration: number | null
          total_sleep: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          continuity?: number | null
          continuity_class?: number | null
          created_at?: string
          date: string
          deep_sleep?: number | null
          device_id?: string | null
          heart_rate_samples?: Json | null
          hypnogram?: Json | null
          id?: string
          light_sleep?: number | null
          long_interruption_duration?: number | null
          polar_user_id?: number | null
          rem_sleep?: number | null
          short_interruption_duration?: number | null
          sleep_charge?: number | null
          sleep_cycles?: number | null
          sleep_deficit?: number | null
          sleep_efficiency?: number | null
          sleep_end_time?: string | null
          sleep_goal?: number | null
          sleep_rating?: number | null
          sleep_score?: number | null
          sleep_start_time?: string | null
          synced_at?: string
          total_interruption_duration?: number | null
          total_sleep?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          continuity?: number | null
          continuity_class?: number | null
          created_at?: string
          date?: string
          deep_sleep?: number | null
          device_id?: string | null
          heart_rate_samples?: Json | null
          hypnogram?: Json | null
          id?: string
          light_sleep?: number | null
          long_interruption_duration?: number | null
          polar_user_id?: number | null
          rem_sleep?: number | null
          short_interruption_duration?: number | null
          sleep_charge?: number | null
          sleep_cycles?: number | null
          sleep_deficit?: number | null
          sleep_efficiency?: number | null
          sleep_end_time?: string | null
          sleep_goal?: number | null
          sleep_rating?: number | null
          sleep_score?: number | null
          sleep_start_time?: string | null
          synced_at?: string
          total_interruption_duration?: number | null
          total_sleep?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      polar_sleepwise_alertness: {
        Row: {
          calendar_date: string
          created_at: string
          id: string
          payload: Json
          polar_user_id: number | null
          predictions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_date: string
          created_at?: string
          id?: string
          payload?: Json
          polar_user_id?: number | null
          predictions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_date?: string
          created_at?: string
          id?: string
          payload?: Json
          polar_user_id?: number | null
          predictions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      polar_sleepwise_bedtime: {
        Row: {
          bedtime_end: string | null
          bedtime_start: string | null
          calendar_date: string
          confidence: number | null
          created_at: string
          id: string
          payload: Json
          polar_user_id: number | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bedtime_end?: string | null
          bedtime_start?: string | null
          calendar_date: string
          confidence?: number | null
          created_at?: string
          id?: string
          payload?: Json
          polar_user_id?: number | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bedtime_end?: string | null
          bedtime_start?: string | null
          calendar_date?: string
          confidence?: number | null
          created_at?: string
          id?: string
          payload?: Json
          polar_user_id?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      polar_sync_control: {
        Row: {
          created_at: string | null
          id: string
          last_sync_at: string
          status: string | null
          sync_type: string
          triggered_by: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_sync_at?: string
          status?: string | null
          sync_type: string
          triggered_by: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_at?: string
          status?: string | null
          sync_type?: string
          triggered_by?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      polar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          expires_in: number | null
          id: string
          is_active: boolean | null
          polar_user_id: string | null
          signature_secret_key: string | null
          token_type: string | null
          updated_at: string
          user_id: string
          x_user_id: number | null
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          expires_in?: number | null
          id?: string
          is_active?: boolean | null
          polar_user_id?: string | null
          signature_secret_key?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
          x_user_id?: number | null
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          expires_in?: number | null
          id?: string
          is_active?: boolean | null
          polar_user_id?: string | null
          signature_secret_key?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
          x_user_id?: number | null
        }
        Relationships: []
      }
      polar_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          polar_user_id: number | null
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string | null
          webhook_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload: Json
          polar_user_id?: number | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          webhook_type?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          polar_user_id?: number | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          webhook_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          display_name: string | null
          email: string | null
          gender: string | null
          height_cm: number | null
          id: string
          last_login_at: string | null
          onboarding_completed: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
          utm_source: string | null
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
          utm_source?: string | null
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          utm_source?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      race_progress_snapshots: {
        Row: {
          ai_analysis: string | null
          created_at: string
          estimated_time_minutes: number | null
          fitness_level: string | null
          gap_analysis: Json | null
          id: string
          improvement_suggestions: Json | null
          race_id: string
          readiness_score: number | null
          snapshot_date: string
          training_focus_areas: string[] | null
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string
          estimated_time_minutes?: number | null
          fitness_level?: string | null
          gap_analysis?: Json | null
          id?: string
          improvement_suggestions?: Json | null
          race_id: string
          readiness_score?: number | null
          snapshot_date?: string
          training_focus_areas?: string[] | null
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string
          estimated_time_minutes?: number | null
          fitness_level?: string | null
          gap_analysis?: Json | null
          id?: string
          improvement_suggestions?: Json | null
          race_id?: string
          readiness_score?: number | null
          snapshot_date?: string
          training_focus_areas?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_progress_snapshots_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "user_target_races"
            referencedColumns: ["id"]
          },
        ]
      }
      race_strategies: {
        Row: {
          avg_pace_seconds: number
          created_at: string
          distance_km: number
          id: string
          intensity_percentage: number
          km_distribution: Json
          objective_type: string
          strategy_name: string
          strategy_type: string
          target_pace_seconds: number | null
          target_time_seconds: number | null
          total_time_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_pace_seconds: number
          created_at?: string
          distance_km: number
          id?: string
          intensity_percentage?: number
          km_distribution?: Json
          objective_type: string
          strategy_name: string
          strategy_type: string
          target_pace_seconds?: number | null
          target_time_seconds?: number | null
          total_time_seconds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_pace_seconds?: number
          created_at?: string
          distance_km?: number
          id?: string
          intensity_percentage?: number
          km_distribution?: Json
          objective_type?: string
          strategy_name?: string
          strategy_type?: string
          target_pace_seconds?: number | null
          target_time_seconds?: number | null
          total_time_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      realtime_feedbacks: {
        Row: {
          audio_url: string | null
          created_at: string
          feedback_text: string
          feedback_type: string
          id: string
          performance_data: Json
          session_id: string
          triggered_at_distance_meters: number
          triggered_at_duration_seconds: number
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          feedback_text: string
          feedback_type: string
          id?: string
          performance_data?: Json
          session_id: string
          triggered_at_distance_meters: number
          triggered_at_duration_seconds: number
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          feedback_text?: string
          feedback_type?: string
          id?: string
          performance_data?: Json
          session_id?: string
          triggered_at_distance_meters?: number
          triggered_at_duration_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "realtime_feedbacks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          sent_at: string
          template_key: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          sent_at?: string
          template_key: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          sent_at?: string
          template_key?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sleep_feedback_analysis: {
        Row: {
          analysis_text: string
          created_at: string
          id: string
          overtraining_data: Json
          sleep_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_text: string
          created_at?: string
          id?: string
          overtraining_data: Json
          sleep_data: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_text?: string
          created_at?: string
          id?: string
          overtraining_data?: Json
          sleep_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      statistics_metrics: {
        Row: {
          activity_id: string
          average_heart_rate: number | null
          average_pace_min_km: number | null
          created_at: string
          heart_rate_cv_percent: number | null
          heart_rate_std_dev: number | null
          id: string
          max_heart_rate: number | null
          pace_cv_percent: number | null
          pace_std_dev: number | null
          source_activity: string
          total_distance_km: number | null
          total_time_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          average_heart_rate?: number | null
          average_pace_min_km?: number | null
          created_at?: string
          heart_rate_cv_percent?: number | null
          heart_rate_std_dev?: number | null
          id?: string
          max_heart_rate?: number | null
          pace_cv_percent?: number | null
          pace_std_dev?: number | null
          source_activity: string
          total_distance_km?: number | null
          total_time_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          average_heart_rate?: number | null
          average_pace_min_km?: number | null
          created_at?: string
          heart_rate_cv_percent?: number | null
          heart_rate_std_dev?: number | null
          id?: string
          max_heart_rate?: number | null
          pace_cv_percent?: number | null
          pace_std_dev?: number | null
          source_activity?: string
          total_distance_km?: number | null
          total_time_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_activities: {
        Row: {
          average_heartrate: number | null
          average_speed: number | null
          calories: number | null
          created_at: string
          distance: number | null
          elapsed_time: number | null
          id: string
          max_heartrate: number | null
          max_speed: number | null
          moving_time: number | null
          name: string
          start_date: string
          strava_activity_id: number
          total_elevation_gain: number | null
          type: string
          updated_at: string
          user_id: string
          vo2_max: number | null
        }
        Insert: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          id?: string
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name: string
          start_date: string
          strava_activity_id: number
          total_elevation_gain?: number | null
          type: string
          updated_at?: string
          user_id: string
          vo2_max?: number | null
        }
        Update: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          created_at?: string
          distance?: number | null
          elapsed_time?: number | null
          id?: string
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name?: string
          start_date?: string
          strava_activity_id?: number
          total_elevation_gain?: number | null
          type?: string
          updated_at?: string
          user_id?: string
          vo2_max?: number | null
        }
        Relationships: []
      }
      strava_activity_details: {
        Row: {
          cadence: number | null
          created_at: string
          distance: number | null
          grade_smooth: number | null
          heartrate: number | null
          id: string
          latitude: number | null
          longitude: number | null
          moving: boolean | null
          strava_activity_id: number
          temp: number | null
          time_index: number
          time_seconds: number | null
          updated_at: string
          user_id: string
          velocity_smooth: number | null
          watts: number | null
        }
        Insert: {
          cadence?: number | null
          created_at?: string
          distance?: number | null
          grade_smooth?: number | null
          heartrate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          moving?: boolean | null
          strava_activity_id: number
          temp?: number | null
          time_index: number
          time_seconds?: number | null
          updated_at?: string
          user_id: string
          velocity_smooth?: number | null
          watts?: number | null
        }
        Update: {
          cadence?: number | null
          created_at?: string
          distance?: number | null
          grade_smooth?: number | null
          heartrate?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          moving?: boolean | null
          strava_activity_id?: number
          temp?: number | null
          time_index?: number
          time_seconds?: number | null
          updated_at?: string
          user_id?: string
          velocity_smooth?: number | null
          watts?: number | null
        }
        Relationships: []
      }
      strava_activity_streams: {
        Row: {
          created_at: string
          id: string
          original_size: number | null
          resolution: string | null
          series_type: string | null
          strava_activity_id: number
          stream_data: Json | null
          stream_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_size?: number | null
          resolution?: string | null
          series_type?: string | null
          strava_activity_id: number
          stream_data?: Json | null
          stream_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_size?: number | null
          resolution?: string | null
          series_type?: string | null
          strava_activity_id?: number
          stream_data?: Json | null
          stream_type?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_gpx_activities: {
        Row: {
          activity_date: string | null
          activity_id: string
          activity_type: string | null
          average_heart_rate: number | null
          average_pace_in_minutes_per_kilometer: number | null
          average_speed_in_meters_per_second: number | null
          calories: number | null
          created_at: string
          distance_in_meters: number | null
          duration_in_seconds: number | null
          end_time: string | null
          file_path: string | null
          id: string
          max_heart_rate: number | null
          name: string | null
          source: string
          start_time: string | null
          synced_at: string
          total_elevation_gain_in_meters: number | null
          total_elevation_loss_in_meters: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date?: string | null
          activity_id?: string
          activity_type?: string | null
          average_heart_rate?: number | null
          average_pace_in_minutes_per_kilometer?: number | null
          average_speed_in_meters_per_second?: number | null
          calories?: number | null
          created_at?: string
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          end_time?: string | null
          file_path?: string | null
          id?: string
          max_heart_rate?: number | null
          name?: string | null
          source?: string
          start_time?: string | null
          synced_at?: string
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string | null
          activity_id?: string
          activity_type?: string | null
          average_heart_rate?: number | null
          average_pace_in_minutes_per_kilometer?: number | null
          average_speed_in_meters_per_second?: number | null
          calories?: number | null
          created_at?: string
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          end_time?: string | null
          file_path?: string | null
          id?: string
          max_heart_rate?: number | null
          name?: string | null
          source?: string
          start_time?: string | null
          synced_at?: string
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_gpx_activity_details: {
        Row: {
          activity_id: string
          activity_name: string | null
          activity_summary: Json | null
          created_at: string
          device_name: string | null
          duration_in_seconds: number | null
          elevation_in_meters: number | null
          heart_rate: number | null
          id: string
          latitude_in_degree: number | null
          longitude_in_degree: number | null
          sample_timestamp: string | null
          samples: Json | null
          speed_meters_per_second: number | null
          start_time: string | null
          total_distance_in_meters: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_name?: string | null
          activity_summary?: Json | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          sample_timestamp?: string | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          start_time?: string | null
          total_distance_in_meters?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_name?: string | null
          activity_summary?: Json | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          sample_timestamp?: string | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          start_time?: string | null
          total_distance_in_meters?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_sync_status: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_activity_date: string | null
          last_sync_at: string | null
          sync_status: string
          total_activities_synced: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_activity_date?: string | null
          last_sync_at?: string | null
          sync_status?: string
          total_activities_synced?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_activity_date?: string | null
          last_sync_at?: string | null
          sync_status?: string
          total_activities_synced?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_tokens: {
        Row: {
          access_token: string
          athlete_id: number | null
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_id?: number | null
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_id?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strava_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string | null
          webhook_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          webhook_type?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          webhook_type?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          revenuecat_user_id: string | null
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          subscription_type: string | null
          updated_at: string
          user_id: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          revenuecat_user_id?: string | null
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          subscription_type?: string | null
          updated_at?: string
          user_id?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          revenuecat_user_id?: string | null
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          subscription_type?: string | null
          updated_at?: string
          user_id?: string | null
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      survey_campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          is_active: boolean
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          is_required: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          campaign_id: string
          id: string
          question_id: string
          response_option: string | null
          response_text: string | null
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          id?: string
          question_id: string
          response_option?: string | null
          response_text?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          id?: string
          question_id?: string
          response_option?: string | null
          response_text?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_user_interactions: {
        Row: {
          action: string
          campaign_id: string
          id: string
          ip_address: string | null
          shown_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          campaign_id: string
          id?: string
          ip_address?: string | null
          shown_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          campaign_id?: string
          id?: string
          ip_address?: string | null
          shown_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_user_interactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "survey_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_preferences: {
        Row: {
          created_at: string
          days_of_week: number[]
          days_per_week: number
          id: string
          long_run_weekday: number | null
          plan_id: string
          start_asap: boolean
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          days_per_week: number
          id?: string
          long_run_weekday?: number | null
          plan_id: string
          start_asap?: boolean
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          days_per_week?: number
          id?: string
          long_run_weekday?: number | null
          plan_id?: string
          start_asap?: boolean
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_preferences_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_workouts: {
        Row: {
          completed_activity_id: string | null
          completed_activity_source: string | null
          created_at: string
          description: string | null
          distance_meters: number | null
          duration_minutes: number | null
          id: string
          plan_id: string
          status: string
          target_hr_zone: string | null
          target_pace_min_km: number | null
          title: string
          updated_at: string
          user_id: string
          workout_date: string
          workout_type: string | null
        }
        Insert: {
          completed_activity_id?: string | null
          completed_activity_source?: string | null
          created_at?: string
          description?: string | null
          distance_meters?: number | null
          duration_minutes?: number | null
          id?: string
          plan_id: string
          status?: string
          target_hr_zone?: string | null
          target_pace_min_km?: number | null
          title: string
          updated_at?: string
          user_id: string
          workout_date: string
          workout_type?: string | null
        }
        Update: {
          completed_activity_id?: string | null
          completed_activity_source?: string | null
          created_at?: string
          description?: string | null
          distance_meters?: number | null
          duration_minutes?: number | null
          id?: string
          plan_id?: string
          status?: string
          target_hr_zone?: string | null
          target_pace_min_km?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          workout_date?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string | null
          generated_at: string | null
          goal_target_time_minutes: number | null
          goal_type: string
          id: string
          plan_name: string | null
          plan_summary: Json | null
          start_date: string
          status: string
          target_event_date: string | null
          target_time_minutes_max: number | null
          target_time_minutes_min: number | null
          updated_at: string
          user_id: string
          weeks: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          generated_at?: string | null
          goal_target_time_minutes?: number | null
          goal_type: string
          id?: string
          plan_name?: string | null
          plan_summary?: Json | null
          start_date: string
          status?: string
          target_event_date?: string | null
          target_time_minutes_max?: number | null
          target_time_minutes_min?: number | null
          updated_at?: string
          user_id: string
          weeks: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          generated_at?: string | null
          goal_target_time_minutes?: number | null
          goal_type?: string
          id?: string
          plan_name?: string | null
          plan_summary?: Json | null
          start_date?: string
          status?: string
          target_event_date?: string | null
          target_time_minutes_max?: number | null
          target_time_minutes_min?: number | null
          updated_at?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          average_heart_rate: number | null
          average_pace_min_km: number | null
          calories_burned: number | null
          completed_at: string | null
          created_at: string
          goal_achieved: boolean | null
          goal_data: Json
          id: string
          session_type: string
          started_at: string
          status: string
          subjective_feedback: Json | null
          total_distance_meters: number | null
          total_duration_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_heart_rate?: number | null
          average_pace_min_km?: number | null
          calories_burned?: number | null
          completed_at?: string | null
          created_at?: string
          goal_achieved?: boolean | null
          goal_data?: Json
          id?: string
          session_type: string
          started_at?: string
          status?: string
          subjective_feedback?: Json | null
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_heart_rate?: number | null
          average_pace_min_km?: number | null
          calories_burned?: number | null
          completed_at?: string | null
          created_at?: string
          goal_achieved?: boolean | null
          goal_data?: Json
          id?: string
          session_type?: string
          started_at?: string
          status?: string
          subjective_feedback?: Json | null
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_access_logs: {
        Row: {
          access_type: string | null
          created_at: string
          id: string
          ip_address: unknown | null
          login_at: string
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          login_at?: string
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          login_at?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          created_at: string
          id: string
          is_seen: boolean
          progress_value: number | null
          seen_at: string | null
          unlocked_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          created_at?: string
          id?: string
          is_seen?: boolean
          progress_value?: number | null
          seen_at?: string | null
          unlocked_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          created_at?: string
          id?: string
          is_seen?: boolean
          progress_value?: number | null
          seen_at?: string | null
          unlocked_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_commitments: {
        Row: {
          applied_at: string
          category: string | null
          completed_at: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          priority: string
          target_metric: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          priority: string
          target_metric?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          priority?: string
          target_metric?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          athletic_level: string
          birth_date: string | null
          completed_at: string
          created_at: string
          goal: string
          goal_other: string | null
          id: string
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          athletic_level: string
          birth_date?: string | null
          completed_at?: string
          created_at?: string
          goal: string
          goal_other?: string | null
          id?: string
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          athletic_level?: string
          birth_date?: string | null
          completed_at?: string
          created_at?: string
          goal?: string
          goal_other?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_target_races: {
        Row: {
          created_at: string
          distance_meters: number
          id: string
          notes: string | null
          race_date: string
          race_location: string | null
          race_name: string
          race_url: string | null
          status: string
          target_time_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distance_meters: number
          id?: string
          notes?: string | null
          race_date: string
          race_location?: string | null
          race_name: string
          race_url?: string | null
          status?: string
          target_time_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          distance_meters?: number
          id?: string
          notes?: string | null
          race_date?: string
          race_location?: string | null
          race_name?: string
          race_url?: string | null
          status?: string
          target_time_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users_gas_model: {
        Row: {
          calendar_date: string
          created_at: string
          fatigue: number
          fitness: number
          id: string
          performance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_date: string
          created_at?: string
          fatigue: number
          fitness: number
          id?: string
          performance: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_date?: string
          created_at?: string
          fatigue?: number
          fitness?: number
          id?: string
          performance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      variation_analysis: {
        Row: {
          activity_id: string
          activity_source: string
          built_at: string
          created_at: string
          data_points: number
          diagnosis: string | null
          has_valid_data: boolean
          heart_rate_cv: number | null
          heart_rate_cv_category: string | null
          id: string
          pace_cv: number | null
          pace_cv_category: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_source: string
          built_at?: string
          created_at?: string
          data_points?: number
          diagnosis?: string | null
          has_valid_data?: boolean
          heart_rate_cv?: number | null
          heart_rate_cv_category?: string | null
          id?: string
          pace_cv?: number | null
          pace_cv_category?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_source?: string
          built_at?: string
          created_at?: string
          data_points?: number
          diagnosis?: string | null
          has_valid_data?: boolean
          heart_rate_cv?: number | null
          heart_rate_cv_category?: string | null
          id?: string
          pace_cv?: number | null
          pace_cv_category?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_classification: {
        Row: {
          activity_id: string
          created_at: string | null
          detected_workout_type: string
          id: string
          metrics: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          detected_workout_type: string
          id?: string
          metrics: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          detected_workout_type?: string
          id?: string
          metrics?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      zepp_activities: {
        Row: {
          activity_date: string | null
          activity_id: string
          activity_type: string | null
          average_heart_rate_bpm: number | null
          calories: number | null
          created_at: string
          device_name: string | null
          distance_in_meters: number | null
          duration_in_seconds: number | null
          has_route: boolean
          id: string
          max_heart_rate_bpm: number | null
          start_time: string | null
          updated_at: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          activity_date?: string | null
          activity_id: string
          activity_type?: string | null
          average_heart_rate_bpm?: number | null
          calories?: number | null
          created_at?: string
          device_name?: string | null
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          has_route?: boolean
          id?: string
          max_heart_rate_bpm?: number | null
          start_time?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          activity_date?: string | null
          activity_id?: string
          activity_type?: string | null
          average_heart_rate_bpm?: number | null
          calories?: number | null
          created_at?: string
          device_name?: string | null
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          has_route?: boolean
          id?: string
          max_heart_rate_bpm?: number | null
          start_time?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      zepp_activity_details: {
        Row: {
          activity_id: string
          activity_name: string | null
          activity_summary: Json | null
          activity_type: string | null
          created_at: string
          device_name: string | null
          duration_in_seconds: number | null
          elevation_in_meters: number | null
          heart_rate: number | null
          id: string
          latitude_in_degree: number | null
          longitude_in_degree: number | null
          sample_timestamp: number | null
          samples: Json | null
          speed_meters_per_second: number | null
          start_time_in_seconds: number | null
          total_distance_in_meters: number | null
          updated_at: string
          upload_time_in_seconds: number | null
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_name?: string | null
          activity_summary?: Json | null
          activity_type?: string | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          sample_timestamp?: number | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          start_time_in_seconds?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          upload_time_in_seconds?: number | null
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_name?: string | null
          activity_summary?: Json | null
          activity_type?: string | null
          created_at?: string
          device_name?: string | null
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          sample_timestamp?: number | null
          samples?: Json | null
          speed_meters_per_second?: number | null
          start_time_in_seconds?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          upload_time_in_seconds?: number | null
          user_id?: string
        }
        Relationships: []
      }
      zepp_gpx_activities: {
        Row: {
          activity_id: string
          activity_type: string | null
          average_heart_rate: number | null
          average_pace_min_km: number | null
          average_speed_ms: number | null
          calories: number | null
          created_at: string
          distance_in_meters: number | null
          duration_in_seconds: number | null
          elevation_gain_meters: number | null
          elevation_loss_meters: number | null
          id: string
          max_heart_rate: number | null
          max_speed_ms: number | null
          name: string | null
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_type?: string | null
          average_heart_rate?: number | null
          average_pace_min_km?: number | null
          average_speed_ms?: number | null
          calories?: number | null
          created_at?: string
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          elevation_gain_meters?: number | null
          elevation_loss_meters?: number | null
          id?: string
          max_heart_rate?: number | null
          max_speed_ms?: number | null
          name?: string | null
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_type?: string | null
          average_heart_rate?: number | null
          average_pace_min_km?: number | null
          average_speed_ms?: number | null
          calories?: number | null
          created_at?: string
          distance_in_meters?: number | null
          duration_in_seconds?: number | null
          elevation_gain_meters?: number | null
          elevation_loss_meters?: number | null
          id?: string
          max_heart_rate?: number | null
          max_speed_ms?: number | null
          name?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zepp_gpx_activity_details: {
        Row: {
          activity_id: string
          created_at: string
          duration_in_seconds: number | null
          elevation_in_meters: number | null
          heart_rate: number | null
          id: string
          latitude_in_degree: number | null
          longitude_in_degree: number | null
          sample_timestamp: number | null
          speed_meters_per_second: number | null
          total_distance_in_meters: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          sample_timestamp?: number | null
          speed_meters_per_second?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          duration_in_seconds?: number | null
          elevation_in_meters?: number | null
          heart_rate?: number | null
          id?: string
          latitude_in_degree?: number | null
          longitude_in_degree?: number | null
          sample_timestamp?: number | null
          speed_meters_per_second?: number | null
          total_distance_in_meters?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zepp_sleep_summaries: {
        Row: {
          awake_in_seconds: number | null
          calendar_date: string
          created_at: string
          deep_sleep_in_seconds: number | null
          id: string
          light_sleep_in_seconds: number | null
          rem_sleep_in_seconds: number | null
          sleep_score: number | null
          summary: Json | null
          total_sleep_in_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          awake_in_seconds?: number | null
          calendar_date: string
          created_at?: string
          deep_sleep_in_seconds?: number | null
          id?: string
          light_sleep_in_seconds?: number | null
          rem_sleep_in_seconds?: number | null
          sleep_score?: number | null
          summary?: Json | null
          total_sleep_in_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          awake_in_seconds?: number | null
          calendar_date?: string
          created_at?: string
          deep_sleep_in_seconds?: number | null
          id?: string
          light_sleep_in_seconds?: number | null
          rem_sleep_in_seconds?: number | null
          sleep_score?: number | null
          summary?: Json | null
          total_sleep_in_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zepp_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
          zepp_user_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
          zepp_user_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
          zepp_user_id?: string | null
        }
        Relationships: []
      }
      zepp_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string | null
          user_id: string | null
          zepp_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
          zepp_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string | null
          user_id?: string | null
          zepp_user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_all_activities_with_vo2_daniels: {
        Row: {
          active_kilocalories: number | null
          activity_date: string | null
          activity_id: string | null
          activity_source: string | null
          activity_type: string | null
          average_heart_rate: number | null
          created_at: string | null
          device_name: string | null
          id: string | null
          max_heart_rate: number | null
          pace_min_per_km: number | null
          total_distance_meters: number | null
          total_elevation_gain_in_meters: number | null
          total_elevation_loss_in_meters: number | null
          total_time_minutes: number | null
          updated_at: string | null
          user_id: string | null
          vo2_max_daniels: number | null
        }
        Insert: {
          active_kilocalories?: number | null
          activity_date?: string | null
          activity_id?: string | null
          activity_source?: string | null
          activity_type?: string | null
          average_heart_rate?: number | null
          created_at?: string | null
          device_name?: string | null
          id?: string | null
          max_heart_rate?: number | null
          pace_min_per_km?: number | null
          total_distance_meters?: number | null
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          total_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          vo2_max_daniels?: never
        }
        Update: {
          active_kilocalories?: number | null
          activity_date?: string | null
          activity_id?: string | null
          activity_source?: string | null
          activity_type?: string | null
          average_heart_rate?: number | null
          created_at?: string | null
          device_name?: string | null
          id?: string | null
          max_heart_rate?: number | null
          pace_min_per_km?: number | null
          total_distance_meters?: number | null
          total_elevation_gain_in_meters?: number | null
          total_elevation_loss_in_meters?: number | null
          total_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          vo2_max_daniels?: never
        }
        Relationships: []
      }
    }
    Functions: {
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      calculate_affiliate_stats: {
        Args: { affiliate_login_param: string }
        Returns: undefined
      }
      calculate_variation_analysis: {
        Args: {
          p_activity_id: string
          p_activity_source: string
          p_user_id: string
        }
        Returns: undefined
      }
      calculate_vo2_max: {
        Args: {
          activity_type_param: string
          avg_hr: number
          max_hr: number
          pace_min_km: number
        }
        Returns: number
      }
      calculate_vo2_max_daniels: {
        Args: { distance_meters: number; time_minutes: number }
        Returns: number
      }
      can_sync_user: {
        Args: {
          min_interval_minutes?: number
          sync_type_param: string
          user_id_param: string
        }
        Returns: boolean
      }
      check_refresh_token_expiration_warning: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      cleanup_expired_oauth_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_oauth_states: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_function_calls: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      deactivate_garmin_user: {
        Args: { garmin_user_id_param: string }
        Returns: undefined
      }
      find_fastest_1km_segment: {
        Args: {
          p_activity_id: string
          p_activity_source?: string
          p_user_id: string
        }
        Returns: Json
      }
      find_user_by_garmin_id: {
        Args: { garmin_user_id_param: string }
        Returns: string
      }
      find_user_by_polar_id: {
        Args: { polar_user_id_param: number }
        Returns: string
      }
      find_user_by_zepp_id: {
        Args: { zepp_user_id_param: string }
        Returns: string
      }
      force_renew_expired_tokens: {
        Args: Record<PropertyKey, never>
        Returns: {
          message: string
          status: string
          user_id: string
        }[]
      }
      get_admin_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_users: number
          users_with_activities: number
          users_with_valid_token: number
        }[]
      }
      get_app_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_activities: number
          total_athletes: number
          total_goals: number
          total_insights: number
        }[]
      }
      get_cron_job_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          jobname: string
          schedule: string
        }[]
      }
      get_polar_activities_without_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          activity_id: string
          activity_type: string
          polar_user_id: number
          start_time: string
          user_id: string
        }[]
      }
      get_provider_user_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          users_with_polar_activities: number
          users_with_polar_tokens: number
          users_with_strava_activities: number
          users_with_strava_tokens: number
        }[]
      }
      get_top_login_users: {
        Args: { limit_count?: number }
        Returns: {
          email: string
          login_days: number
          user_id: string
        }[]
      }
      get_unique_logins_by_date: {
        Args: Record<PropertyKey, never>
        Returns: {
          date: string
          users: number
        }[]
      }
      get_unique_strava_activities_with_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          strava_activity_id: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { data: Json; uri: string } | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      log_sync_attempt: {
        Args: {
          callback_url_param?: string
          sync_type_param: string
          triggered_by_param: string
          user_id_param: string
          webhook_payload_param?: Json
        }
        Returns: string
      }
      populate_garmin_user_mapping: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      populate_initial_affiliate_stats: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      recover_stuck_strava_syncs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reprocess_all_user_metrics_vo2max: {
        Args: Record<PropertyKey, never>
        Returns: {
          inserted_rows: number
          processed_logs: number
          updated_rows: number
        }[]
      }
      smart_cleanup_expired_oauth_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_all_users_dailies: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      update_sync_status: {
        Args: { status_param: string; sync_id_param: string }
        Returns: undefined
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
      weekly_summary_stats: {
        Args: { end_date: string; start_date: string }
        Returns: {
          active_days: number
          activities_count: number
          calories: number
          display_name: string
          email: string
          total_km: number
          user_id: string
        }[]
      }
      weekly_summary_stats_v2: {
        Args: {
          end_date: string
          previous_end_date: string
          previous_start_date: string
          start_date: string
        }
        Returns: {
          active_days: number
          activities_change: number
          activities_count: number
          activity_types: Json
          avg_heart_rate: number
          avg_km_per_activity: number
          avg_pace_min_km: number
          best_pace_min_km: number
          calories: number
          consistency_score: number
          display_name: string
          distance_change_percent: number
          email: string
          longest_distance_km: number
          longest_duration_hours: number
          max_heart_rate_week: number
          prev_activities_count: number
          prev_total_km: number
          total_elevation_gain: number
          total_hours: number
          total_km: number
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
