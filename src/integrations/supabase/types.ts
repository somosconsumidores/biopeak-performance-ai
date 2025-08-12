export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
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
          height_cm: number | null
          id: string
          last_login_at: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          height_cm?: number | null
          id?: string
          last_login_at?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          height_cm?: number | null
          id?: string
          last_login_at?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_vo2_max: {
        Args: {
          activity_type_param: string
          pace_min_km: number
          avg_hr: number
          max_hr: number
        }
        Returns: number
      }
      can_sync_user: {
        Args: {
          user_id_param: string
          sync_type_param: string
          min_interval_minutes?: number
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
      find_user_by_garmin_id: {
        Args: { garmin_user_id_param: string }
        Returns: string
      }
      find_user_by_polar_id: {
        Args: { polar_user_id_param: number }
        Returns: string
      }
      force_renew_expired_tokens: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          status: string
          message: string
        }[]
      }
      get_app_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_athletes: number
          total_activities: number
          total_insights: number
          total_goals: number
        }[]
      }
      get_cron_job_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          jobname: string
          schedule: string
          active: boolean
        }[]
      }
      get_polar_activities_without_details: {
        Args: Record<PropertyKey, never>
        Returns: {
          activity_id: string
          user_id: string
          polar_user_id: number
          activity_type: string
          start_time: string
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      log_sync_attempt: {
        Args: {
          user_id_param: string
          sync_type_param: string
          triggered_by_param: string
          webhook_payload_param?: Json
          callback_url_param?: string
        }
        Returns: string
      }
      populate_garmin_user_mapping: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      recover_stuck_strava_syncs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      smart_cleanup_expired_oauth_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_all_users_dailies: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_sync_status: {
        Args: { sync_id_param: string; status_param: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
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
