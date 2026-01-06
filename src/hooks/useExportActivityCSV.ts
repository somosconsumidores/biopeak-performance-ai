import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./useAuth";

export const useExportActivityCSV = () => {
  const { session } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportActivityToCSV = async (activityId: string): Promise<boolean> => {
    setIsExporting(true);

    try {
      // Use session from context instead of API call
      if (!session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para exportar dados.",
          variant: "destructive",
        });
        return false;
      }

      console.log('[useExportActivityCSV] Starting CSV export for activity:', activityId);
      
      const { data, error } = await supabase.functions.invoke('export-activity-csv', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { activity_id: activityId }
      });

      if (error) {
        console.error('[useExportActivityCSV] Function error:', error);
        toast({
          title: "Erro na exportação",
          description: "Falha ao exportar dados para CSV. Tente novamente.",
          variant: "destructive",
        });
        return false;
      }

      // Make direct request to get CSV file
      const functionUrl = `https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/export-activity-csv`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activity_id: activityId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `activity_${activityId}_details.csv`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Exportação concluída",
        description: `Dados da atividade ${activityId} exportados para CSV com sucesso.`,
        variant: "default",
      });

      console.log('[useExportActivityCSV] CSV export completed successfully');
      return true;

    } catch (error) {
      console.error('[useExportActivityCSV] Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante a exportação.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportActivityToCSV,
    isExporting,
  };
};
