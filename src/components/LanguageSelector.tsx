import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Language = 'pt' | 'en';

interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
];

export const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');

  useEffect(() => {
    // Check if language is already saved in localStorage
    const savedLanguage = localStorage.getItem('biopeak-language') as Language;
    if (savedLanguage) {
      setSelectedLanguage(savedLanguage);
      return;
    }

    // Auto-detect country and set default language
    const detectCountryAndSetLanguage = async () => {
      try {
        // Try to get user's country from browser API
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const countryCode = data.country_code?.toLowerCase();
        
        // Set Portuguese for Brazil (br) and Portugal (pt)
        if (countryCode === 'br' || countryCode === 'pt') {
          setSelectedLanguage('pt');
          localStorage.setItem('biopeak-language', 'pt');
        } else {
          // Default to English for other countries
          setSelectedLanguage('en');
          localStorage.setItem('biopeak-language', 'en');
        }
      } catch (error) {
        // Fallback: try to detect from browser language
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('pt')) {
          setSelectedLanguage('pt');
          localStorage.setItem('biopeak-language', 'pt');
        } else {
          setSelectedLanguage('en');
          localStorage.setItem('biopeak-language', 'en');
        }
      }
    };

    detectCountryAndSetLanguage();
  }, []);

  const handleLanguageChange = (language: Language) => {
    setSelectedLanguage(language);
    localStorage.setItem('biopeak-language', language);
    // Trigger re-render of components that use useTranslation
    window.dispatchEvent(new Event('languageChanged'));
    // Reload page to apply language changes throughout the app
    window.location.reload();
  };

  const currentLanguage = languages.find(lang => lang.code === selectedLanguage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-foreground/80 hover:text-primary">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLanguage?.flag}</span>
          <span className="hidden md:inline">{currentLanguage?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-sm border-glass-border">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer hover:bg-muted/50 ${
              selectedLanguage === language.code ? 'bg-muted text-primary' : ''
            }`}
          >
            <span className="mr-2">{language.flag}</span>
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};