import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEvolutionAnalysis } from '@/hooks/useEvolutionAnalysis';
import ReactMarkdown from 'react-markdown';

interface CoachAnalysisCardProps {
  hasData: boolean;
}

export function CoachAnalysisCard({ hasData }: CoachAnalysisCardProps) {
  const {
    analysis,
    generatedAt,
    loading,
    error,
    generateAnalysis,
    hasCachedAnalysis,
    loadCachedAnalysis,
  } = useEvolutionAnalysis();

  // Load cached analysis on mount
  useEffect(() => {
    loadCachedAnalysis();
  }, [loadCachedAnalysis]);

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  if (!hasData) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Análise do Coach
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Quando você tiver dados de evolução disponíveis, poderá gerar uma análise
            personalizada com inteligência artificial.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Análise do Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
            Analisando sua evolução com IA...
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-gradient-to-br from-card to-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-destructive" />
            Análise do Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateAnalysis(true)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Análise do Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use inteligência artificial para obter uma análise detalhada e personalizada
            da sua evolução nas últimas 8 semanas.
          </p>
          <Button
            onClick={() => generateAnalysis(false)}
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Sparkles className="h-4 w-4" />
            Gerar Análise com IA
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              Análise do Coach
            </CardTitle>
            <div className="flex items-center gap-2">
              {formattedDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formattedDate}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateAnalysis(true)}
                className="gap-1 h-7 px-2"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden sm:inline text-xs">Regenerar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
