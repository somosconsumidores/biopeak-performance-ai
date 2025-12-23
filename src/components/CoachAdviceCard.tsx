import { useState } from 'react';
import { useCoachAdvice } from '@/hooks/useCoachAdvice';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, ChevronDown, ChevronUp, Clock, Sparkles, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const MAX_PREVIEW_LENGTH = 280;

export const CoachAdviceCard = () => {
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  const { advice, loading, error } = useCoachAdvice(isSubscribed);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullDialog, setShowFullDialog] = useState(false);

  // Show upgrade prompt immediately for non-subscribers (don't wait for data loading)
  if (!subscriptionLoading && isSubscribed === false) {
    return (
      <Card className="glass-card border-glass-border overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <CardContent className="p-4 sm:p-6 relative">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">Coach IA</h3>
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  Pro
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Análises personalizadas do Coach IA disponíveis no plano Pro
              </p>
            </div>
            <Link to="/paywall2">
              <Button size="sm" className="bg-gradient-to-r from-primary to-primary/80">
                Upgrade
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state - only for subscribers checking their data
  if (loading || subscriptionLoading) {
    return (
      <Card className="glass-card border-glass-border overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return null; // Silent fail - don't show error card
  }

  // No advice available
  if (!advice || !advice.advice) {
    return null; // Don't render anything if no advice
  }

  const needsTruncation = advice.advice.length > MAX_PREVIEW_LENGTH;
  const displayText = needsTruncation && !isExpanded
    ? advice.advice.slice(0, MAX_PREVIEW_LENGTH) + '...'
    : advice.advice;

  const timeAgo = formatDistanceToNow(new Date(advice.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  // Split text into paragraphs for better readability
  const paragraphs = displayText.split('\n\n').filter(p => p.trim());

  return (
    <>
      <Card className="glass-card border-glass-border overflow-hidden relative group">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50" />
        
        {/* Animated glow on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardContent className="p-4 sm:p-6 relative">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Coach Avatar */}
            <div className="relative flex-shrink-0">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Coach IA</h3>
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-1.5 py-0 border-primary/30 text-primary hidden sm:inline-flex"
                  >
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    Análise
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">{timeAgo}</span>
                  <span className="sm:hidden">{timeAgo.replace('há ', '').replace(' atrás', '')}</span>
                </div>
              </div>

              {/* Message Body */}
              <div className="text-sm text-foreground/90 leading-relaxed space-y-2">
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-readable">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Expand/Collapse or View More */}
              {needsTruncation && (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
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
                  
                  {advice.advice.length > 500 && (
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

      {/* Full Message Dialog */}
      <Dialog open={showFullDialog} onOpenChange={setShowFullDialog}>
        <DialogContent className="static-dialog max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
              <span>Análise do Coach IA</span>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary ml-auto">
                {timeAgo}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 text-sm text-foreground/90 leading-relaxed space-y-4">
            {advice.advice.split('\n\n').filter(p => p.trim()).map((paragraph, index) => (
              <p key={index} className="text-readable">
                {paragraph}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
