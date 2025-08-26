import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveTrainingPlan } from './useActiveTrainingPlan';
import { useAuth } from './useAuth';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: 'training_plan' | 'general';
}

interface UseEnhancedAICoachChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
}

export const useEnhancedAICoachChat = (): UseEnhancedAICoachChatReturn => {
  const { user } = useAuth();
  const { plan, workouts } = useActiveTrainingPlan();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      console.log('🤖 Sending message to Enhanced AI Coach:', message);

      // Prepare conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Prepare training plan context if available
      const trainingPlanContext = plan ? {
        plan: {
          name: plan.plan_name,
          goal: plan.goal_type,
          weeks: plan.weeks,
          startDate: plan.start_date,
          endDate: plan.end_date,
          targetEventDate: plan.target_event_date
        },
        workouts: workouts.map(w => ({
          week: w.week_number,
          day: w.day_of_week,
          type: w.workout_type,
          name: w.workout_name,
          description: w.description,
          completed: w.is_completed,
          scheduledDate: w.scheduled_date
        })),
        progress: {
          totalWorkouts: workouts.length,
          completedWorkouts: workouts.filter(w => w.is_completed).length,
          completionRate: workouts.length > 0 ? (workouts.filter(w => w.is_completed).length / workouts.length) * 100 : 0
        }
      } : null;

      const { data, error: functionError } = await supabase.functions.invoke('ai-coach-chat', {
        body: {
          message: message.trim(),
          conversationHistory,
          trainingPlanContext,
          userId: user?.id
        }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Failed to get AI response');
      }

      if (!data || !data.response) {
        throw new Error('No response received from AI coach');
      }

      console.log('✅ Enhanced AI Coach response received');

      // Add AI response to chat
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        context: trainingPlanContext ? 'training_plan' : 'general'
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (err) {
      console.error('Enhanced AI Coach chat error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);

      // Add error message to chat
      const errorChatMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Desculpe, ocorreu um erro ao processar sua mensagem: ${errorMessage}. Tente novamente.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setLoading(false);
    }
  }, [messages, plan, workouts, user]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
  };
};