
-- ============================================================
-- garmin_function_calls
-- ============================================================
DROP POLICY IF EXISTS "System can manage function calls" ON public.garmin_function_calls;

CREATE POLICY "Service role can manage function calls"
  ON public.garmin_function_calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own function calls"
  ON public.garmin_function_calls
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- garmin_health_reports (sem user_id — apenas service_role)
-- ============================================================
DROP POLICY IF EXISTS "System can manage health reports" ON public.garmin_health_reports;

CREATE POLICY "Service role can manage health reports"
  ON public.garmin_health_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- garmin_rate_limits
-- ============================================================
DROP POLICY IF EXISTS "System can manage rate limits" ON public.garmin_rate_limits;

CREATE POLICY "Service role can manage rate limits"
  ON public.garmin_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- A policy "Users can view their own rate limits" já existe e está correta — não será alterada
