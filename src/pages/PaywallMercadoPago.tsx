import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function PaywallMercadoPago() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  const handleCheckout = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-mercadopago-checkout', {
        body: { planType: selectedPlan }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url; // Redireciona para checkout do MP
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erro no checkout",
        description: "Não foi possível processar o pagamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate('/')}
        className="absolute top-4 right-4"
      >
        <X className="h-5 w-5" />
      </Button>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-gradient-to-r from-primary to-primary/80 w-fit">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Plano Premium</CardTitle>
          <CardDescription>Pague com Mercado Pago</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedPlan === 'monthly' 
                ? 'border-primary bg-primary/5 shadow-sm' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <h3 className="font-semibold">Mensal</h3>
            <p className="text-2xl font-bold">R$ 12,90</p>
            <p className="text-sm text-muted-foreground">por mês</p>
          </div>

          <div
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedPlan === 'annual' 
                ? 'border-primary bg-primary/5 shadow-sm' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedPlan('annual')}
          >
            <h3 className="font-semibold">Anual</h3>
            <p className="text-2xl font-bold">R$ 154,80</p>
            <p className="text-sm text-muted-foreground">R$ 12,90/mês</p>
            <p className="text-xs text-primary font-medium mt-1">Economize 12 meses</p>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            onClick={handleCheckout}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                Pagar com Mercado Pago
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
