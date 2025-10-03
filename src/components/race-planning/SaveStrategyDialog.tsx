import { useState } from "react";
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
}

export function SaveStrategyDialog({
  open,
  onOpenChange,
  onSave,
  isLoading,
}: SaveStrategyDialogProps) {
  const [strategyName, setStrategyName] = useState("");

  const handleSave = async () => {
    if (!strategyName.trim()) return;
    await onSave(strategyName.trim());
    setStrategyName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Estratégia</DialogTitle>
          <DialogDescription>
            Dê um nome para sua estratégia de corrida. Você poderá acessá-la depois na área de perfil.
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
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
