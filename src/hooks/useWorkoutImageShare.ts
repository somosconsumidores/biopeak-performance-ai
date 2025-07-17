import { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { toast } from '@/hooks/use-toast';

export const useWorkoutImageShare = () => {
  const previewRef = useRef<HTMLDivElement>(null);

  const generateWorkoutImage = useCallback(async (workoutData: any): Promise<Blob | null> => {
    if (!previewRef.current) {
      toast({
        title: "Erro",
        description: "Não foi possível capturar a imagem do treino.",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Aguardar um pouco para garantir que o componente esteja totalmente renderizado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: '#0f172a',
        scale: 2, // Maior qualidade
        useCORS: true,
        allowTaint: true,
        width: 800,
        height: 600,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 800,
        windowHeight: 600,
        logging: false,
      });

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png', 1.0);
      });
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar a imagem do treino.",
        variant: "destructive",
      });
      return null;
    }
  }, []);

  const shareWorkoutImage = useCallback(async (platform: string, workoutData: any) => {
    const imageBlob = await generateWorkoutImage(workoutData);
    
    if (!imageBlob) return;

    const activity = workoutData.activity_type || 'Atividade';
    const duration = workoutData.duration_in_seconds 
      ? `${Math.floor(workoutData.duration_in_seconds / 60)}min` 
      : '--';
    const distance = workoutData.distance_in_meters 
      ? `${(workoutData.distance_in_meters / 1000).toFixed(1)}km` 
      : '--';

    const shareText = `🏃‍♂️ Acabei de completar uma ${activity}!
⏱️ ${duration} | 📍 ${distance}
💪 Acompanhe meus treinos no BioPeak!
#BioPeak #Fitness #Treino`;

    if (navigator.share && platform === 'native') {
      try {
        const file = new File([imageBlob], 'workout-biopeak.png', { type: 'image/png' });
        await navigator.share({
          title: 'Meu Treino no BioPeak',
          text: shareText,
          files: [file],
        });
        toast({
          title: "Compartilhado!",
          description: "Treino compartilhado com sucesso.",
        });
      } catch (error) {
        console.error('Erro ao compartilhar:', error);
        // Fallback para download
        downloadImage(imageBlob);
      }
    } else {
      // Para plataformas específicas, fazer download da imagem
      downloadImage(imageBlob, platform);
      
      // Copiar texto para área de transferência
      if (platform !== 'download') {
        try {
          await navigator.clipboard.writeText(shareText);
          toast({
            title: "Pronto para compartilhar!",
            description: "Imagem baixada e texto copiado. Cole no " + getPlatformName(platform) + ".",
          });
        } catch (error) {
          toast({
            title: "Imagem baixada!",
            description: "Use a imagem baixada para compartilhar no " + getPlatformName(platform) + ".",
          });
        }
      }
    }
  }, [generateWorkoutImage]);

  const downloadImage = useCallback((blob: Blob, platform?: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workout-biopeak-${platform || 'share'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const getPlatformName = (platform: string): string => {
    const names: { [key: string]: string } = {
      'instagram': 'Instagram',
      'facebook': 'Facebook', 
      'twitter': 'Twitter',
      'linkedin': 'LinkedIn',
      'whatsapp': 'WhatsApp',
    };
    return names[platform] || platform;
  };

  return {
    previewRef,
    generateWorkoutImage,
    shareWorkoutImage,
    downloadImage,
  };
};