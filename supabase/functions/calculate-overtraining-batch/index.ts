import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BatchRequest {
  batch_size?: number;
  days_active_threshold?: number;
  days_to_analyze?: number;
}

interface BatchResult {
  log_id: string;
  started_at: string;
  completed_at?: string;
  status: string;
  total_users_processed: number;
  successful_calculations: number;
  failed_calculations: number;
  execution_time_seconds?: number;
  errors: Array<{ user_id: string; error: string }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let logId: string | null = null;
  
  try {
    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const body: BatchRequest = await req.json().catch(() => ({}));
    const batchSize = body.batch_size || 20;
    const daysActiveThreshold = body.days_active_threshold || 30;
    const daysToAnalyze = body.days_to_analyze || 30;

    console.log(`Starting batch processing: batch_size=${batchSize}, days_active_threshold=${daysActiveThreshold}`);

    // Create initial log entry
    const { data: logEntry, error: logError } = await supabase
      .from('overtraining_batch_logs')
      .insert({
        status: 'running',
        batch_size: batchSize,
        days_active_threshold: daysActiveThreshold,
        metadata: { days_to_analyze: daysToAnalyze }
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create log entry:', logError);
      throw new Error(`Failed to create log entry: ${logError.message}`);
    }

    logId = logEntry.id;
    console.log(`Created log entry: ${logId}`);

    // Fetch active users (users with activities in the last X days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysActiveThreshold);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`Fetching users with activities since ${cutoffDateStr}`);

    const { data: activeUsers, error: usersError } = await supabase
      .from('all_activities')
      .select('user_id')
      .gte('activity_date', cutoffDateStr)
      .order('user_id');

    if (usersError) {
      console.error('Failed to fetch active users:', usersError);
      throw new Error(`Failed to fetch active users: ${usersError.message}`);
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(activeUsers?.map(a => a.user_id) || [])];
    console.log(`Found ${uniqueUserIds.length} active users`);

    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ user_id: string; error: string }> = [];

    // Process users in batches
    for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
      const batch = uniqueUserIds.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueUserIds.length / batchSize)}: ${batch.length} users`);

      // Process each user in the batch
      const batchPromises = batch.map(async (userId) => {
        try {
          // Call the calculate-overtraining-risk function
          const { data, error } = await supabase.functions.invoke('calculate-overtraining-risk', {
            body: {
              user_id: userId,
              days_to_analyze: daysToAnalyze
            }
          });

          if (error) {
            console.error(`Failed for user ${userId}:`, error);
            errors.push({ user_id: userId, error: error.message || String(error) });
            return { success: false };
          }

          console.log(`✓ Success for user ${userId}`);
          return { success: true };
        } catch (error) {
          console.error(`Exception for user ${userId}:`, error);
          errors.push({ user_id: userId, error: String(error) });
          return { success: false };
        }
      });

      // Wait for all users in batch to complete
      const results = await Promise.all(batchPromises);
      
      successCount += results.filter(r => r.success).length;
      failCount += results.filter(r => !r.success).length;

      // Add delay between batches to avoid overwhelming the system
      if (i + batchSize < uniqueUserIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    const executionTimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Update log entry with results
    const { error: updateError } = await supabase
      .from('overtraining_batch_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_users_processed: uniqueUserIds.length,
        successful_calculations: successCount,
        failed_calculations: failCount,
        execution_time_seconds: executionTimeSeconds,
        metadata: { 
          days_to_analyze: daysToAnalyze,
          errors: errors.slice(0, 100) // Store up to 100 errors
        }
      })
      .eq('id', logId);

    if (updateError) {
      console.error('Failed to update log entry:', updateError);
    }

    const result: BatchResult = {
      log_id: logId,
      started_at: logEntry.started_at,
      completed_at: new Date().toISOString(),
      status: 'completed',
      total_users_processed: uniqueUserIds.length,
      successful_calculations: successCount,
      failed_calculations: failCount,
      execution_time_seconds: executionTimeSeconds,
      errors: errors
    };

    console.log(`Batch processing completed: ${successCount} successes, ${failCount} failures in ${executionTimeSeconds}s`);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Batch processing error:', error);
    
    // Update log entry to failed status if we have a log ID
    if (logId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const executionTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      
      await supabase
        .from('overtraining_batch_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          execution_time_seconds: executionTimeSeconds,
          error_message: error instanceof Error ? error.message : String(error)
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        log_id: logId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
