import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getCache, setCache, clearCache, CACHE_KEYS, CACHE_DURATIONS } from '@/lib/cache';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  flag_training_plan: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ProfileData {
  display_name?: string;
  birth_date?: string;
  weight_kg?: number;
  height_cm?: number;
  avatar_url?: string;
}

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Initialize with cache for instant loading
  const cached = getCache<Profile>(
    CACHE_KEYS.PROFILE,
    user?.id,
    CACHE_DURATIONS.PROFILE
  );
  
  const [profile, setProfile] = useState<Profile | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // If we have cache, show it immediately and refresh in background
    if (cached) {
      setProfile(cached);
      setLoading(false);
      fetchProfile(false); // Background refresh
    } else {
      fetchProfile(true);
    }
  }, [user?.id]);

  const fetchProfile = async (showLoading = true) => {
    if (!user) return;
    
    try {
      if (showLoading) setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      setProfile(data);
      
      // Update cache
      if (data) {
        setCache(CACHE_KEYS.PROFILE, data, user.id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o perfil',
        variant: 'destructive'
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const updateProfile = async (data: ProfileData) => {
    if (!user || !profile) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      const updatedProfile = { ...profile, ...data };
      setProfile(updatedProfile);
      
      // Update cache immediately
      setCache(CACHE_KEYS.PROFILE, updatedProfile, user.id);
      
      toast({
        title: 'Sucesso',
        description: 'Perfil atualizado com sucesso'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o perfil',
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return null;

    try {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      const maxSize = 5 * 1024 * 1024;

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Erro',
          description: 'Tipo de arquivo não permitido. Use apenas JPG, PNG, WebP ou GIF.',
          variant: 'destructive'
        });
        return null;
      }

      if (file.size > maxSize) {
        toast({
          title: 'Erro',
          description: 'Arquivo muito grande. Máximo 5MB.',
          variant: 'destructive'
        });
        return null;
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await updateProfile({ avatar_url: publicUrl });
      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer upload da foto',
        variant: 'destructive'
      });
      return null;
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const flagTrainingPlanInterest = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          flag_training_plan: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      const updatedProfile = { ...profile, flag_training_plan: true };
      setProfile(updatedProfile);
      setCache(CACHE_KEYS.PROFILE, updatedProfile, user.id);
      
      toast({
        title: 'Confirmado!',
        description: 'Você será notificado quando a ferramenta estiver pronta'
      });
    } catch (error) {
      console.error('Error flagging training plan interest:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar seu interesse',
        variant: 'destructive'
      });
    }
  };

  const updateTrainingPlanAcceptance = async (accepted: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          training_plan_accepted: accepted,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      const updatedProfile = profile ? { ...profile, training_plan_accepted: accepted } : null;
      setProfile(updatedProfile);
      if (updatedProfile) {
        setCache(CACHE_KEYS.PROFILE, updatedProfile, user.id);
      }
    } catch (error) {
      console.error('Error updating training plan acceptance:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar sua decisão',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updatePhone = async (phone: string) => {
    if (!user) return false;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('profiles')
        .update({ 
          phone,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Clear cache and refetch
      clearCache(CACHE_KEYS.PROFILE);
      await fetchProfile(false);
      return true;
    } catch (error) {
      console.error('Error updating phone:', error);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return {
    profile,
    loading,
    updating,
    updateProfile,
    uploadAvatar,
    flagTrainingPlanInterest,
    updateTrainingPlanAcceptance,
    updatePhone,
    refetch: () => fetchProfile(true),
    age: calculateAge(profile?.birth_date || null)
  };
}
