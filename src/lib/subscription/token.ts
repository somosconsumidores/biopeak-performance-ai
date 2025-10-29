import { SupabaseClient } from '@supabase/supabase-js';

export async function getValidToken(supabase: SupabaseClient): Promise<string | null> {
  try {
    let { data: { session } } = await supabase.auth.getSession();
    
    // If no session or token expired, try to refresh
    if (!session?.access_token) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    }
    
    return session?.access_token ?? null;
  } catch (error) {
    console.error('Failed to get valid token:', error);
    return null;
  }
}
