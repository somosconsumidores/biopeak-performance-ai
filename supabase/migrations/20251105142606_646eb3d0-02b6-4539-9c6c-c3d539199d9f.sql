-- Add source column to track who created the snapshot
ALTER TABLE performance_snapshots 
ADD COLUMN source text NOT NULL DEFAULT 'webview';

-- Add comment explaining the field
COMMENT ON COLUMN performance_snapshots.source IS 
'Origin of snapshot: "webview" (JavaScript foreground) or "native_gps" (iOS background tracking)';

-- Add index for performance when filtering by source
CREATE INDEX idx_performance_snapshots_source 
ON performance_snapshots(source);