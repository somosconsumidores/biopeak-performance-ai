import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarIcon, Camera, Upload, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, setYear, setMonth, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

export const ProfileEdit = () => {
  const navigate = useNavigate();
  const { profile, updating, updateProfile, uploadAvatar } = useProfile();
  const [uploading, setUploading] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
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
    toast.success('Perfil atualizado com sucesso!');
    navigate('/profile');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    await uploadAvatar(file);
    setUploading(false);
    toast.success('Avatar atualizado com sucesso!');
  };

  // Gerar anos de 1920 até o ano atual
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);
  
  const months = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' }
  ];

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/profile')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Perfil
            </Button>
          </div>

          <Card className="glass-card border-glass-border">
            <CardHeader>
              <CardTitle>Editar Perfil</CardTitle>
            </CardHeader>
            <CardContent>
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
                      className="absolute -bottom-2 -right-2"
                      onClick={triggerFileInput}
                      disabled={uploading}
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
                          "w-full justify-start text-left font-normal",
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
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 space-y-3">
                        {/* Navegação por Ano e Mês */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Select 
                              value={calendarDate.getFullYear().toString()} 
                              onValueChange={(year) => setCalendarDate(setYear(calendarDate, parseInt(year)))}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-48">
                                {years.map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Select 
                              value={calendarDate.getMonth().toString()} 
                              onValueChange={(month) => setCalendarDate(setMonth(calendarDate, parseInt(month)))}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {months.map((month) => (
                                  <SelectItem key={month.value} value={month.value.toString()}>
                                    {month.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <Calendar
                          mode="single"
                          selected={formData.birth_date}
                          onSelect={(date) => setFormData(prev => ({ ...prev, birth_date: date }))}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          month={calendarDate}
                          onMonthChange={setCalendarDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </div>
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
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/profile')}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};