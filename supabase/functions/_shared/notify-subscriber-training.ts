/**
 * Notifies n8n webhook when a subscriber registers a new training activity
 * This is called after successful upsert to all_activities table
 */
export async function notifySubscriberNewTraining(
  supabase: any,
  userId: string
): Promise<void> {
  try {
    // Check if user is an active subscriber
    const { data: subscriber, error: subError } = await supabase
      .from('subscribers')
      .select('subscribed, subscription_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) {
      console.error('[notify-subscriber-training] Error checking subscriber:', subError);
      return;
    }

    // Verify subscription is active and not expired
    const isActiveSubscriber = subscriber?.subscribed && 
      subscriber?.subscription_end && 
      new Date(subscriber.subscription_end) > new Date();

    if (!isActiveSubscriber) {
      console.log('[notify-subscriber-training] User is not an active subscriber, skipping notification');
      return;
    }

    // Send notification to n8n webhook
    const webhookUrl = 'https://biopeak-ai.app.n8n.cloud/webhook/subscriber-new-training';
    
    console.log(`[notify-subscriber-training] Notifying n8n for subscriber: ${userId}`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        timestamp: new Date().toISOString(),
        source: 'BioPeak Activity Sync',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[notify-subscriber-training] Webhook failed:', response.status, errorText);
      return;
    }

    console.log(`[notify-subscriber-training] Successfully notified n8n for user: ${userId}`);
  } catch (error) {
    // Fire-and-forget: log error but don't throw to avoid blocking main flow
    console.error('[notify-subscriber-training] Error:', error);
  }
}
