import React from 'react';
import { Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface PremiumBlurProps {
  children: React.ReactNode;
  message?: string;
}

export const PremiumBlur = ({ children, message = "Recurso exclusivo para assinantes" }: PremiumBlurProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative">
      <div className="filter blur-md pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-center p-6 max-w-xs">
          <Crown className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Premium</h3>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          <Button 
            size="sm" 
            onClick={() => navigate('/paywall')}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Crown className="h-4 w-4 mr-2" />
            Assinar Agora
          </Button>
        </div>
      </div>
    </div>
  );
};