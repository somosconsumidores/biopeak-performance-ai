
-- =====================================================
-- SECURITY FIX: Comprehensive Error-Level Issues Fix
-- =====================================================

-- ===========================================
-- 1. FIX: RLS Disabled on Marketing Tables
-- ===========================================

-- Enable RLS on marketing_events
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;

-- Enable RLS on marketing_campaign_config  
ALTER TABLE public.marketing_campaign_config ENABLE ROW LEVEL SECURITY;

-- Enable RLS on marketing_learning_notes
ALTER TABLE public.marketing_learning_notes ENABLE ROW LEVEL SECURITY;

-- Create service-role-only policies for marketing tables
CREATE POLICY "Service role only access" ON public.marketing_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role only access" ON public.marketing_campaign_config
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role only access" ON public.marketing_learning_notes
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ===========================================
-- 2. FIX: Affiliates Public Insert Abuse
-- ===========================================

-- Drop overly permissive INSERT policies
DROP POLICY IF EXISTS "Allow public insert for affiliates_login" ON public.affiliates_login;
DROP POLICY IF EXISTS "Anyone can signup as affiliate" ON public.affiliates_login;

-- Keep only service role access for affiliates (registration should go through edge function)
-- Already has: "Service role can manage all affiliate logins"

-- ===========================================
-- 3. FIX: Garmin Blocked Tokens Public Exposure
-- ===========================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can manage blocked tokens" ON public.garmin_blocked_tokens;

-- Create service-role-only policy
CREATE POLICY "Service role only access" ON public.garmin_blocked_tokens
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ===========================================
-- 4. FIX: WhatsApp Buffer Unrestricted Access
-- ===========================================

-- Drop overly permissive policy (USING true WITH CHECK true)
DROP POLICY IF EXISTS "Service role only access" ON public.whatsapp_buffer;

-- Create proper service-role-only policy
CREATE POLICY "Service role only" ON public.whatsapp_buffer
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ===========================================
-- 5. FIX: All Activities N8N Public Exposure
-- ===========================================

-- Drop the n8n policy that uses USING (true)
DROP POLICY IF EXISTS "n8n_mailer_read_activities" ON public.all_activities;

-- N8N should use service role key instead, which already has access via existing policy

-- ===========================================
-- 6. FIX: Security Definer Views → Security Invoker
-- ===========================================

-- Recreate view: creative_performance_last_7d with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_decisions_latest CASCADE;
DROP VIEW IF EXISTS public.winners_losers_by_rule CASCADE;
DROP VIEW IF EXISTS public.creative_performance_last_7d CASCADE;

CREATE VIEW public.creative_performance_last_7d
WITH (security_invoker = on) AS
SELECT 
  c.id AS creative_id,
  c.angle,
  c.status,
  c.meta_adset_id,
  c.meta_ad_id,
  COALESCE(sum(s.spend), 0::numeric) AS spend_7d,
  COALESCE(sum(s.impressions), 0::numeric) AS impressions_7d,
  COALESCE(sum(s.clicks), 0::numeric) AS clicks_7d,
  COALESCE(sum(s.leads), 0::bigint) AS leads_7d,
  COALESCE(sum(s.purchases), 0::numeric) AS purchases_7d,
  COALESCE(sum(s.revenue), 0::numeric) AS revenue_7d,
  CASE WHEN sum(s.impressions) > 0::numeric THEN sum(s.clicks) / sum(s.impressions) ELSE 0::numeric END AS ctr_7d,
  CASE WHEN sum(s.clicks) > 0::numeric THEN sum(s.spend) / sum(s.clicks) ELSE 0::numeric END AS cpc_7d,
  CASE WHEN sum(s.leads) > 0 THEN sum(s.spend) / sum(s.leads)::numeric ELSE 0::numeric END AS cpl_7d
FROM marketing_creatives c
LEFT JOIN marketing_stats_daily s ON s.meta_ad_id = c.meta_ad_id AND s.date >= (CURRENT_DATE - '7 days'::interval)
GROUP BY c.id, c.angle, c.status, c.meta_adset_id, c.meta_ad_id;

-- Recreate view: winners_losers_by_rule with SECURITY INVOKER
CREATE VIEW public.winners_losers_by_rule
WITH (security_invoker = on) AS
SELECT 
  creative_id,
  angle,
  status,
  meta_adset_id,
  meta_ad_id,
  spend_7d,
  impressions_7d,
  clicks_7d,
  leads_7d,
  purchases_7d,
  revenue_7d,
  ctr_7d,
  cpc_7d,
  cpl_7d,
  CASE
    WHEN leads_7d >= 2 AND cpl_7d <= 3.00 THEN 'winner'::text
    WHEN spend_7d >= 12.00 AND leads_7d = 0 THEN 'loser'::text
    WHEN leads_7d > 0 AND cpl_7d > 8.00 THEN 'loser'::text
    ELSE 'inconclusive'::text
  END AS classification
FROM creative_performance_last_7d;

-- Recreate view: v_decisions_latest with SECURITY INVOKER
CREATE VIEW public.v_decisions_latest
WITH (security_invoker = on) AS
SELECT 
  creative_id,
  angle,
  status,
  meta_adset_id,
  meta_ad_id,
  spend_7d,
  impressions_7d,
  clicks_7d,
  leads_7d,
  purchases_7d,
  revenue_7d,
  ctr_7d,
  cpc_7d,
  cpl_7d,
  classification
FROM winners_losers_by_rule;

-- Recreate view: v_all_activities_with_vo2_daniels with SECURITY INVOKER
DROP VIEW IF EXISTS public.v_all_activities_with_vo2_daniels;

CREATE VIEW public.v_all_activities_with_vo2_daniels
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  activity_id,
  activity_type,
  activity_date,
  total_distance_meters,
  total_time_minutes,
  device_name,
  active_kilocalories,
  average_heart_rate,
  max_heart_rate,
  pace_min_per_km,
  total_elevation_gain_in_meters,
  total_elevation_loss_in_meters,
  activity_source,
  created_at,
  updated_at,
  CASE
    WHEN activity_type ILIKE '%run%' AND total_distance_meters IS NOT NULL AND total_time_minutes IS NOT NULL AND total_distance_meters >= 800 AND total_time_minutes > 0 THEN calculate_vo2_max_daniels(total_distance_meters, total_time_minutes)
    ELSE NULL::numeric
  END AS vo2_max_daniels
FROM all_activities
WHERE activity_type ILIKE '%run%' AND total_distance_meters IS NOT NULL AND total_time_minutes IS NOT NULL AND total_distance_meters >= 800 AND total_time_minutes > 0
ORDER BY activity_date DESC;

-- Recreate view: view_biopeak_efficiency_analysis with SECURITY INVOKER
DROP VIEW IF EXISTS public.view_biopeak_efficiency_analysis;

CREATE VIEW public.view_biopeak_efficiency_analysis
WITH (security_invoker = on) AS
WITH weekly_metrics AS (
  SELECT 
    act.user_id,
    date_trunc('week', act.activity_date::timestamp with time zone) AS week_start,
    avg(
      CASE
        WHEN act.total_time_minutes > 0 AND act.average_heart_rate > 0 THEN act.total_distance_meters / act.total_time_minutes / act.average_heart_rate::double precision
        ELSE NULL::double precision
      END
    ) AS efficiency_factor
  FROM all_activities act
  JOIN subscribers sub ON act.user_id = sub.user_id
  WHERE act.activity_type = 'Run' AND act.activity_date >= (CURRENT_DATE - '14 days'::interval) AND sub.subscribed = true
  GROUP BY act.user_id, date_trunc('week', act.activity_date::timestamp with time zone)
)
SELECT 
  curr.user_id,
  curr.week_start,
  curr.efficiency_factor AS current_ef,
  prev.efficiency_factor AS previous_ef,
  CASE
    WHEN prev.efficiency_factor > 0 THEN round((curr.efficiency_factor::numeric - prev.efficiency_factor::numeric) / prev.efficiency_factor::numeric * 100, 2)
    ELSE 0::numeric
  END AS variation_percent
FROM weekly_metrics curr
JOIN weekly_metrics prev ON curr.user_id = prev.user_id AND prev.week_start = (curr.week_start - '7 days'::interval);
