import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ErrorHandler } from "../_shared/error-handler.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Test error notification - starting');

    // Force an error to test the notification system
    await ErrorHandler.withErrorHandling(
      'test-error-notification',
      async () => {
        // Simulate different types of errors for testing
        const errorType = new URL(req.url).searchParams.get('type') || 'generic';
        
        console.log(`Testing error type: ${errorType}`);
        
        switch (errorType) {
          case 'database':
            throw new Error('Database connection failed - Test error');
          case 'auth':
            throw new Error('Auth failed - Unauthorized access test');
          case 'timeout':
            throw new Error('Request timeout - Network issue test');
          case 'validation':
            throw new Error('Validation error - Invalid input test');
          default:
            throw new Error('Generic test error - This is a test notification');
        }
      },
      {
        userId: 'test-user-id',
        requestData: {
          testType: new URL(req.url).searchParams.get('type') || 'generic',
          timestamp: new Date().toISOString()
        }
      }
    );

    // This won't be reached due to the error above
    return new Response(
      JSON.stringify({ message: 'Test completed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Test error caught:', error);
    
    return new Response(
      JSON.stringify({ 
        message: 'Test error thrown successfully',
        error: error.message,
        note: 'Check your N8N webhook for the notification'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
