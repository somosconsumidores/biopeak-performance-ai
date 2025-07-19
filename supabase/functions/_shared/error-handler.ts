import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.4';

interface ErrorContext {
  functionName: string;
  userId?: string;
  requestData?: any;
  userAgent?: string;
  ip?: string;
}

interface ErrorNotificationData {
  functionName: string;
  errorMessage: string;
  errorStack?: string;
  userId?: string;
  requestData?: any;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Rate limiting storage (in-memory for simplicity)
const errorCounts = new Map<string, { count: number, lastSent: number }>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_ERRORS_PER_WINDOW = 3;

export class ErrorHandler {
  private supabase: any;
  
  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  }

  private shouldSendNotification(functionName: string, errorMessage: string): boolean {
    const key = `${functionName}:${errorMessage.substring(0, 50)}`;
    const now = Date.now();
    const errorData = errorCounts.get(key) || { count: 0, lastSent: 0 };
    
    // Reset count if window has passed
    if (now - errorData.lastSent > RATE_LIMIT_WINDOW) {
      errorData.count = 0;
    }
    
    errorData.count++;
    errorCounts.set(key, errorData);
    
    // Send notification if under rate limit
    if (errorData.count <= MAX_ERRORS_PER_WINDOW) {
      errorData.lastSent = now;
      errorCounts.set(key, errorData);
      return true;
    }
    
    return false;
  }

  private determineSeverity(error: Error, functionName: string): 'low' | 'medium' | 'high' | 'critical' {
    const errorMessage = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Critical errors
    if (
      errorMessage.includes('database') && errorMessage.includes('connection') ||
      errorMessage.includes('auth') && errorMessage.includes('failed') ||
      functionName.includes('garmin-oauth') ||
      stack.includes('permission denied') ||
      errorMessage.includes('service unavailable')
    ) {
      return 'critical';
    }
    
    // High severity errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('unauthorized') ||
      stack.includes('typeerror')
    ) {
      return 'high';
    }
    
    // Medium severity errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('missing') ||
      errorMessage.includes('bad request')
    ) {
      return 'medium';
    }
    
    // Default to low severity
    return 'low';
  }

  async notifyError(error: Error, context: ErrorContext): Promise<void> {
    try {
      const severity = this.determineSeverity(error, context.functionName);
      
      // Check rate limiting
      if (!this.shouldSendNotification(context.functionName, error.message)) {
        console.log(`Rate limit reached for ${context.functionName}, skipping notification`);
        return;
      }

      const notificationData: ErrorNotificationData = {
        functionName: context.functionName,
        errorMessage: error.message,
        errorStack: error.stack,
        userId: context.userId,
        requestData: context.requestData,
        timestamp: new Date().toISOString(),
        severity
      };

      // Send notification via edge function
      const { error: notificationError } = await this.supabase.functions.invoke(
        'send-error-notification',
        { body: notificationData }
      );

      if (notificationError) {
        console.error('Failed to send error notification:', notificationError);
      } else {
        console.log(`Error notification sent for ${context.functionName} with severity ${severity}`);
      }
    } catch (notificationError) {
      console.error('Error in error notification system:', notificationError);
      // Don't throw here to avoid infinite recursion
    }
  }

  // Wrapper for handling errors in edge functions
  static async withErrorHandling<T>(
    functionName: string,
    handler: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    const errorHandler = new ErrorHandler();
    
    try {
      return await handler();
    } catch (error) {
      console.error(`Error in ${functionName}:`, error);
      
      // Send error notification
      await errorHandler.notifyError(error as Error, {
        functionName,
        ...context
      });
      
      // Re-throw the error so the function can still return appropriate response
      throw error;
    }
  }
}

// Helper function for easy usage
export const handleError = ErrorHandler.withErrorHandling;