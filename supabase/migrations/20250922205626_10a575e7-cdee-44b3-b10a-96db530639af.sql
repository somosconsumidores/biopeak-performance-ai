-- Call the function directly through supabase client instead of net.http_post
SELECT supabase_functions.invoke_edge_function(
  'calculate-activity-chart-data',
  jsonb_build_object(
    'user_id', 'f6e3b2a4-048d-47b9-83de-e7986b4a989a',
    'activity_id', 'A7A4C8D9-4FB9-4D79-A177-BDD8319884D0',
    'activity_source', 'healthkit',
    'full_precision', true
  )
);