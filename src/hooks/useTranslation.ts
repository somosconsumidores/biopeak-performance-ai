import { useEffect, useState } from 'react';

type Language = 'pt' | 'en';

interface Translations {
  [key: string]: {
    pt: string;
    en: string;
  };
}

const translations: Translations = {
  // Header navigation
  dashboard: { pt: 'Dashboard', en: 'Dashboard' },
  workouts: { pt: 'Treinos', en: 'Workouts' },
  insights: { pt: 'Insights', en: 'Insights' },
  profile: { pt: 'Perfil', en: 'Profile' },
  syncActivities: { pt: 'Sincronizar Atividades', en: 'Sync Activities' },
  logout: { pt: 'Sair', en: 'Logout' },
  login: { pt: 'Login', en: 'Login' },
  getStarted: { pt: 'Começar Agora', en: 'Get Started' },
};

export const useTranslation = () => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('biopeak-language') as Language;
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return { t, language, setLanguage };
};