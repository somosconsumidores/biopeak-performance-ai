import React from 'react';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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

  const handleClick = () => {
    toast({
      title: "Recurso Premium",
      description: "Este recurso é exclusivo para assinantes do plano premium.",
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