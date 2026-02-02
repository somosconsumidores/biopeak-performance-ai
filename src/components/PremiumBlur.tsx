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
      </div>
    </div>
  );
};