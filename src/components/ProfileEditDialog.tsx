import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarIcon, Camera, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';

interface ProfileEditDialogProps {
  children: React.ReactNode;
}

export function ProfileEditDialog({ children }: ProfileEditDialogProps) {
  const { profile, updating, updateProfile, uploadAvatar } = useProfile();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    birth_date: profile?.birth_date ? new Date(profile.birth_date) : undefined,
    weight_kg: profile?.weight_kg || '',
    height_cm: profile?.height_cm || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const updateData = {
      display_name: formData.display_name || null,
      birth_date: formData.birth_date ? formData.birth_date.toISOString().split('T')[0] : null,
      weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
      height_cm: formData.height_cm ? Number(formData.height_cm) : null
    };

    await updateProfile(updateData);
    setOpen(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    await uploadAvatar(file);
    setUploading(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[500px] profile-dialog-content border-glass-border fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          background: 'hsl(var(--glass-bg))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-glass)',
          transform: 'translate(-50%, -50%) !important',
          transition: 'none !important'
        }}
      >
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="text-2xl font-bold bg-gradient-primary text-white">
                  {profile?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="absolute -bottom-2 -right-2 border-glass-border"
                onClick={triggerFileInput}
                disabled={uploading}
                style={{
                  background: 'hsl(var(--glass-bg))',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  transform: 'none !important',
                  transition: 'none !important',
                  position: 'absolute',
                  bottom: '-8px',
                  right: '-8px'
                }}
              >
                {uploading ? (
                  <Upload className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground text-center">
              Clique na câmera para alterar sua foto
            </p>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="display_name">Nome Completo</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="Seu nome completo"
              className="glass-card border-glass-border"
            />
          </div>

          {/* Data de nascimento */}
          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal glass-card border-glass-border",
                    !formData.birth_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.birth_date ? (
                    format(formData.birth_date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione sua data de nascimento</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 glass-card border-glass-border" align="start">
                <Calendar
                  mode="single"
                  selected={formData.birth_date}
                  onSelect={(date) => setFormData(prev => ({ ...prev, birth_date: date }))}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Peso e Altura */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="30"
                max="300"
                value={formData.weight_kg}
                onChange={(e) => setFormData(prev => ({ ...prev, weight_kg: e.target.value }))}
                placeholder="70.5"
                className="glass-card border-glass-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Altura (cm)</Label>
              <Input
                id="height"
                type="number"
                min="100"
                max="250"
                value={formData.height_cm}
                onChange={(e) => setFormData(prev => ({ ...prev, height_cm: e.target.value }))}
                placeholder="175"
                className="glass-card border-glass-border"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="glass-card border-glass-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updating}
              className="btn-primary"
            >
              {updating ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}