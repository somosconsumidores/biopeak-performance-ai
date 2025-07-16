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
      garmin_tokens: {
        Row: {
          access_token: string
          consumer_key: string | null
          created_at: string
          expires_at: string | null
          id: string
          oauth_verifier: string | null
          token_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          consumer_key?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          oauth_verifier?: string | null
          token_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          consumer_key?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          oauth_verifier?: string | null
          token_secret?: string | null
          updated_at?: string
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          oauth_token: string
          oauth_token_secret?: string | null
          provider?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          oauth_token?: string
          oauth_token_secret?: string | null
          provider?: string
          user_id?: string | null
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
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
