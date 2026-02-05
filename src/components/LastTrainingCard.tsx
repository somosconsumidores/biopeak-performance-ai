import { useState } from 'react';
import { useLastTrainingAnalysis } from '@/hooks/useLastTrainingAnalysis';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, ChevronDown, ChevronUp, Clock, Lock, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const MAX_PREVIEW_LENGTH = 350;

export const LastTrainingCard = () => {
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  const { analysis, loading, error } = useLastTrainingAnalysis(isSubscribed);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);

  // Non-subscribers: show upgrade prompt
  if (!subscriptionLoading && isSubscribed === false) {
    return (
      <Card className="glass-card border-glass-border overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5" />
        <CardContent className="p-4 sm:p-6 relative">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <Lock className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">Seu Último Treino</h3>
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">
                  Pro
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Análise de desacoplamento aeróbico disponível no plano Pro
              </p>
            </div>
            <Link to="/paywall2">
              <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90">
                Upgrade
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading || subscriptionLoading) {
    return (
      <Card className="glass-card border-glass-border overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error or no analysis: silent fail
  if (error || !analysis) {
    return null;
  }

  const needsTruncation = analysis.analysis.length > MAX_PREVIEW_LENGTH;
  const displayText = needsTruncation && !isExpanded
    ? analysis.analysis.slice(0, MAX_PREVIEW_LENGTH) + '...'
    : analysis.analysis;

  const timeAgo = formatDistanceToNow(new Date(analysis.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <>
      <Card className="glass-card border-glass-border overflow-hidden relative group">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5 opacity-60" />
        
        {/* Animated glow on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardContent className="p-4 sm:p-6 relative">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Icon */}
            <div className="relative flex-shrink-0">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              {/* Status indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-col gap-1.5 mb-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">Seu Último Treino</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Clock className="h-3 w-3" />
                    <span className="hidden sm:inline">{timeAgo}</span>
                    <span className="sm:hidden">{timeAgo.replace('há ', '').replace(' atrás', '')}</span>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-500 w-fit"
                >
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  Feedback de seu Coach IA
                </Badge>
              </div>

              {/* Analysis Body */}
              <div className="text-sm text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                <ReactMarkdown>{displayText}</ReactMarkdown>
              </div>

              {/* Expand/Collapse */}
              {needsTruncation && (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-7 px-2 text-xs text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Ver menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Ver mais
                      </>
                    )}
                  </Button>
                  
                  {analysis.analysis.length > 600 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFullDialog(true)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Abrir completo
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full Analysis Dialog */}
      <Dialog open={showFullDialog} onOpenChange={setShowFullDialog}>
        <DialogContent className="static-dialog max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span>Análise do Último Treino</span>
              <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500 ml-auto">
                {timeAgo}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 text-sm text-foreground/90 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{analysis.analysis}</ReactMarkdown>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
