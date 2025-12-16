
-- Create function to get active subscribers count by utm_source
CREATE OR REPLACE FUNCTION get_subscribers_by_utm_source()
RETURNS TABLE (
  utm_source text,
  subscribers_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.utm_source, 'Direto') AS utm_source,
    COUNT(DISTINCT s.user_id) AS subscribers_count
  FROM subscribers s
  INNER JOIN profiles p ON p.user_id = s.user_id
  WHERE s.subscribed = TRUE
  GROUP BY p.utm_source
  ORDER BY subscribers_count DESC;
END;
$$;
