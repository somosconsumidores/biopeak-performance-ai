import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ConversationSession {
  id: string;
  title: string | null;
  last_message_at: string | null;
  message_count: number | null;
  created_at: string | null;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string | null;
}

interface UseConversationHistoryReturn {
  sessions: ConversationSession[];
  loadingSessions: boolean;
  loadConversation: (conversationId: string) => Promise<ConversationMessage[]>;
  deleteConversation: (conversationId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export const useConversationHistory = (): UseConversationHistoryReturn => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const refreshSessions = useCallback(async () => {
    if (!user?.id) return;

    setLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from('ai_coach_conversation_sessions')
        .select('id, title, last_message_at, message_count, created_at')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching conversation sessions:', error);
        return;
      }

      setSessions(data || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [user?.id]);

  const loadConversation = useCallback(async (conversationId: string): Promise<ConversationMessage[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('ai_coach_conversations')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading conversation:', error);
        return [];
      }

      return (data || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at
      }));
    } catch (err) {
      console.error('Failed to load conversation:', err);
      return [];
    }
  }, [user?.id]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user?.id) return;

    try {
      // Delete messages first
      await supabase
        .from('ai_coach_conversations')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Delete session
      await supabase
        .from('ai_coach_conversation_sessions')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      // Refresh list
      await refreshSessions();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [user?.id, refreshSessions]);

  // Load sessions on mount
  useEffect(() => {
    if (user?.id) {
      refreshSessions();
    }
  }, [user?.id, refreshSessions]);

  return {
    sessions,
    loadingSessions,
    loadConversation,
    deleteConversation,
    refreshSessions,
  };
};
