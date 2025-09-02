import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollReveal } from '@/components/ScrollReveal';
import { ParticleBackground } from '@/components/ParticleBackground';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Mail, Lock, User } from 'lucide-react';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('signin');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const { signUp, signIn, resetPassword, user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthRedirect = async () => {
      const selectedPlan = searchParams.get('plan');
      console.log('🔍 AUTH: Verificando parâmetros', { 
        user: !!user, 
        selectedPlan, 
        searchParams: Object.fromEntries(searchParams.entries()),
        url: window.location.href 
      });
      
      if (user) {
        console.log('🔍 AUTH: Usuário autenticado, verificando plano', { selectedPlan });
        
        if (selectedPlan && (selectedPlan === 'monthly' || selectedPlan === 'annual')) {
          console.log('🔍 AUTH: Plano detectado, marcando onboarding como completo e redirecionando');
          
          // Marcar onboarding como completo automaticamente para usuários vindos do plano
          try {
            await supabase
              .from('profiles')
              .upsert({ 
                user_id: user.id,
                onboarding_completed: true,
                updated_at: new Date().toISOString()
              }, { 
                onConflict: 'user_id' 
              });
            
            console.log('✅ Onboarding marcado como completo para usuário vindo do plano');
          } catch (error) {
            console.error('Erro ao marcar onboarding como completo:', error);
          }
          
          // Redirecionar para paywall com o plano pré-selecionado
          console.log('🔍 AUTH: Redirecionando para paywall com plano:', selectedPlan);
          navigate(`/paywall?plan=${selectedPlan}`);
          return; // Importante: sair da função para não executar o else
        }
        
        console.log('🔍 AUTH: Nenhum plano detectado, redirecionando para sync');
        // Comportamento padrão - redirecionar para sync apenas se não há plano
        navigate('/sync');
      }
    };

    handleAuthRedirect();
  }, [user, navigate, searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: t('welcomeBack'),
        description: 'Login realizado com sucesso.',
      });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await signUp(email, password, displayName);
    
    if (error) {
      setError(error.message);
    } else {
      toast({
        title: t('accountCreated'),
        description: 'Verifique seu email para confirmar a conta.',
      });
    }
    
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await resetPassword(email);
    
    if (error) {
      setError(error.message);
    } else {
      setResetEmailSent(true);
      toast({
        title: t('emailSent'),
        description: 'Verifique sua caixa de entrada para redefinir a senha.',
      });
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
              <Link to="/" className="inline-flex items-center gap-2 text-primary/80 hover:text-primary transition-colors mb-6">
                <ArrowLeft className="h-4 w-4" />
                {t('backToLogin')}
              </Link>
              <h1 className="text-3xl font-bold gradient-text mb-2">BioPeak</h1>
              <p className="text-muted-foreground">
                {t('joinThousands')}
              </p>
            </div>

            <Card className="glass-card">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">
                  {activeTab === 'reset' ? t('resetPassword') : t('signInToAccount')}
                </CardTitle>
                <CardDescription>
                  {activeTab === 'signin' 
                    ? 'Entre com suas credenciais' 
                    : activeTab === 'signup'
                    ? t('createAccount')
                    : 'Digite seu email para recuperar a senha'
                  }
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

                {resetEmailSent && activeTab === 'reset' && (
                  <Alert className="mb-4 border-green-500/50 bg-green-500/10">
                    <AlertDescription className="text-green-400">
                      Email de recuperação enviado! Verifique sua caixa de entrada.
                    </AlertDescription>
                  </Alert>
                )}

                {activeTab !== 'reset' ? (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="signin">{t('signIn')}</TabsTrigger>
                      <TabsTrigger value="signup">{t('createAccount')}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="signin">
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">{t('email')}</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="seu@email.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="password">{t('password')}</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="password"
                              type="password"
                              placeholder="Sua senha"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={isLoading}
                        >
                          {isLoading ? 'Entrando...' : t('signIn')}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full text-sm"
                          onClick={() => setActiveTab('reset')}
                        >
                          {t('forgotPassword')}
                        </Button>
                      </form>
                    </TabsContent>
                    
                    <TabsContent value="signup">
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="displayName">Nome de exibição</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="displayName"
                              type="text"
                              placeholder="Seu nome"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="email">{t('email')}</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="seu@email.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="password">{t('password')}</Label>
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
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={isLoading}
                        >
                          {isLoading ? 'Criando conta...' : t('signUp')}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="space-y-4">
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">{t('email')}</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading}
                      >
                        {isLoading ? 'Enviando...' : t('resetPassword')}
                      </Button>
                    </form>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-sm"
                      onClick={() => {
                        setActiveTab('signin');
                        setResetEmailSent(false);
                        setError('');
                      }}
                    >
                      {t('backToLogin')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}