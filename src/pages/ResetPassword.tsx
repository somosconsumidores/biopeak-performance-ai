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
    // Check if we have the necessary tokens in the URL
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    if (!accessToken || !refreshToken) {
      navigate('/auth');
    }
  }, [searchParams, navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ 
      password: password 
    });

    if (error) {
      setError(error.message);
    } else {
      toast({
        title: 'Senha atualizada!',
        description: 'Sua senha foi alterada com sucesso.',
      });
      navigate('/dashboard');
    }

    setIsLoading(false);
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