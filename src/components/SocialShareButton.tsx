import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SocialShareButtonProps {
  icon: LucideIcon;
  label: string;
  color: string;
  onClick: () => void;
  delay?: number;
  disabled?: boolean;
}

export const SocialShareButton = ({ 
  icon: Icon, 
  label, 
  color, 
  onClick, 
  delay = 0,
  disabled = false
}: SocialShareButtonProps) => {
  return (
    <div 
      className="animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className={`
          relative overflow-hidden group h-14 w-14 rounded-2xl
          glass-card border-glass-border
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 hover:rotate-3'}
          transition-all duration-300 ease-out
          before:absolute before:inset-0 before:bg-gradient-to-br before:${color}
          before:opacity-0 before:transition-opacity before:duration-300
          ${disabled ? '' : 'hover:before:opacity-20'}
          ${disabled ? '' : 'active:scale-95'}
        `}
        title={label}
      >
        <Icon className={`h-6 w-6 z-10 ${disabled ? '' : 'group-hover:scale-110'} transition-transform duration-300`} />
        
        {/* Glow effect */}
        <div className={`
          absolute inset-0 rounded-2xl bg-gradient-to-br ${color}
          opacity-0 blur-xl ${disabled ? '' : 'group-hover:opacity-30'}
          transition-opacity duration-300 -z-10
        `} />
        
        {/* Ripple effect */}
        <div className="
          absolute inset-0 rounded-2xl
          bg-white/20 scale-0 group-active:scale-100
          transition-transform duration-200 ease-out
        " />
      </Button>
      
      {/* Label */}
      <p className={`text-xs text-center mt-2 transition-colors ${
        disabled ? 'text-muted-foreground/50' : 'text-muted-foreground group-hover:text-foreground'
      }`}>
        {label}
      </p>
    </div>
  );
};