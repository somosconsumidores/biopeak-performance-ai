import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  Copy, 
  QrCode, 
  Instagram, 
  Facebook, 
  Twitter, 
  Linkedin, 
  MessageCircle,
  Check,
  Clock,
  MapPin,
  Heart,
  Zap,
  TrendingUp,
  BarChart3,
  X
} from 'lucide-react';
import { SocialShareButton } from './SocialShareButton';
import { WorkoutSharePreview } from './WorkoutSharePreview';
import { toast } from '@/hooks/use-toast';

interface ShareWorkoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutData: {
    id: string;
    activity_type: string | null;
    duration_in_seconds: number | null;
    distance_in_meters: number | null;
    average_pace_in_minutes_per_kilometer: number | null;
    active_kilocalories: number | null;
    average_heart_rate_in_beats_per_minute: number | null;
    total_elevation_gain_in_meters: number | null;
    start_time_in_seconds: number | null;
  };
}

export const ShareWorkoutDialog = ({ open, onOpenChange, workoutData }: ShareWorkoutDialogProps) => {
  const [shareAnimationActive, setShareAnimationActive] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  // Helper functions
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
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
    if (!paceInMinutes) return '--';
    const minutes = Math.floor(paceInMinutes);
    const seconds = Math.round((paceInMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const getActivityType = (type: string | null) => {
    if (!type) return 'Atividade';
    const typeMap: { [key: string]: string } = {
      'running': 'Corrida',
      'cycling': 'Ciclismo', 
      'walking': 'Caminhada',
      'swimming': 'Natação',
      'fitness_equipment': 'Academia'
    };
    return typeMap[type.toLowerCase()] || type;
  };

  // Generate share URL
  const shareUrl = `${window.location.origin}/share/${workoutData.id}`;

  // Generate share text
  const generateShareText = (platform: string) => {
    const activity = getActivityType(workoutData.activity_type);
    const duration = formatDuration(workoutData.duration_in_seconds);
    const distance = formatDistance(workoutData.distance_in_meters);
    const pace = formatPace(workoutData.average_pace_in_minutes_per_kilometer);
    const calories = workoutData.active_kilocalories || '--';

    const baseText = `🏃‍♂️ Acabei de completar uma ${activity}!
⏱️ ${duration} | 📍 ${distance} | ⚡ ${pace}
🔥 ${calories} kcal queimadas

#BioPeak #Fitness #Treino`;

    switch (platform) {
      case 'instagram':
        return `${baseText}\n\n✨ Acompanhe meus treinos no BioPeak!`;
      case 'facebook':
        return `${baseText}\n\nVeja minha análise completa no BioPeak: ${shareUrl}`;
      case 'twitter':
        return `${baseText}\n\n📊 ${shareUrl}`;
      case 'linkedin':
        return `Mantenho minha rotina de exercícios em dia! 💪\n\n${baseText}\n\nAcompanhe meus progressos: ${shareUrl}`;
      case 'whatsapp':
        return `${baseText}\n\nConfira minha análise completa: ${shareUrl}`;
      default:
        return baseText;
    }
  };

  // Copy to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedToClipboard(true);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  // Share handlers
  const handleShare = (platform: string) => {
    setShareAnimationActive(true);
    setTimeout(() => setShareAnimationActive(false), 600);

    const text = generateShareText(platform);
    let url = '';

    switch (platform) {
      case 'instagram':
        // Instagram doesn't support direct sharing via URL, so we copy the text
        navigator.clipboard.writeText(text);
        toast({
          title: "Texto copiado!",
          description: "Cole no Instagram para compartilhar.",
        });
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(text)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        break;
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="static-dialog max-w-2xl p-0 overflow-hidden">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 animate-pulse" />
        
        {/* Header */}
        <DialogHeader className="relative p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ✨ Compartilhe sua Conquista
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="hover:bg-muted/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="relative p-6 pt-0 space-y-6">
          {/* Workout Preview */}
          <div className="relative">
            <WorkoutSharePreview workoutData={workoutData} />
          </div>

          {/* Social Media Buttons */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Compartilhar nas Redes Sociais</h3>
            
            <div className={`grid grid-cols-5 gap-3 transition-all duration-500 ${shareAnimationActive ? 'scale-95' : 'scale-100'}`}>
              <SocialShareButton
                icon={Instagram}
                label="Instagram"
                color="from-pink-500 to-purple-600"
                onClick={() => handleShare('instagram')}
                delay={0}
              />
              <SocialShareButton
                icon={Facebook}
                label="Facebook"
                color="from-blue-600 to-blue-700"
                onClick={() => handleShare('facebook')}
                delay={100}
              />
              <SocialShareButton
                icon={Twitter}
                label="Twitter"
                color="from-sky-400 to-blue-500"
                onClick={() => handleShare('twitter')}
                delay={200}
              />
              <SocialShareButton
                icon={Linkedin}
                label="LinkedIn"
                color="from-blue-700 to-blue-800"
                onClick={() => handleShare('linkedin')}
                delay={300}
              />
              <SocialShareButton
                icon={MessageCircle}
                label="WhatsApp"
                color="from-green-500 to-green-600"
                onClick={() => handleShare('whatsapp')}
                delay={400}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="glass-card border-glass-border hover:bg-glass-bg-hover group"
            >
              {copiedToClipboard ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-400" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                  Copiar Link
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowQRCode(!showQRCode)}
              className="glass-card border-glass-border hover:bg-glass-bg-hover group"
            >
              <QrCode className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
              QR Code
            </Button>
          </div>

          {/* QR Code Section */}
          {showQRCode && (
            <div className="mt-4 p-4 glass-card border-glass-border rounded-lg text-center animate-fade-in">
              <div className="w-32 h-32 mx-auto bg-white rounded-lg flex items-center justify-center mb-2">
                <QrCode className="h-16 w-16 text-black" />
              </div>
              <p className="text-sm text-muted-foreground">
                Escaneie para acessar o treino no mobile
              </p>
            </div>
          )}

          {/* Success Message */}
          {shareAnimationActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="glass-card border-glass-border p-6 text-center animate-scale-in">
                <Share2 className="h-8 w-8 mx-auto mb-2 text-primary animate-pulse" />
                <p className="font-semibold">Compartilhando...</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};