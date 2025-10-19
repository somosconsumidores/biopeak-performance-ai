import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, Lock, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadMercadoPago } from '@mercadopago/sdk-js';

export default function CheckoutMercadoPago() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mpLoaded, setMpLoaded] = useState(false);

  const planType = searchParams.get("plan") || "monthly";
  const planPrice = planType === "monthly" ? "R$ 12,90" : "R$ 154,80";
  const planName = planType === "monthly" ? "BioPeak Pro - Mensal" : "BioPeak Pro - Anual";
  const planAmount = planType === "monthly" ? 12.90 : 154.80;

  const [formData, setFormData] = useState({
    cardNumber: "",
    cardholderName: "",
    expirationMonth: "",
    expirationYear: "",
    securityCode: "",
    identificationType: "CPF",
    identificationNumber: "",
  });

  // Inicializar SDK do Mercado Pago (novo SDK)
  useEffect(() => {
    const initializeMP = async () => {
      const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
      if (publicKey) {
        console.log("[MP] Initializing new Mercado Pago SDK...");
        await loadMercadoPago();
        const mp = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' });
        (window as any).__mp = mp;
        setMpLoaded(true);
        console.log("[MP] SDK loaded successfully");
      } else {
        console.error("[MP] Public key not configured");
      }
    };
    
    initializeMP();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted.substring(0, 19); // 16 dígitos + 3 espaços
  };

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    handleInputChange("cardNumber", formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mpLoaded) {
      toast({
        title: "Erro",
        description: "SDK do Mercado Pago não carregado. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validar campos obrigatórios
      if (!formData.cardNumber || !formData.cardholderName || 
          !formData.expirationMonth || !formData.expirationYear || 
          !formData.securityCode || !formData.identificationNumber) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      // Criar token do cartão usando o novo SDK
      console.log("[MP] Creating card token with new SDK...", {
        cardNumber: formData.cardNumber.slice(0, 6) + "..." + formData.cardNumber.slice(-4),
        cardholderName: formData.cardholderName,
        expirationMonth: formData.expirationMonth,
        expirationYear: formData.expirationYear,
        identificationType: formData.identificationType,
      });
      
      const mp = (window as any).__mp;
      if (!mp) {
        throw new Error("SDK do Mercado Pago não inicializado");
      }

      const tokenResponse = await mp.createCardToken({
        cardNumber: formData.cardNumber.replace(/\s/g, ""),
        cardholderName: formData.cardholderName,
        cardExpirationMonth: formData.expirationMonth,
        cardExpirationYear: formData.expirationYear,
        securityCode: formData.securityCode,
        identificationType: formData.identificationType,
        identificationNumber: formData.identificationNumber,
      });

      console.log("[MP] Card token response:", tokenResponse);

      if (!tokenResponse?.id) {
        console.error("[MP] Invalid token response:", tokenResponse);
        throw new Error(tokenResponse?.error?.message || "Erro ao tokenizar cartão");
      }

      console.log("[MP] Card token created successfully:", tokenResponse.id);

      // Enviar apenas o token para o backend
      const { data, error } = await supabase.functions.invoke('process-mercadopago-payment', {
        body: {
          planType,
          token: tokenResponse.id,
          payerEmail: user.email,
          identificationType: formData.identificationType,
          identificationNumber: formData.identificationNumber,
        }
      });

      if (error) throw error;

      console.log("[MP] Payment response:", data);

      if (data?.status === "approved") {
        toast({
          title: "Pagamento aprovado!",
          description: "Sua assinatura foi ativada com sucesso.",
        });
        navigate("/dashboard?mp_success=true");
      } else if (data?.status === "rejected") {
        toast({
          title: "Pagamento recusado",
          description: data?.status_detail || "Verifique os dados do cartão e tente novamente.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Pagamento pendente",
          description: "Seu pagamento está sendo processado.",
        });
        navigate("/dashboard?mp_pending=true");
      }
    } catch (error: any) {
      console.error("Erro ao processar pagamento:", error);
      toast({
        title: "Erro ao processar pagamento",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
        {/* Resumo do Pedido */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Resumo do Pedido</CardTitle>
            <CardDescription>Confirme os detalhes da sua assinatura</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary/5 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">{planName}</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {planType === "monthly" 
                  ? "Acesso completo aos recursos premium. Renovação mensal automática."
                  : "Acesso completo por 12 meses. Economia de 56% vs mensal."}
              </p>
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-muted-foreground">Total</span>
                <span className="text-2xl font-bold text-primary">{planPrice}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>Pagamento 100% seguro</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span>Processado pelo Mercado Pago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formulário de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cartão</CardTitle>
            <CardDescription>Insira os dados do seu cartão de crédito</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Número do Cartão</Label>
                <Input
                  id="cardNumber"
                  placeholder="0000 0000 0000 0000"
                  value={formData.cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  maxLength={19}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardholderName">Nome no Cartão</Label>
                <Input
                  id="cardholderName"
                  placeholder="Como aparece no cartão"
                  value={formData.cardholderName}
                  onChange={(e) => handleInputChange("cardholderName", e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expirationMonth">Mês</Label>
                  <Select
                    value={formData.expirationMonth}
                    onValueChange={(value) => handleInputChange("expirationMonth", value)}
                  >
                    <SelectTrigger id="expirationMonth">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = (i + 1).toString().padStart(2, "0");
                        return <SelectItem key={month} value={month}>{month}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expirationYear">Ano</Label>
                  <Select
                    value={formData.expirationYear}
                    onValueChange={(value) => handleInputChange("expirationYear", value)}
                  >
                    <SelectTrigger id="expirationYear">
                      <SelectValue placeholder="AA" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = (new Date().getFullYear() + i).toString().slice(-2);
                        return <SelectItem key={year} value={year}>{year}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="securityCode">CVV</Label>
                  <Input
                    id="securityCode"
                    placeholder="123"
                    value={formData.securityCode}
                    onChange={(e) => handleInputChange("securityCode", e.target.value.replace(/\D/g, ""))}
                    maxLength={4}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identificationType">Tipo de Documento</Label>
                <Select
                  value={formData.identificationType}
                  onValueChange={(value) => handleInputChange("identificationType", value)}
                >
                  <SelectTrigger id="identificationType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CPF">CPF</SelectItem>
                    <SelectItem value="CNPJ">CNPJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identificationNumber">Número do Documento</Label>
                <Input
                  id="identificationNumber"
                  placeholder={formData.identificationType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                  value={formData.identificationNumber}
                  onChange={(e) => handleInputChange("identificationNumber", e.target.value)}
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Pagar {planPrice}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/paywall-mercadopago")}
                disabled={loading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
