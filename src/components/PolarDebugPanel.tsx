import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle, Settings, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function PolarDebugPanel() {
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { toast } = useToast();

  const runConnectivityTest = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('polar-test-oauth', {
        body: { action: 'test_polar_endpoints' }
      });

      if (error) throw error;

      setTestResults({
        type: 'connectivity',
        data,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Teste completado",
        description: data.overall_status === 'HEALTHY' ? 
          "Todos os endpoints da Polar estão acessíveis" : 
          "Problemas detectados na conectividade",
        variant: data.overall_status === 'HEALTHY' ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Connectivity test failed:', error);
      toast({
        title: "Teste falhou",
        description: "Erro ao testar conectividade com Polar",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testCallbackUrl = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('polar-test-oauth', {
        body: { action: 'test_callback_url' }
      });

      if (error) throw error;

      setTestResults({
        type: 'callback',
        data,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "URL de callback testada",
        description: "Callback URL está acessível",
      });
    } catch (error) {
      console.error('Callback test failed:', error);
      toast({
        title: "Teste falhou",
        description: "Erro ao testar URL de callback",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testManualTokenExchange = async () => {
    if (!manualCode.trim()) {
      toast({
        title: "Código necessário",
        description: "Digite um código de autorização para testar",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('polar-test-oauth', {
        body: { 
          action: 'manual_token_exchange',
          code: manualCode.trim(),
          redirect_uri: `${window.location.origin}/polar-callback`
        }
      });

      if (error) throw error;

      setTestResults({
        type: 'manual_token',
        data,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Troca manual de token",
        description: data.success ? "Token trocado com sucesso" : "Falha na troca de token",
        variant: data.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Manual token exchange failed:', error);
      toast({
        title: "Teste falhou",
        description: "Erro na troca manual de token",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Painel de Diagnóstico Polar
          </CardTitle>
          <CardDescription>
            Ferramentas para diagnosticar problemas na integração Polar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={runConnectivityTest} 
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Testar Conectividade
            </Button>
            <Button 
              onClick={testCallbackUrl} 
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Testar Callback URL
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="manual-code">Teste Manual de Token</Label>
            <Input 
              id="manual-code"
              placeholder="Cole aqui um código de autorização Polar para teste"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <Button 
              onClick={testManualTokenExchange} 
              disabled={isLoading || !manualCode.trim()}
              variant="outline"
              className="w-full"
            >
              Testar Troca de Token
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResults.data?.success !== false ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              Resultados do Teste
            </CardTitle>
            <CardDescription>
              Executado em {new Date(testResults.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={JSON.stringify(testResults.data, null, 2)}
              readOnly
              className="min-h-[300px] font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}