import { useState, useEffect } from 'react';
import { Brain, Zap, Target, Activity, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// AI Coach screenshots
import aiCoachDashboard from '@/assets/ai-coach-dashboard.png';
import aiCoachPlan from '@/assets/ai-coach-plan.png';
import aiCoachCalendar from '@/assets/ai-coach-calendar.png';

const features = [
  {
    id: 'dashboard',
    icon: Zap,
    label: 'Dashboard',
    title: 'Treino de Hoje',
    description: 'Seu treino do dia esperando por você. Planejamento inteligente que se adapta à sua rotina.',
    image: aiCoachDashboard,
    color: 'from-orange-500 to-amber-500',
  },
  {
    id: 'plan',
    icon: Target,
    label: 'Plano IA',
    title: 'Personalizado por IA',
    description: 'Dezenas de treinos criados especificamente para você com base no seu nível e objetivos.',
    image: aiCoachPlan,
    color: 'from-primary to-accent',
  },
  {
    id: 'nutrition',
    icon: Activity,
    label: 'Nutrição',
    title: 'Plano Nutricional',
    description: 'Alimentação sincronizada com seu plano de treino para máxima performance.',
    image: 'https://grcwlmltlcltmwbhdpky.supabase.co/storage/v1/object/public/Geral/PlanoNutricional.png',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'calendar',
    icon: TrendingUp,
    label: 'Calendário',
    title: 'Visualize Sua Jornada',
    description: 'Calendário inteligente com tipos de treino coloridos para acompanhar seu progresso.',
    image: aiCoachCalendar,
    color: 'from-violet-500 to-purple-500',
  },
];

export function TrainWithoutWatchesSection() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-rotate features
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const handleFeatureClick = (index: number) => {
    setActiveFeature(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds of inactivity
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const currentFeature = features[activeFeature];

  return (
    <section className="py-20 lg:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="container mx-auto relative">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Seu Personal Coach Inteligente</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Treine{' '}
            <span className="relative">
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                Sem Relógios Caros
              </span>
              <Sparkles className="absolute -top-2 -right-6 w-5 h-5 text-primary animate-pulse" />
            </span>
          </h2>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            O BioPeak AI Coach cria planos adaptativos personalizados, controla seus treinos e te guia em cada passo da sua evolução.
          </p>
        </motion.div>

        {/* Main Content - Split Layout */}
        <div className="grid lg:grid-cols-[1fr,1.2fr] gap-8 lg:gap-16 items-center max-w-7xl mx-auto">
          
          {/* Left Side - Feature Pills & Content */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8 order-2 lg:order-1"
          >
            {/* Feature Pills */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              {features.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => handleFeatureClick(index)}
                  className={cn(
                    "group relative flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300",
                    "border text-sm font-medium",
                    activeFeature === index
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 scale-105"
                      : "bg-background/50 hover:bg-primary/10 border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <feature.icon className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    activeFeature === index && "animate-pulse"
                  )} />
                  <span>{feature.label}</span>
                  
                  {/* Active indicator */}
                  {activeFeature === index && (
                    <motion.div
                      layoutId="activeFeature"
                      className="absolute inset-0 rounded-full bg-primary -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Active Feature Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className={cn(
                  "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                  "bg-gradient-to-r text-white",
                  currentFeature.color
                )}>
                  <currentFeature.icon className="w-3.5 h-3.5" />
                  {currentFeature.label}
                </div>
                
                <h3 className="text-3xl sm:text-4xl font-bold text-foreground">
                  {currentFeature.title}
                </h3>
                
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {currentFeature.description}
                </p>

                {/* Benefits List */}
                <ul className="space-y-3">
                  {[
                    'Adaptação inteligente ao seu nível',
                    'Feedback em tempo real',
                    'Evolução contínua e mensurável'
                  ].map((benefit, i) => (
                    <motion.li 
                      key={benefit}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 text-muted-foreground"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {benefit}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              <Button 
                size="lg" 
                className="group bg-gradient-to-r from-primary to-accent hover:opacity-90 text-lg px-8 py-6 shadow-lg shadow-primary/25"
                asChild
              >
                <Link to="/auth">
                  Começar Agora
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Right Side - Phone Stack */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative order-1 lg:order-2 flex justify-center"
          >
            {/* Glow Effect */}
            <div className={cn(
              "absolute inset-0 opacity-30 blur-3xl rounded-full transition-all duration-700",
              "bg-gradient-to-br",
              currentFeature.color
            )} />
            
            {/* Phone Stack Container */}
            <div className="relative w-full max-w-sm sm:max-w-md perspective-1000">
              {/* Background phones (stacked effect) */}
              <div className="absolute top-4 left-4 right-4 bottom-0 opacity-20 blur-sm">
                <img 
                  src={features[(activeFeature + 1) % features.length].image}
                  alt=""
                  className="w-full h-auto rounded-3xl"
                />
              </div>
              <div className="absolute top-2 left-2 right-2 bottom-0 opacity-40 blur-[2px]">
                <img 
                  src={features[(activeFeature + 2) % features.length].image}
                  alt=""
                  className="w-full h-auto rounded-3xl"
                />
              </div>
              
              {/* Main Phone */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, scale: 0.95, rotateY: -10 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.95, rotateY: 10 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="relative z-10"
                >
                  <div className="relative">
                    {/* Phone Bezel Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-b from-white/20 to-transparent rounded-[2rem] pointer-events-none" />
                    
                    <img 
                      src={currentFeature.image}
                      alt={`BioPeak ${currentFeature.label}`}
                      className="relative w-full h-auto rounded-3xl shadow-2xl shadow-black/30"
                    />
                    
                    {/* Reflection overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent rounded-3xl pointer-events-none" />
                  </div>
                </motion.div>
              </AnimatePresence>
              
              {/* Progress Dots */}
              <div className="flex justify-center gap-2 mt-6">
                {features.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleFeatureClick(index)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      activeFeature === index 
                        ? "w-8 bg-primary" 
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
