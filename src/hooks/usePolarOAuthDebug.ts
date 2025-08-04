import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface OAuthDebugInfo {
  currentUrl: string;
  expectedCallback: string;
  userAgent: string;
  timestamp: string;
  urlParameters: Record<string, string>;
  userSession: any;
  healthCheck: any;
  configCheck: any;
}

export const usePolarOAuthDebug = () => {
  const [debugInfo, setDebugInfo] = useState<OAuthDebugInfo | null>(null);
  const [isDebugging, setIsDebugging] = useState(false);

  const runFullDiagnostics = async () => {
    setIsDebugging(true);
    console.log('🔍 Running comprehensive Polar OAuth diagnostics...');
    
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlParameters = Object.fromEntries(searchParams.entries());
      
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Check Polar health
      console.log('🔍 Checking Polar health...');
      const { data: healthData, error: healthError } = await supabase.functions.invoke('polar-health-check');
      
      // Check Polar config
      console.log('🔍 Checking Polar config...');
      const { data: configData, error: configError } = await supabase.functions.invoke('get-polar-config');
      
      const diagnostics: OAuthDebugInfo = {
        currentUrl: window.location.href,
        expectedCallback: `${window.location.origin}/polar-callback`,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        urlParameters,
        userSession: {
          authenticated: !!sessionData.session,
          userId: sessionData.session?.user.id,
          email: sessionData.session?.user.email,
        },
        healthCheck: {
          success: !healthError,
          data: healthData,
          error: healthError?.message,
        },
        configCheck: {
          success: !configError,
          data: configData,
          error: configError?.message,
        }
      };
      
      setDebugInfo(diagnostics);
      
      console.log('🔍 COMPREHENSIVE DIAGNOSTICS RESULTS:');
      console.log('📋 URL Info:', {
        current: diagnostics.currentUrl,
        expected: diagnostics.expectedCallback,
        parameters: diagnostics.urlParameters
      });
      console.log('👤 User Session:', diagnostics.userSession);
      console.log('🩺 Health Check:', diagnostics.healthCheck);
      console.log('⚙️ Config Check:', diagnostics.configCheck);
      
      return diagnostics;
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      throw error;
    } finally {
      setIsDebugging(false);
    }
  };

  const logAuditTrail = async (event: string, details: any) => {
    const auditEntry = {
      event,
      timestamp: new Date().toISOString(),
      details,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    console.log(`📋 AUDIT: ${event}`, auditEntry);
    
    // Store in sessionStorage for debugging
    const auditLog = JSON.parse(sessionStorage.getItem('polar_oauth_audit') || '[]');
    auditLog.push(auditEntry);
    sessionStorage.setItem('polar_oauth_audit', JSON.stringify(auditLog));
  };

  const getAuditTrail = () => {
    return JSON.parse(sessionStorage.getItem('polar_oauth_audit') || '[]');
  };

  const clearAuditTrail = () => {
    sessionStorage.removeItem('polar_oauth_audit');
  };

  return {
    debugInfo,
    isDebugging,
    runFullDiagnostics,
    logAuditTrail,
    getAuditTrail,
    clearAuditTrail
  };
};