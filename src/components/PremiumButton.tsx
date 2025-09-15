import React from 'react';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { usePlatform } from '@/hooks/usePlatform';

interface PremiumButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const PremiumButton = ({ 
  children, 
  onClick, 
  disabled, 
  className,
  variant = "default",
  size = "default"
}: PremiumButtonProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isIOS, isNative } = usePlatform();

  const handleClick = () => {
    const message = isIOS && isNative 
      ? "Este recurso é exclusivo para assinantes do plano premium. Assine através da App Store."
      : "Este recurso é exclusivo para assinantes do plano premium.";
    
    toast({
      title: "Recurso Premium",
      description: message,
      duration: 3000,
    });
    navigate('/paywall');
  };

  return (
    <Button 
      onClick={handleClick}
      disabled={disabled}
      className={className}
      variant={variant}
      size={size}
    >
      <Crown className="h-4 w-4 mr-2" />
      {children}
    </Button>
  );
};