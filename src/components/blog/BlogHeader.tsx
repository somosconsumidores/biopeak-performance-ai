import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlogHeaderProps {
  showBack?: boolean;
}

export function BlogHeader({ showBack = false }: BlogHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <Button variant="ghost" size="icon" asChild>
              <Link to="/blog">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <Link to="/blog" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">BP</span>
            </div>
            <span className="font-bold text-xl text-foreground">
              BioPeak <span className="text-primary">Blog</span>
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              BioPeak App
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
