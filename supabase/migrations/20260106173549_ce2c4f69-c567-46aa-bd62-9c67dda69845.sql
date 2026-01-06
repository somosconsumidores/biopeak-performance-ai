-- Drop the existing policy that doesn't work with Edge Functions
DROP POLICY IF EXISTS "Service role can manage all activities" ON all_activities;

-- Create a new policy that works with Edge Functions using service role
CREATE POLICY "Service role full access" ON all_activities
FOR ALL
USING (
  auth.role() = 'service_role' 
  OR (auth.jwt() ->> 'role') = 'service_role'
)
WITH CHECK (
  auth.role() = 'service_role' 
  OR (auth.jwt() ->> 'role') = 'service_role'
);