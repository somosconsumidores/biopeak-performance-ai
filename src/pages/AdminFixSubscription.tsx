import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function AdminFixSubscription() {
  const [userId, setUserId] = useState('e7b095f6-062f-4cbc-ab28-24f82d5e4fa6');
  const [email, setEmail] = useState('rafanscardoso@gmail.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const fixSubscription = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('🔧 Calling admin-fix-subscription...');
      
      const { data, error } = await supabase.functions.invoke('admin-fix-subscription', {
        body: { user_id: userId, email }
      });

      if (error) throw error;

      setResult(data);
      
      toast({
        title: "✅ Assinatura Corrigida!",
        description: `Usuário ${email} agora está marcado como assinante Premium.`,
      });
      
      console.log('✅ Subscription fixed:', data);
    } catch (error: any) {
      console.error('❌ Error fixing subscription:', error);
      toast({
        title: "Erro ao corrigir assinatura",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔧 Admin - Corrigir Assinatura Stripe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">User ID</label>
            <Input 
              value={userId} 
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID do usuário"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email do usuário no Stripe"
            />
          </div>

          <Button 
            onClick={fixSubscription} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Processando...' : '🔧 Corrigir Assinatura'}
          </Button>

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">✅ Sucesso!</h3>
              <pre className="text-xs bg-white p-2 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-yellow-900">⚠️ Análise do Problema</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-yellow-900">
          <p><strong>Causa Raiz:</strong> A função <code>check-subscription</code> não foi executada após o pagamento.</p>
          <p><strong>Stripe Status:</strong> Assinatura ATIVA (confirmado)</p>
          <p><strong>Database Status:</strong> subscribed = false (INCORRETO)</p>
          <p><strong>Solução Permanente Necessária:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Configurar webhook do Stripe corretamente</li>
            <li>Garantir que check-subscription seja chamada após pagamento</li>
            <li>Adicionar monitoramento para detectar falhas de sincronização</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
