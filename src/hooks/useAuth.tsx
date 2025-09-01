import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useGarminTokenManager } from './useGarminTokenManager';
import { useAccessTracker } from './useAccessTracker';
import { getProductionRedirectUrl } from '@/lib/utils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- UTM helpers (first-touch capture and one-time profile update) ---
const UTM_LOCAL_STORAGE_KEY = 'utm_source_first_touch';

function extractUTMSourceFromURL(href: string): string | null {
  try {
    const url = new URL(href);
    const params = new URLSearchParams(url.search);
    const value = params.get('utm_source');
    if (value) return value;
  } catch {
    // Ignore URL parsing errors
  }
  // Fallback: parse even if someone shared a malformed URL without '?'
  const match = href.match(/(?:[?&]|^)utm_source=([^&#]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

function captureAndPersistUTMSource(): string | null {
  if (typeof window === 'undefined') return null;

  // Keep first-touch only
  const existing = localStorage.getItem(UTM_LOCAL_STORAGE_KEY);
  if (existing) return existing;

  const utm = extractUTMSourceFromURL(window.location.href);
  if (utm) {
    localStorage.setItem(UTM_LOCAL_STORAGE_KEY, utm);

    // Try to clean the URL (remove utm_source) without reloading
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('utm_source');
      window.history.replaceState({}, document.title, url.toString());
    } catch {
      // no-op if URL API fails
    }
  }
  return utm;
}

async function updateProfileUtmSourceIfEmpty(utmSource: string | null, userId: string) {
  if (!utmSource) return;
  console.log('[Auth] Attempting to set profiles.utm_source (first-touch) if empty...', { utmSource, userId });

  const { data, error } = await supabase
    .from('profiles')
    .select('utm_source')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Auth] Error fetching profile for UTM update:', error);
    return;
  }

  // Only set if empty/null to preserve first-touch attribution
  if (!data || data.utm_source == null || data.utm_source === '') {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ utm_source: utmSource })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Auth] Error updating profiles.utm_source:', updateError);
      return;
    }

    console.log('[Auth] profiles.utm_source set successfully');
    // Clear local storage after successfully persisting first-touch source
    if (typeof window !== 'undefined') {
      localStorage.removeItem(UTM_LOCAL_STORAGE_KEY);
    }
  } else {
    console.log('[Auth] profiles.utm_source already set, skipping update');
    // Clear local storage to avoid future attempts
    if (typeof window !== 'undefined') {
      localStorage.removeItem(UTM_LOCAL_STORAGE_KEY);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { trackLogin } = useAccessTracker();

  useGarminTokenManager(user);

  useEffect(() => {
    // Capture UTM on first mount (first-touch)
    captureAndPersistUTMSource();

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        // Handle invalid refresh token - clear session and redirect
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.log('Token refresh failed, clearing session');
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Track login for explicit sign-in events
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => trackLogin(), 100);

          // Persist UTM to profile on first sign-in when we have a session
          const utm = (typeof window !== 'undefined') ? localStorage.getItem(UTM_LOCAL_STORAGE_KEY) : null;
          if (utm) {
            updateProfileUtmSourceIfEmpty(utm, session.user.id);
          }
        }
      }
    );

    // THEN check for existing session with error handling
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Session error:', error);
          // Clear any invalid session data
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);

          // If user already has a session (resume), try to persist UTM once
          if (session?.user) {
            const utm = (typeof window !== 'undefined') ? localStorage.getItem(UTM_LOCAL_STORAGE_KEY) : null;
            if (utm) {
              updateProfileUtmSourceIfEmpty(utm, session.user.id);
            }
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to get session:', error);
        // Clear session on any error
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);


  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = getProductionRedirectUrl("/");
    const utmFromStorage = (typeof window !== 'undefined') ? localStorage.getItem(UTM_LOCAL_STORAGE_KEY) : null;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
          // Store UTM in user metadata as well (useful for audits and potential future trigger usage)
          utm_source: utmFromStorage || undefined,
        },
      },
    });

    // If the project allows immediate session on sign-up, try persisting to profiles right away
    if (!error) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && utmFromStorage) {
        updateProfileUtmSourceIfEmpty(utmFromStorage, session.user.id);
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    
    return { error };
  };

  const signOut = async () => {
    console.log('[Auth] Attempting logout...');
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[Auth] Logout error from Supabase:', error);
        
        // If session doesn't exist on server, clear local state anyway
        if (error.message?.includes('Session not found') || 
            error.message?.includes('session_not_found') ||
            error.message?.includes("doesn't exist")) {
          console.log('[Auth] Session not found on server, clearing local state');
          
          // Clear local state manually since server session is already gone
          setSession(null);
          setUser(null);
          
          // Clear any stored auth data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('supabase.auth.token');
            localStorage.removeItem(UTM_LOCAL_STORAGE_KEY);
          }
          
          console.log('[Auth] Local logout completed despite server error');
          return { error: null }; // Return success since we cleaned up locally
        }
        
        return { error };
      }
      
      console.log('[Auth] Logout successful');
      return { error: null };
    } catch (error: any) {
      console.error('[Auth] Unexpected logout error:', error);
      
      // On any unexpected error, still try to clear local state
      setSession(null);
      setUser(null);
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem(UTM_LOCAL_STORAGE_KEY);
      }
      
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getProductionRedirectUrl("/reset-password"),
      });
      return { error };
    } catch (error: any) {
      console.error('Error in resetPassword:', error);
      return { error };
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
