import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download,
  Image as ImageIcon,
  Instagram, 
  Facebook, 
  X,
  ChevronRight
} from 'lucide-react';

import { WorkoutSharePreview } from './WorkoutSharePreview';
import { WorkoutShareImage } from './WorkoutShareImage';
import { useWorkoutImageShare } from '@/hooks/useWorkoutImageShare';
import { useActivityPaceData } from '@/hooks/useActivityPaceData';
import { toast } from '@/hooks/use-toast';

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
  const [shareAnimationActive, setShareAnimationActive] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const { previewRef, shareWorkoutImage, onMapReady, resetMapReady } = useWorkoutImageShare();
  
  // CRITICAL: Use activity_id (Garmin ID) for data fetching as it has the actual GPS/chart data
  const activityId = workoutData.activity_id || workoutData.id || '';
  const { paceData } = useActivityPaceData(activityId);

  // Debug log
  console.log('🔍 SHARE WORKOUT DIALOG:', {
    workoutId: workoutData.id,
    activityId: workoutData.activity_id, 
    finalId: activityId,
    hasPaceData: !!paceData,
    paceDataLength: paceData?.length || 0,
    workoutData: workoutData
  });

  // Share handlers with image generation
  // Reset map ready state when dialog opens
  useEffect(() => {
    if (open) {
      resetMapReady();
    }
  }, [open, resetMapReady]);

  const handleImageShare = async (platform: string) => {
    setShareAnimationActive(true);
    setIsGeneratingImage(true);
    
    try {
      await shareWorkoutImage(platform, workoutData);
    } finally {
      setShareAnimationActive(false);
      setIsGeneratingImage(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="light static-dialog w-[100vw] sm:w-[95vw] max-w-2xl h-[100vh] sm:max-h-[95vh] p-0 overflow-y-auto fixed inset-0 sm:inset-auto">
        {/* Force light theme wrapper */}
        <div className="light bg-white text-gray-900 min-h-full">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-green-500/20 animate-pulse" />
        
        {/* Header */}
        <DialogHeader className="relative p-4 sm:p-6 pb-2 sm:pb-4 sticky top-0 bg-white/90 backdrop-blur-sm z-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              ✨ Compartilhe sua Conquista
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="hover:bg-gray-100 flex-shrink-0 text-gray-600"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="relative p-4 sm:p-6 pt-2 sm:pt-0 space-y-4 sm:space-y-6 pb-6">
          {/* Workout Preview para visualização */}
          <div className="mb-6">
            <WorkoutSharePreview workoutData={{
              ...workoutData,
              id: activityId,
              coordinates: paceData?.map(p => ({
                latitude: p.coordinates[0],
                longitude: p.coordinates[1]
              })) || []
            }} />
          </div>

          {/* Hidden div for image generation */}
          <div className="absolute -top-[10000px] left-0" ref={previewRef}>
            <WorkoutShareImage 
              workoutData={{
                ...workoutData,
                id: activityId,
                coordinates: paceData?.map(p => ({
                  latitude: p.coordinates[0],
                  longitude: p.coordinates[1]
                })) || []
              }} 
              onMapReady={onMapReady}
            />
          </div>

          {/* Social Media Share */}
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-900">Compartilhe sua conquista</h3>
              <p className="text-sm text-gray-600">
                Mostre seu progresso para o mundo
              </p>
            </div>
            
            {/* Instagram Share Button */}
            <Button
              onClick={() => handleImageShare('instagram')}
              disabled={isGeneratingImage}
              className="w-full h-16 bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 hover:from-pink-600 hover:via-purple-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isGeneratingImage ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                  <span className="text-base font-semibold">Gerando...</span>
                </>
              ) : (
                <>
                  <Instagram className="h-6 w-6 mr-3" />
                  <span className="flex-1 text-left">
                    <div className="text-base font-bold">Instagram</div>
                    <div className="text-xs opacity-90">Stories ou Feed</div>
                  </span>
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </Button>

            {/* Facebook Share Button */}
            <Button
              onClick={() => handleImageShare('facebook')}
              disabled={isGeneratingImage}
              className="w-full h-16 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isGeneratingImage ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                  <span className="text-base font-semibold">Gerando...</span>
                </>
              ) : (
                <>
                  <Facebook className="h-6 w-6 mr-3" />
                  <span className="flex-1 text-left">
                    <div className="text-base font-bold">Facebook</div>
                    <div className="text-xs opacity-90">Compartilhe com amigos</div>
                  </span>
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>

          {/* Download Option */}
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => handleImageShare('download')}
              disabled={isGeneratingImage}
              className="w-full bg-white border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 font-semibold"
            >
              {isGeneratingImage ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 mr-2" />
                  Apenas Baixar Imagem
                </>
              )}
            </Button>
          </div>


          {/* Loading Message */}
          {shareAnimationActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg z-40">
              <div className="bg-white/95 border border-gray-200 p-4 sm:p-6 text-center animate-scale-in rounded-lg shadow-lg">
                <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-blue-600 animate-pulse" />
                <p className="font-semibold text-sm sm:text-base text-gray-900">
                  {isGeneratingImage ? 'Gerando imagem...' : 'Processando...'}
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Close light theme wrapper */}
        </div>
      </DialogContent>
    </Dialog>
  );
};