import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TrainingPlanWizardData } from '@/hooks/useTrainingPlanWizard';
import { Bike, Mountain, Monitor, Shuffle } from 'lucide-react';

const EQUIPMENT_OPTIONS = [
  { 
    id: 'road', 
    label: 'Speed / Road Bike', 
    description: 'Bike de estrada para asfalto',
    icon: Bike 
  },
  { 
    id: 'mtb', 
    label: 'Mountain Bike', 
    description: 'MTB para trilhas e off-road',
    icon: Mountain 
  },
  { 
    id: 'trainer', 
    label: 'Rolo / Zwift / Indoor', 
    description: 'Treinos indoor com simuladores',
    icon: Monitor 
  },
  { 
    id: 'mixed', 
    label: 'Misto (Indoor + Outdoor)', 
    description: 'Combinação de indoor e outdoor',
    icon: Shuffle 
  }
];

interface EquipmentTypeStepProps {
  wizardData: TrainingPlanWizardData;
  updateWizardData: (updates: Partial<TrainingPlanWizardData>) => void;
}

export function EquipmentTypeStep({ wizardData, updateWizardData }: EquipmentTypeStepProps) {
  return (
    <div className="space-y-6">
      <RadioGroup
        value={wizardData.equipmentType}
        onValueChange={(value) => updateWizardData({ 
          equipmentType: value as 'road' | 'mtb' | 'trainer' | 'mixed' 
        })}
        className="space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {EQUIPMENT_OPTIONS.map((equipment) => {
            const Icon = equipment.icon;
            return (
              <Card
                key={equipment.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  wizardData.equipmentType === equipment.id
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => updateWizardData({ 
                  equipmentType: equipment.id as 'road' | 'mtb' | 'trainer' | 'mixed' 
                })}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <RadioGroupItem value={equipment.id} id={equipment.id} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={equipment.id} className="flex items-center space-x-3 cursor-pointer">
                        <Icon className="h-6 w-6 text-primary" />
                        <div>
                          <div className="font-semibold">{equipment.label}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {equipment.description}
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </RadioGroup>
    </div>
  );
}