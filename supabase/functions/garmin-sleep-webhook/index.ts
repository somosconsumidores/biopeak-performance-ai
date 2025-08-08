import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sleep notification structure from Garmin
interface SleepNotification {
  userId: string;
  userAccessToken: string;
  summaryId: string;
  calendarDate: string;
  callbackURL?: string;
}

interface SleepPayload {
  sleepSummaries?: SleepNotification[];
  sleeps?: SleepNotification[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  // Helper function to create success response
  const createSuccessResponse = (data: any) => {
    const processingTime = Date.now() - startTime;
    return new Response(JSON.stringify({
      status: 'success',
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      ...data
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  };

  try {
    console.log(`[garmin-sleep-webhook] ${req.method} ${req.url} - User-Agent: ${req.headers.get('user-agent')}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[garmin-sleep-webhook] Missing Supabase environment variables');
      return createSuccessResponse({ message: 'Configuration error - processed successfully' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Safely parse request body
    let payload: SleepPayload;
    try {
      const rawBody = await req.text();
      console.log(`[garmin-sleep-webhook] Raw request body: ${rawBody}`);

      if (!rawBody || rawBody.trim() === '') {
        console.log('[garmin-sleep-webhook] Empty body received - likely a PING request');
        return createSuccessResponse({ message: 'PING received successfully' });
      }

      payload = JSON.parse(rawBody);
      console.log(`[garmin-sleep-webhook] Parsed payload: ${JSON.stringify(payload, null, 2)}`);
    } catch (parseError) {
      console.error('[garmin-sleep-webhook] Failed to parse request body:', parseError);
      // Still return success to avoid breaking webhook health
      return createSuccessResponse({ message: 'Invalid JSON - processed successfully' });
    }

    // Extract sleep summaries from payload (Garmin sends 'sleeps' field)
    const sleepSummaries = payload.sleepSummaries || payload.sleeps || [];
    if (sleepSummaries.length === 0) {
      console.log('[garmin-sleep-webhook] No sleep summaries in payload');
      return createSuccessResponse({ message: 'No sleep summaries to process' });
    }

    console.log(`[garmin-sleep-webhook] Processing ${sleepSummaries.length} sleep summaries`);

    // Process sleep summaries in background
    const processActivitiesInBackground = async () => {
      const results = [];
      
      for (const sleepSummary of sleepSummaries) {
        try {
          const { userId: garminUserId, summaryId, calendarDate, callbackURL } = sleepSummary;
          console.log(`[garmin-sleep-webhook] Processing sleep summary for Garmin user: ${garminUserId}, summary: ${summaryId}`);

          // Look up active Garmin tokens for this user
          const { data: activeTokens, error: tokenError } = await supabase
            .from('garmin_tokens')
            .select('user_id, garmin_user_id, access_token')
            .eq('garmin_user_id', garminUserId)
            .eq('is_active', true);

          if (tokenError) {
            console.error(`[garmin-sleep-webhook] Error querying tokens:`, tokenError);
            continue;
          }

          if (!activeTokens || activeTokens.length === 0) {
            console.log(`[garmin-sleep-webhook] No active tokens found for Garmin user: ${garminUserId}, checking mapping table...`);
            
            // Try to find user mapping
            const { data: userMapping, error: mappingError } = await supabase
              .rpc('find_user_by_garmin_id', { garmin_user_id_param: garminUserId });

            if (mappingError || !userMapping) {
              console.error(`[garmin-sleep-webhook] No user mapping found for Garmin user ${garminUserId}`);
              
              // Store as orphaned webhook for later processing
              await supabase
                .from('garmin_orphaned_webhooks')
                .insert({
                  garmin_user_id: garminUserId,
                  webhook_type: 'sleep_notification',
                  webhook_payload: sleepSummary,
                  status: 'unassigned'
                });

              results.push({
                userId: garminUserId,
                summaryId,
                status: 'orphaned',
                message: 'No user mapping found - stored as orphaned webhook'
              });
              continue;
            }

            // Store as orphaned webhook with user mapping
            await supabase
              .from('garmin_orphaned_webhooks')
              .insert({
                garmin_user_id: garminUserId,
                user_id: userMapping,
                webhook_type: 'sleep_notification',
                webhook_payload: sleepSummary,
                status: 'pending'
              });

            results.push({
              userId: garminUserId,
              summaryId,
              status: 'orphaned',
              message: 'User found but no active tokens - stored as orphaned webhook'
            });
            continue;
          }

          const activeToken = activeTokens[0];
          const userId = activeToken.user_id;

          // Log the webhook
          const { data: webhookLog } = await supabase
            .from('garmin_webhook_logs')
            .insert({
              user_id: userId,
              garmin_user_id: garminUserId,
              webhook_type: 'sleep_notification',
              payload: sleepSummary,
              status: 'received'
            })
            .select()
            .single();

          try {
            // Trigger background sync using service role
            const syncResponse = await supabase.functions.invoke('sync-garmin-sleep', {
              body: {
                triggered_by_webhook: true,
                webhook_payload: sleepSummary,
                callback_url: callbackURL,
                user_id: userId,
                garmin_user_id: garminUserId,
                access_token: activeToken.access_token
              },
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'x-webhook-source': 'garmin'
              }
            });

            if (syncResponse.error) {
              // Check if this is a rate limiting error (429)
              const isRateLimited = syncResponse.error.context?.status === 429;
              
              if (isRateLimited) {
                console.log(`[garmin-sleep-webhook] Rate limited for user ${userId} - sleep sync will retry later`);
                
                // Update webhook log status to rate_limited instead of failed
                if (webhookLog) {
                  await supabase
                    .from('garmin_webhook_logs')
                    .update({
                      status: 'rate_limited',
                      error_message: 'Rate limited - will retry later'
                    })
                    .eq('id', webhookLog.id);
                }

                results.push({
                  userId: garminUserId,
                  summaryId,
                  status: 'rate_limited',
                  message: 'Rate limited - sync will retry later'
                });
              } else {
                console.error(`[garmin-sleep-webhook] Sync function error:`, syncResponse.error);
                
                // Update webhook log status to failed for real errors
                if (webhookLog) {
                  await supabase
                    .from('garmin_webhook_logs')
                    .update({
                      status: 'failed',
                      error_message: syncResponse.error.message
                    })
                    .eq('id', webhookLog.id);
                }

                results.push({
                  userId: garminUserId,
                  summaryId,
                  status: 'error',
                  message: `Sync failed: ${syncResponse.error.message}`
                });
              }
            } else {
              console.log(`[garmin-sleep-webhook] Successfully triggered sync for user ${userId}`);
              
              // Update webhook log status
              if (webhookLog) {
                await supabase
                  .from('garmin_webhook_logs')
                  .update({ status: 'success' })
                  .eq('id', webhookLog.id);
              }

              results.push({
                userId: garminUserId,
                summaryId,
                status: 'success',
                message: 'Sync triggered successfully'
              });
            }
          } catch (syncError) {
            console.error(`[garmin-sleep-webhook] Error invoking sync function:`, syncError);
            
            // Update webhook log status
            if (webhookLog) {
              await supabase
                .from('garmin_webhook_logs')
                .update({
                  status: 'failed',
                  error_message: syncError instanceof Error ? syncError.message : 'Unknown sync error'
                })
                .eq('id', webhookLog.id);
            }

            results.push({
              userId: garminUserId,
              summaryId,
              status: 'error',
              message: `Sync invocation failed: ${syncError instanceof Error ? syncError.message : 'Unknown error'}`
            });
          }
        } catch (summaryError) {
          console.error(`[garmin-sleep-webhook] Error processing sleep summary:`, summaryError);
          results.push({
            userId: sleepSummary.userId || 'unknown',
            summaryId: sleepSummary.summaryId || 'unknown',
            status: 'error',
            message: `Processing failed: ${summaryError instanceof Error ? summaryError.message : 'Unknown error'}`
          });
        }
      }

      console.log(`[garmin-sleep-webhook] Background processing completed: ${results.length} sleep summaries processed`);
      return results;
    };

    // Use EdgeRuntime.waitUntil to ensure background processing completes
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processActivitiesInBackground());
    } else {
      // Fallback for local development
      processActivitiesInBackground().catch(error => 
        console.error('[garmin-sleep-webhook] Background processing error:', error)
      );
    }

    // Return immediate success response to Garmin
    return createSuccessResponse({
      message: 'Sleep summaries received and processing started',
      summariesReceived: sleepSummaries.length
    });

  } catch (error) {
    console.error('[garmin-sleep-webhook] Fatal error:', error);
    
    // Always return success to Garmin to avoid webhook deregistration
    return createSuccessResponse({
      message: 'Request processed successfully despite internal error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});