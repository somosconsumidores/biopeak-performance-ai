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
  startNewConversation: () => void;
}

export const useEnhancedAICoachChat = (): UseEnhancedAICoachChatReturn => {
  const { user } = useAuth();
  const { plan, workouts } = useActiveTrainingPlan();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

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

      const { data, error: functionError } = await supabase.functions.invoke('ai-coach-chat', {
        body: {
          message: message.trim(),
          conversationHistory,
          userId: user?.id,
          conversationId: currentConversationId
        }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Failed to get AI response');
      }

      if (!data || !data.response) {
        throw new Error('No response received from AI coach');
      }

      // Update conversation ID if new
      if (!currentConversationId && data?.conversationId) {
        setCurrentConversationId(data.conversationId);
      }

      console.log('✅ Enhanced AI Coach response received');

      // Add AI response to chat
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
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
  }, [messages, user, currentConversationId]);

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
    startNewConversation,
  };
};