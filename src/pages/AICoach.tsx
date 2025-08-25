import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import WeeklyAIPlanCard from '@/components/WeeklyAIPlanCard';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Sparkles, Lock, Construction } from 'lucide-react';

export const AICoach = () => {
  const { user, loading } = useAuth();

  // Check if user is admin@biopeak.com
  const isAdminUser = user?.email === 'admin@biopeak.com';

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-32 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <ScrollReveal>
            <div className="mb-6 md:mb-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                Coach <span className="bg-gradient-primary bg-clip-text text-transparent">IA Premium</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Seu assistente inteligente personalizado para treinos e análises avançadas
              </p>
            </div>
          </ScrollReveal>

          {/* Content - Show based on access */}
          {isAdminUser ? (
            <ScrollReveal delay={100}>
              <WeeklyAIPlanCard />
            </ScrollReveal>
          ) : (
            <ScrollReveal delay={100}>
              <Card className="glass-card border-glass-border">
                <CardContent className="py-12">
                  <div className="text-center space-y-6">
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <div className="p-4 rounded-full bg-primary/10">
                        <Construction className="h-12 w-12 text-primary" />
                      </div>
                      <Lock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    
                    <div className="space-y-3">
                      <h2 className="text-2xl font-bold">Feature em desenvolvimento</h2>
                      <p className="text-lg text-muted-foreground max-w-md mx-auto">
                        Aguarde novidades!
                      </p>
                    </div>
                    
                    <div className="pt-4">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm text-primary font-medium">
                          Funcionalidade exclusiva em breve
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}
        </div>
      </div>
    </div>
  );
};