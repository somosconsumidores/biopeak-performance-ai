import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Instagram, 
  Facebook
} from 'lucide-react';

import { toast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { usePlatform } from '@/hooks/usePlatform';
import shareRunningBg from '@/assets/share-running.png';
import shareSwimmingBg from '@/assets/share-swimming.png';
import shareCyclingBg from '@/assets/share-cycling.png';

interface ShareWorkoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutData: {
    id: string;
    activity_id?: string;
    activity_type: string | null;
    duration_in_seconds: number | null;
    distance_in_meters: number | null;
    average_pace_in_minutes_per_kilometer: number | null;
    active_kilocalories: number | null;
    average_heart_rate_in_beats_per_minute: number | null;
    total_elevation_gain_in_meters: number | null;
    start_time_in_seconds: number | null;
    coordinates?: Array<{ latitude: number; longitude: number }>;
  };
}

export const ShareWorkoutDialog = ({ open, onOpenChange, workoutData }: ShareWorkoutDialogProps) => {
  const [generatedImageBlob, setGeneratedImageBlob] = useState<Blob | null>(null);
  const imagePreviewRef = useRef<HTMLDivElement>(null);
  const { isAndroid } = usePlatform();

  // Helper functions
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number | null) => {
    if (!meters) return '--';
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatPace = (paceInMinutes: number | null) => {
    if (!paceInMinutes) return '--:--';
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const getBackgroundImage = () => {
    const type = workoutData.activity_type?.toUpperCase();
    if (!type) return shareRunningBg;
    
    if (['SWIM', 'LAP_SWIMMING', 'OPEN_WATER_SWIMMING'].includes(type)) {
      return shareSwimmingBg;
    }
    if (['RUN', 'RUNNING', 'TREADMILL_RUNNING', 'INDOOR_CARDIO', 'WALK', 'WALKING'].includes(type)) {
      return shareRunningBg;
    }
    if (['RIDE', 'CYCLING', 'ROAD_BIKING', 'VIRTUALRIDE', 'MOUNTAIN_BIKING', 'INDOOR_CYCLING'].includes(type)) {
      return shareCyclingBg;
    }
    
    return shareRunningBg;
  };

  const formatWorkoutType = () => {
    const type = workoutData.activity_type;
    if (!type) return 'Atividade';
    
    const typeMap: { [key: string]: string } = {
      'long_run': 'Long Run',
      'tempo_run': 'Tempo Run', 
      'interval_training': 'Interval',
      'easy_run': 'Easy Run',
      'recovery_run': 'Recovery',
      'fartlek': 'Fartlek',
      'hill_training': 'Hill Training',
      'race': 'Race',
      'running': 'Corrida',
      'cycling': 'Ciclismo',
      'swimming': 'Natação'
    };
    
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleShare = async (platform: string) => {
    if (!imagePreviewRef.current) {
      toast({
        title: "Erro",
        description: "Não foi possível capturar a imagem",
        variant: "destructive"
      });
      return;
    }

    try {
      const canvas = await html2canvas(imagePreviewRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/png', 1.0);
      });

      // Native Android sharing
      if (isAndroid) {
        try {
          // Dynamic import Capacitor plugins (only loaded on native)
          const { Share } = await import('@capacitor/share');
          const { Filesystem, Directory } = await import('@capacitor/filesystem');

          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          
          await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
          });

          const base64Data = reader.result as string;
          const base64String = base64Data.split(',')[1];

          // Save to filesystem temporarily
          const fileName = `workout-biopeak-${Date.now()}.png`;
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64String,
            directory: Directory.Cache
          });

          // Share using native share dialog
          await Share.share({
            title: 'Meu Treino BioPeak',
            text: 'Confira meu treino no BioPeak! 🏃‍♂️💪',
            url: savedFile.uri,
            dialogTitle: 'Compartilhar no Instagram ou Facebook'
          });

          // Close dialog after sharing
          onOpenChange(false);
          
        } catch (error) {
          console.error('Error sharing on Android:', error);
          toast({
            title: "Erro",
            description: "Não foi possível compartilhar a imagem",
            variant: "destructive"
          });
        }
        return;
      }

      // Web fallback - download image
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workout-biopeak-${platform}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show platform-specific toast
      if (platform === 'instagram') {
        toast({
          title: "✨ Imagem salva!",
          description: "Abra o Instagram e selecione a imagem da galeria para postar no Stories ou Feed.",
          duration: 6000,
        });
      } else if (platform === 'facebook') {
        toast({
          title: "✨ Imagem salva!",
          description: "Abra o Facebook e selecione a imagem da galeria para criar sua postagem.",
          duration: 6000,
        });
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar a imagem",
        variant: "destructive"
      });
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="light static-dialog w-[100vw] sm:w-[95vw] max-w-2xl h-[100vh] sm:max-h-[95vh] p-0 overflow-y-auto fixed inset-0 sm:inset-auto">
        {/* Force light theme wrapper */}
        <div className="light bg-white text-gray-900 min-h-full">
        
        {/* Header */}
        <DialogHeader className="relative p-4 sm:p-6 pb-2 sm:pb-4 border-b border-gray-200">
          <DialogTitle className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            ✨ Compartilhe sua Conquista
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="relative p-4 space-y-4 pb-6">
          {/* Image Preview - This is what will be captured */}
          <div 
            ref={imagePreviewRef}
            className="relative w-full aspect-[9/16] rounded-lg overflow-hidden"
            style={{ 
              backgroundImage: `url(${getBackgroundImage()})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Stats Grid */}
            <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2">
              <div className="grid grid-cols-2 gap-6 text-white">
                {/* Tempo */}
                <div className="text-center bg-black/20 backdrop-blur-sm rounded-lg p-4">
                  <div className="font-black text-3xl mb-1" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                    {formatDuration(workoutData.duration_in_seconds)}
                  </div>
                  <div className="font-semibold text-sm opacity-90">Tempo</div>
                </div>

                {/* Distância */}
                <div className="text-center bg-black/20 backdrop-blur-sm rounded-lg p-4">
                  <div className="font-black text-3xl mb-1" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                    {formatDistance(workoutData.distance_in_meters)}
                  </div>
                  <div className="font-semibold text-sm opacity-90">Distância</div>
                </div>

                {/* Ritmo */}
                <div className="text-center bg-black/20 backdrop-blur-sm rounded-lg p-4">
                  <div className="font-black text-3xl mb-1" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                    {formatPace(workoutData.average_pace_in_minutes_per_kilometer)}
                  </div>
                  <div className="font-semibold text-sm opacity-90">Ritmo Médio</div>
                </div>

                {/* Calorias */}
                <div className="text-center bg-black/20 backdrop-blur-sm rounded-lg p-4">
                  <div className="font-black text-3xl mb-1" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                    {workoutData.active_kilocalories ? Math.round(workoutData.active_kilocalories) : '--'}
                  </div>
                  <div className="font-semibold text-sm opacity-90">Calorias</div>
                </div>
              </div>
            </div>

            {/* Workout Type */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <div className="text-white font-black text-2xl" style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.8)' }}>
                {formatWorkoutType()}
              </div>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => handleShare('instagram')}
              className="w-full h-14 bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 hover:from-pink-600 hover:via-purple-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Instagram className="h-5 w-5 mr-2" />
              Compartilhar no Instagram
            </Button>

            <Button
              onClick={() => handleShare('facebook')}
              className="w-full h-14 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Facebook className="h-5 w-5 mr-2" />
              Compartilhar no Facebook
            </Button>
          </div>
        </div>
        {/* Close light theme wrapper */}
        </div>
      </DialogContent>
    </Dialog>
  );
};