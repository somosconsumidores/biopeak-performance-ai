import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollReveal } from '@/components/ScrollReveal';
import { ParticleBackground } from '@/components/ParticleBackground';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lock } from 'lucide-react';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Escuta mudanças de auth (inclui PASSWORD_RECOVERY quando o link funciona)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] Auth event:', event, session?.user?.id);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[ResetPassword] PASSWORD_RECOVERY detectado, usuário pode redefinir a senha');
        setError('');
      }

      if (event === 'SIGNED_OUT') {
        console.log('[ResetPassword] Usuário saiu, redirecionando para /auth');
        navigate('/auth');
      }
    });

    const handleInitialSession = async () => {
      try {
        const code = searchParams.get('code');
        const type = searchParams.get('type');

        // Fluxo novo do Supabase: ?code=...&type=recovery
        if (code && type === 'recovery') {
          console.log('[ResetPassword] Code de recuperação encontrado na URL, trocando por sessão...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[ResetPassword] Erro ao trocar code por sessão:', error);
            setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
            return;
          }
          console.log('[ResetPassword] Sessão criada via code para usuário', data.session?.user?.id);
          return;
        }

        // Fluxo antigo: tokens no hash / sessão já existente
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[ResetPassword] Erro ao obter sessão:', error);
          setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
          return;
        }

        if (!session) {
          console.log('[ResetPassword] Nenhuma sessão encontrada, redirecionando para /auth');
          navigate('/auth');
          return;
        }

        console.log('[ResetPassword] Sessão encontrada, usuário pode redefinir a senha');
      } catch (err) {
        console.error('[ResetPassword] Erro inesperado ao validar sessão de recuperação:', err);
        setError('Ocorreu um erro ao validar o link de recuperação. Tente solicitar um novo link.');
      }
    };

    handleInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    console.log('[ResetPassword] Submit clicked');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      // Garante que ainda existe uma sessão válida do link de recuperação
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[ResetPassword] Erro ao obter sessão antes de atualizar senha:', sessionError);
        setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
        setIsLoading(false);
        return;
      }

      if (!session) {
        console.error('[ResetPassword] Nenhuma sessão ativa ao tentar atualizar a senha');
        setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.updateUser({ 
        password: password 
      });

      if (error) {
        console.error('[ResetPassword] Erro ao atualizar senha:', error);
        setError(error.message || 'Não foi possível atualizar a senha. Tente novamente.');
      } else {
        console.log('[ResetPassword] Senha atualizada com sucesso para usuário', data?.user?.id);
        toast({
          title: 'Senha atualizada!',
          description: 'Sua senha foi alterada com sucesso.',
        });
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('[ResetPassword] Erro inesperado ao atualizar senha:', err);
      setError('Ocorreu um erro inesperado ao atualizar a senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <ScrollReveal>
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold gradient-text mb-2">BioPeak</h1>
              <p className="text-muted-foreground">
                Redefinir sua senha
              </p>
            </div>

            <Card className="glass-card">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Nova Senha</CardTitle>
                <CardDescription>
                  Digite sua nova senha
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {error && (
                  <Alert className="mb-4 border-red-500/50 bg-red-500/10">
                    <AlertDescription className="text-red-400">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Digite a senha novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? 'Atualizando...' : 'Atualizar Senha'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}