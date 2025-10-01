-- Drop existing service role policy
DROP POLICY IF EXISTS "Service role can manage all ai analysis purchases" ON ai_analysis_purchases;

-- Create corrected policy with both USING and WITH CHECK expressions
CREATE POLICY "Service role can manage all ai analysis purchases"
ON ai_analysis_purchases
FOR ALL
TO authenticated
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);