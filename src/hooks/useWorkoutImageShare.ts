import { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { toast } from '@/hooks/use-toast';

export const useWorkoutImageShare = () => {
  const previewRef = useRef<HTMLDivElement>(null);
  const mapReadyRef = useRef<boolean>(false);

  const generateWorkoutImage = useCallback(async (workoutData: any): Promise<Blob | null> => {
    if (!previewRef.current) {
      console.error('🔍 IMAGE_SHARE: No preview element found');
      toast({
        title: "Erro",
        description: "Não foi possível capturar a imagem do treino.",
        variant: "destructive",
      });
      return null;
    }

    console.log('🔍 IMAGE_SHARE: Starting image generation process...');

    try {
      // Aguardar o mapa ficar pronto ou timeout de segurança
      const mapReadyPromise = new Promise<void>((resolve) => {
        if (mapReadyRef.current) {
          console.log('🔍 IMAGE_SHARE: Map already ready');
          resolve();
          return;
        }
        
        console.log('🔍 IMAGE_SHARE: Waiting for map to be ready...');
        const checkMap = () => {
          if (mapReadyRef.current) {
            console.log('🔍 IMAGE_SHARE: Map is now ready');
            resolve();
          } else {
            setTimeout(checkMap, 200);
          }
        };
        checkMap();
      });

      // Aguardar o mapa com timeout de segurança de 15 segundos
      console.log('🔍 IMAGE_SHARE: Racing between map ready and 15s timeout...');
      await Promise.race([
        mapReadyPromise,
        new Promise(resolve => {
          setTimeout(() => {
            console.warn('🔍 IMAGE_SHARE: Timeout reached - proceeding without map confirmation');
            resolve(undefined);
          }, 15000);
        })
      ]);
      
      // Additional delay to ensure everything is settled
      console.log('🔍 IMAGE_SHARE: Adding extra settling time...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🔍 IMAGE_SHARE: Starting html2canvas capture...');
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: '#0f172a',
        scale: 1,
        useCORS: true,
        allowTaint: true,
        width: 1080,
        height: 1920,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1080,
        windowHeight: 1920,
        logging: true, // Enable logging for debugging
        onclone: (clonedDoc) => {
          console.log('🔍 IMAGE_SHARE: Document cloned for capture');
          // Force all mapbox elements to be visible in cloned document
          const mapElements = clonedDoc.querySelectorAll('[class*="mapbox"]');
          mapElements.forEach(el => {
            if (el instanceof HTMLElement) {
              el.style.opacity = '1';
              el.style.visibility = 'visible';
            }
          });
        }
      });
      
      console.log('🔍 IMAGE_SHARE: Canvas generated successfully, size:', canvas.width, 'x', canvas.height);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('🔍 IMAGE_SHARE: Blob created successfully, size:', blob.size, 'bytes');
          } else {
            console.error('🔍 IMAGE_SHARE: Failed to create blob from canvas');
          }
          resolve(blob);
        }, 'image/png', 1.0);
      });
    } catch (error) {
      console.error('🔍 IMAGE_SHARE: Error generating image:', error);
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
    const pace = workoutData.average_pace_in_minutes_per_kilometer
      ? `${Math.floor(workoutData.average_pace_in_minutes_per_kilometer)}:${String(Math.round((workoutData.average_pace_in_minutes_per_kilometer % 1) * 60)).padStart(2, '0')}/km`
      : '--';
    const heartRate = workoutData.average_heart_rate_in_beats_per_minute
      ? `${Math.round(workoutData.average_heart_rate_in_beats_per_minute)} bpm`
      : '';

    const shareText = `🏃‍♂️ Acabei de completar uma ${activity}!
⏱️ ${duration} | 📍 ${distance} | 🏃 ${pace}${heartRate ? ` | ❤️ ${heartRate}` : ''}
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

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true;
  }, []);

  const resetMapReady = useCallback(() => {
    mapReadyRef.current = false;
  }, []);

  return {
    previewRef,
    generateWorkoutImage,
    shareWorkoutImage,
    downloadImage,
    onMapReady,
    resetMapReady,
  };
};