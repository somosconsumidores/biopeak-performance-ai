import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UserAccessLog {
  id: string;
  user_id: string;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  created_at: string;
}

export const useUserAccessHistory = (limit: number = 10) => {
  const { user } = useAuth();
  const [accessHistory, setAccessHistory] = useState<UserAccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccessHistory = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('user_access_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('login_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      setAccessHistory((data as UserAccessLog[]) || []);
    } catch (err) {
      console.error('Error fetching access history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch access history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessHistory();
  }, [user]);

  return {
    accessHistory,
    loading,
    error,
    refetch: fetchAccessHistory,
  };
};