import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Instagram, 
  Facebook
} from 'lucide-react';

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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedImageBlob, setGeneratedImageBlob] = useState<Blob | null>(null);
  const { previewRef, generateWorkoutImage, shareWorkoutImage, onMapReady, resetMapReady } = useWorkoutImageShare();
  
  // CRITICAL: Use activity_id (Garmin ID) for data fetching as it has the actual GPS/chart data
  const activityId = workoutData.activity_id || workoutData.id || '';
  const { paceData } = useActivityPaceData(activityId);

  // Generate image automatically when dialog opens
  useEffect(() => {
    if (open) {
      resetMapReady();
      setGeneratedImageUrl(null);
      setGeneratedImageBlob(null);
      setIsGeneratingImage(true);

      // Wait a bit for the component to mount
      const timer = setTimeout(async () => {
        const result = await generateWorkoutImage(workoutData);
        if (result) {
          setGeneratedImageUrl(result.url);
          setGeneratedImageBlob(result.blob);
        }
        setIsGeneratingImage(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [open, generateWorkoutImage, workoutData, resetMapReady]);

  const handleShare = async (platform: string) => {
    if (!generatedImageBlob) return;
    await shareWorkoutImage(platform, generatedImageBlob, workoutData);
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
        <div className="relative p-4 sm:p-6 pt-2 sm:pt-0 space-y-4 pb-6">
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

          {/* Loading State */}
          {isGeneratingImage && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
              <p className="text-base font-semibold text-gray-700">Gerando imagem...</p>
            </div>
          )}

          {/* Generated Image Display */}
          {!isGeneratingImage && generatedImageUrl && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden shadow-lg border-2 border-gray-200">
                <img 
                  src={generatedImageUrl} 
                  alt="Workout Share Preview" 
                  className="w-full h-auto"
                />
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
          )}
        </div>
        {/* Close light theme wrapper */}
        </div>
      </DialogContent>
    </Dialog>
  );
};