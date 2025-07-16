import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WorkoutSharePreview } from '@/components/WorkoutSharePreview';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const WorkoutShare = () => {
  const { workoutId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkoutData = async () => {
      if (!workoutId) return;
      
      try {
        const { data, error } = await supabase
          .from('garmin_activities')
          .select('*')
          .eq('activity_id', workoutId)
          .single();

        if (error) throw error;
        setWorkoutData(data);
      } catch (error) {
        console.error('Error fetching workout:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do treino",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutData();
  }, [workoutId, toast]);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'Meu Treino - BioPeak',
        text: 'Confira meu treino no BioPeak!',
        url: window.location.href
      });
    } catch (error) {
      // Fallback para copiar URL
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência"
      });
    }
  };

  const handleDownload = () => {
    // TODO: Implementar download da imagem
    toast({
      title: "Em breve",
      description: "Funcionalidade de download será implementada"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary">Carregando treino...</div>
      </div>
    );
  }

  if (!workoutData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Treino não encontrado</h1>
          <Button onClick={() => navigate('/workouts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar aos Treinos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/workouts')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            
            <h1 className="text-lg font-semibold">Compartilhar Treino</h1>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Compartilhar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <WorkoutSharePreview workoutData={workoutData} />
        </div>
        
        {/* Instructions */}
        <div className="max-w-md mx-auto mt-8 text-center text-sm text-muted-foreground">
          <p>
            Compartilhe seus resultados nas redes sociais ou baixe a imagem para usar onde quiser!
          </p>
        </div>
      </div>
    </div>
  );
};