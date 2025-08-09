import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserRegistrationData {
  date: string;
  users: number;
}

export function useUserRegistrationChart() {
  const [data, setData] = useState<UserRegistrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRegistrationData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all profiles with their creation dates
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('created_at')
          .order('created_at', { ascending: true });

        if (profilesError) {
          throw profilesError;
        }

        if (!profiles || profiles.length === 0) {
          setData([]);
          return;
        }

        // Group by date and count registrations per day
        const registrationByDate = profiles.reduce((acc, profile) => {
          const date = new Date(profile.created_at).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Get the first and last dates
        const firstDate = new Date(profiles[0].created_at);
        const lastDate = new Date();

        // Fill in missing dates with 0 registrations
        const result: UserRegistrationData[] = [];
        const currentDate = new Date(firstDate);

        while (currentDate <= lastDate) {
          const dateString = currentDate.toISOString().split('T')[0];
          result.push({
            date: dateString,
            users: registrationByDate[dateString] || 0
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        setData(result);
      } catch (error) {
        console.error('Error fetching user registration data:', error);
        setError('Erro ao carregar dados de cadastro de usuários');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRegistrationData();
  }, []);

  return { data, loading, error };
}