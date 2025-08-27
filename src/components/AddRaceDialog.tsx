import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTargetRaces, TargetRace } from "@/hooks/useTargetRaces";
import { Calendar, Clock, MapPin } from "lucide-react";

interface AddRaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race?: TargetRace;
  onSuccess?: () => void;
}

export function AddRaceDialog({ open, onOpenChange, race, onSuccess }: AddRaceDialogProps) {
  const { addRace, updateRace } = useTargetRaces();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    race_name: race?.race_name || '',
    race_date: race?.race_date || '',
    distance_meters: race?.distance_meters || 5000,
    target_time_minutes: race?.target_time_minutes || '',
    race_location: race?.race_location || '',
    race_url: race?.race_url || '',
    notes: race?.notes || '',
    status: race?.status || 'planned' as const,
  });

  const distanceOptions = [
    { label: '5K', value: 5000 },
    { label: '10K', value: 10000 },
    { label: 'Meia Maratona (21K)', value: 21097 },
    { label: 'Maratona (42K)', value: 42195 },
    { label: 'Personalizada', value: 0 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const raceData = {
        ...formData,
        target_time_minutes: formData.target_time_minutes ? 
          Number(formData.target_time_minutes) : undefined,
      };

      if (race) {
        await updateRace(race.id, raceData);
      } else {
        await addRace(raceData);
      }

      onSuccess?.(); // Callback to refresh parent data
      onOpenChange(false);
      // Reset form
      setFormData({
        race_name: '',
        race_date: '',
        distance_meters: 5000,
        target_time_minutes: '',
        race_location: '',
        race_url: '',
        notes: '',
        status: 'planned',
      });
    } catch (error) {
      console.error('Error saving race:', error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {race ? 'Editar Prova' : 'Adicionar Nova Prova'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="race_name">Nome da Prova *</Label>
            <Input
              id="race_name"
              value={formData.race_name}
              onChange={(e) => setFormData(prev => ({ ...prev, race_name: e.target.value }))}
              placeholder="Ex: Maratona de São Paulo 2024"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="race_date">Data da Prova *</Label>
              <Input
                id="race_date"
                type="date"
                value={formData.race_date}
                onChange={(e) => setFormData(prev => ({ ...prev, race_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Distância *</Label>
              <Select 
                value={formData.distance_meters.toString()} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  distance_meters: Number(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {distanceOptions.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.distance_meters === 0 && (
            <div className="space-y-2">
              <Label htmlFor="custom_distance">Distância Personalizada (metros)</Label>
              <Input
                id="custom_distance"
                type="number"
                min="100"
                placeholder="Ex: 15000"
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  distance_meters: Number(e.target.value) || 0 
                }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="target_time">Tempo Alvo em Minutos (opcional)</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                id="target_time"
                type="number"
                min="1"
                placeholder="Ex: 180 (para 3 horas)"
                value={formData.target_time_minutes || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  target_time_minutes: e.target.value
                }))}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Informe o tempo em minutos totais (ex: 180 para 3 horas, 30 para 30 minutos)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="race_location">Local (opcional)</Label>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Input
                id="race_location"
                value={formData.race_location}
                onChange={(e) => setFormData(prev => ({ ...prev, race_location: e.target.value }))}
                placeholder="Ex: São Paulo, SP"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="race_url">Site da Prova (opcional)</Label>
            <Input
              id="race_url"
              type="url"
              value={formData.race_url}
              onChange={(e) => setFormData(prev => ({ ...prev, race_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Suas anotações sobre a prova..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : race ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}