import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import bioPeakLogo from '@/assets/biopeak-logo.png';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Treinos', href: '/workouts' },
    { name: 'Insights', href: '/insights' },
    { name: 'Perfil', href: '/profile' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card border-0 border-b border-glass-border">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 sm:space-x-3">
            <img src={bioPeakLogo} alt="BioPeak" className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BioPeak
            </span>
          </Link>

          {/* Desktop Navigation */}
          {user ? (
            <>
              <nav className="hidden md:flex items-center space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="text-foreground/80 hover:text-primary transition-colors duration-200 font-medium"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
                <Button variant="outline" className="glass-card border-glass-border text-sm" asChild>
                  <Link to="/sync">Sincronizar Atividades</Link>
                </Button>
                <Button onClick={handleSignOut} variant="outline" className="glass-card border-glass-border text-sm">
                  Sair
                </Button>
              </div>
            </>
          ) : (
            <div className="hidden md:flex items-center space-x-4">
              <Button variant="outline" className="glass-card border-glass-border" asChild>
                <Link to="/auth">Login</Link>
              </Button>
              <Button className="btn-primary" asChild>
                <Link to="/auth">Começar Agora</Link>
              </Button>
            </div>
          )}

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-foreground"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 glass-card mt-2 border-glass-border">
              {user ? (
                <>
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="block px-3 py-3 text-sm font-medium text-foreground/80 hover:text-primary transition-colors duration-200 touch-manipulation"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <Link
                    to="/sync"
                    className="block px-3 py-3 text-sm font-medium text-foreground/80 hover:text-primary transition-colors duration-200 touch-manipulation"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sincronizar Atividades
                  </Link>
                  <div className="pt-4 pb-2">
                    <Button 
                      onClick={handleSignOut} 
                      variant="outline" 
                      className="w-full glass-card border-glass-border h-12 text-sm touch-manipulation"
                    >
                      Sair
                    </Button>
                  </div>
                </>
              ) : (
                <div className="pt-4 pb-2 space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full glass-card border-glass-border h-12 text-sm touch-manipulation" 
                    asChild
                  >
                    <Link to="/auth">Login</Link>
                  </Button>
                  <Button className="w-full btn-primary h-12 text-sm touch-manipulation" asChild>
                    <Link to="/auth">Começar Agora</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};