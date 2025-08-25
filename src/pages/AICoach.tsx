import { Header } from '@/components/Header';
import { ParticleBackground } from '@/components/ParticleBackground';
import { ScrollReveal } from '@/components/ScrollReveal';
import WeeklyAIPlanCard from '@/components/WeeklyAIPlanCard';
import { Brain, Sparkles } from 'lucide-react';

export const AICoach = () => {
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

          {/* Weekly AI Plan Card */}
          <ScrollReveal delay={100}>
            <WeeklyAIPlanCard />
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
};