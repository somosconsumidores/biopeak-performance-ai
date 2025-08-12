import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UniqueLoginData {
  date: string;
  users: number;
}

export function useUniqueLoginsChart() {
  const [data, setData] = useState<UniqueLoginData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUniqueLogins = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.rpc('get_unique_logins_by_date');
        if (error) throw error;

        setData((data as UniqueLoginData[]) || []);
      } catch (err) {
        console.error('Error fetching unique logins data:', err);
        setError('Erro ao carregar logins únicos por dia');
      } finally {
        setLoading(false);
      }
    };

    fetchUniqueLogins();
  }, []);

  return { data, loading, error };
}
