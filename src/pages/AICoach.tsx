import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import { AICoachChat } from '@/components/AICoachChat';
import { useAuth } from '@/hooks/useAuth';
import { usePlatform } from '@/hooks/usePlatform';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Brain, Lock, Crown, CheckCircle, ArrowLeft, MessageCircle } from 'lucide-react';

export const AICoach = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isNative } = usePlatform();
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();

  const isLoading = authLoading || subscriptionLoading;

  if (isLoading) {
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

  // Show paywall for non-subscribers
  if (!isSubscribed) {
    return <AICoachPaywall onSubscribe={() => navigate('/paywall2')} />;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="safe-pt-20 sm:safe-pt-24 pb-8 sm:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <ScrollReveal>
            <div className="mb-6 md:mb-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                Converse com seu <span className="bg-gradient-primary bg-clip-text text-transparent">Coach IA</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Tire dúvidas sobre seus treinos, pergunte sobre sua evolução, peça para criar plano de treinos, reagendar, cancelar. Este é um espaço aberto para você saber tudo sobre sua evolução. O seu Coach IA não dorme e está sempre a sua disposição!
              </p>
            </div>
          </ScrollReveal>

          {/* Chat Component */}
          <ScrollReveal delay={100}>
            <AICoachChat />
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};

function AICoachPaywall({ onSubscribe }: { onSubscribe: () => void }) {
  const navigate = useNavigate();

  const benefits = [
    "Conversas ilimitadas com o Coach IA",
    "Tire dúvidas sobre treinos e nutrição",
    "Crie e gerencie seu plano de treinos via chat",
    "Análises personalizadas da sua evolução",
    "Suporte 24/7 para suas questões de performance"
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Chat com Coach IA
            </h1>
          </div>
        </div>
      </div>

      {/* Paywall Content */}
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        {/* Icon with lock */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-24 h-24 mx-auto mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Brain className="h-12 w-12 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
            <Lock className="h-4 w-4 text-white" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h2 className="text-2xl font-bold mb-2">
            Coach IA Exclusivo para Assinantes
          </h2>
          
          <p className="text-muted-foreground mb-8">
            Converse diretamente com seu{' '}
            <span className="text-primary font-medium">Coach de Inteligência Artificial</span>{' '}
            para tirar dúvidas, criar planos e receber orientações personalizadas.
          </p>
        </motion.div>

        {/* Benefits list */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-left space-y-3 mb-8 bg-card rounded-xl p-6 border border-border"
        >
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm">{benefit}</span>
            </div>
          ))}
        </motion.div>

        {/* Impact phrase */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-sm italic text-muted-foreground mb-8"
        >
          "Seu personal trainer virtual, disponível 24 horas por dia"
        </motion.p>

        {/* Main CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Button 
            size="lg" 
            className="w-full bg-gradient-to-r from-primary to-primary/80 gap-2 shadow-lg shadow-primary/20"
            onClick={onSubscribe}
          >
            <Crown className="h-5 w-5" />
            Desbloquear Coach IA
          </Button>
          
          <p className="text-xs text-muted-foreground mt-3">
            por apenas R$ 12,90/mês
          </p>
        </motion.div>
      </div>
    </div>
  );
}
