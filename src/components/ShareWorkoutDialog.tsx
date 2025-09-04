import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  Download,
  Image as ImageIcon,
  Instagram, 
  Facebook, 
  Twitter, 
  Linkedin, 
  MessageCircle,
  Check,
  X
} from 'lucide-react';
import { SocialShareButton } from './SocialShareButton';
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

  // Check if Web Share API supports files
  const canShareFiles = navigator.share && navigator.canShare && 
    navigator.canShare({ files: [new File([''], 'test.png', { type: 'image/png' })] });

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

          {/* Social Media Buttons */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-center text-gray-900">Compartilhar Imagem do Treino</h3>
            <p className="text-xs sm:text-sm text-gray-600 text-center">
              Gere uma imagem personalizada com suas métricas para compartilhar
            </p>
            
            {/* Quick Share Button if supported */}
            {canShareFiles && (
              <Button
                onClick={() => handleImageShare('native')}
                disabled={isGeneratingImage}
                className="w-full mb-3 sm:mb-4 bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80 text-sm"
              >
                {isGeneratingImage ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Gerando imagem...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar Imagem
                  </>
                )}
              </Button>
            )}
            
            <div className={`grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 transition-all duration-500 ${shareAnimationActive ? 'scale-95' : 'scale-100'}`}>
              <SocialShareButton
                icon={Instagram}
                label="Instagram"
                color="from-pink-500 to-purple-600"
                onClick={() => handleImageShare('instagram')}
                delay={0}
                disabled={isGeneratingImage}
              />
              <SocialShareButton
                icon={Facebook}
                label="Facebook"
                color="from-blue-600 to-blue-700"
                onClick={() => handleImageShare('facebook')}
                delay={100}
                disabled={isGeneratingImage}
              />
              <SocialShareButton
                icon={Twitter}
                label="Twitter"
                color="from-sky-400 to-blue-500"
                onClick={() => handleImageShare('twitter')}
                delay={200}
                disabled={isGeneratingImage}
              />
              <SocialShareButton
                icon={Linkedin}
                label="LinkedIn"
                color="from-blue-700 to-blue-800"
                onClick={() => handleImageShare('linkedin')}
                delay={300}
                disabled={isGeneratingImage}
              />
              <SocialShareButton
                icon={MessageCircle}
                label="WhatsApp"
                color="from-green-500 to-green-600"
                onClick={() => handleImageShare('whatsapp')}
                delay={400}
                disabled={isGeneratingImage}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => handleImageShare('download')}
              disabled={isGeneratingImage}
              className="bg-white border border-gray-300 hover:bg-gray-50 group text-sm text-gray-900"
            >
              {isGeneratingImage ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                  Baixar Imagem
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