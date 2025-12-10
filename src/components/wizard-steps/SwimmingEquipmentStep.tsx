import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';

interface SwimmingEquipmentStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

const EQUIPMENT_OPTIONS = [
  {
    id: 'palmar',
    label: 'Palmar (Hand Paddles)',
    description: 'Aumenta resistência e força na braçada',
  },
  {
    id: 'nadadeira',
    label: 'Nadadeira (Fins)',
    description: 'Melhora técnica de pernada e velocidade',
  },
  {
    id: 'pull_buoy',
    label: 'Pull Buoy',
    description: 'Isola braços para treino de braçada',
  },
  {
    id: 'snorkel',
    label: 'Snorkel Frontal',
    description: 'Permite foco na técnica sem virar para respirar',
  },
  {
    id: 'prancha',
    label: 'Prancha (Kickboard)',
    description: 'Treino isolado de pernada',
  },
  {
    id: 'elastico',
    label: 'Elástico de Tornozelo',
    description: 'Aumenta dificuldade no treino de pernada',
  },
];

export function SwimmingEquipmentStep({ wizardData, updateWizardData }: SwimmingEquipmentStepProps) {
  const selectedEquipment = wizardData.swimmingEquipment || [];

  const handleToggle = (equipmentId: string) => {
    const newEquipment = selectedEquipment.includes(equipmentId)
      ? selectedEquipment.filter(id => id !== equipmentId)
      : [...selectedEquipment, equipmentId];
    
    updateWizardData({ swimmingEquipment: newEquipment });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Quais equipamentos você tem disponíveis para treino?
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Selecione todos que se aplicam (opcional)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {EQUIPMENT_OPTIONS.map((equipment) => {
          const isSelected = selectedEquipment.includes(equipment.id);
          
          return (
            <Card 
              key={equipment.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => handleToggle(equipment.id)}
            >
              <CardContent className="p-4 flex items-start space-x-3">
                <Checkbox
                  id={equipment.id}
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(equipment.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor={equipment.id} className="cursor-pointer">
                    <div className="font-medium">{equipment.label}</div>
                    <p className="text-xs text-muted-foreground">{equipment.description}</p>
                  </Label>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <strong>Não tem equipamentos?</strong> Não se preocupe! Os treinos serão adaptados. 
        Equipamentos são opcionais e ajudam a variar os estímulos, mas você pode ter excelentes 
        resultados apenas com a natação livre.
      </div>
    </div>
  );
}
