import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface SaveStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
  isLoading: boolean;
  isUpdate?: boolean;
  currentName?: string;
}

export function SaveStrategyDialog({
  open,
  onOpenChange,
  onSave,
  isLoading,
  isUpdate = false,
  currentName = "",
}: SaveStrategyDialogProps) {
  const [strategyName, setStrategyName] = useState(currentName);

  // Update strategy name when currentName changes
  useEffect(() => {
    setStrategyName(currentName);
  }, [currentName]);

  const handleSave = async () => {
    if (!strategyName.trim()) return;
    await onSave(strategyName.trim());
    setStrategyName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isUpdate ? 'Atualizar Estratégia' : 'Salvar Estratégia'}</DialogTitle>
          <DialogDescription>
            {isUpdate 
              ? 'Atualize o nome da sua estratégia de corrida.'
              : 'Dê um nome para sua estratégia de corrida. Você poderá acessá-la depois na área de perfil.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="strategy-name">Nome da Estratégia</Label>
            <Input
              id="strategy-name"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="Ex: Maratona 2024 - Sub 4h"
              maxLength={100}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!strategyName.trim() || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUpdate ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
