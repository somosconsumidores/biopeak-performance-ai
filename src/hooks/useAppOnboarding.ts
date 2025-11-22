import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';

const ONBOARDING_KEY = 'app_onboarding_completed';

export const useAppOnboarding = () => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const { value } = await Preferences.get({ key: ONBOARDING_KEY });
      setHasSeenOnboarding(value === 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasSeenOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      await Preferences.set({ key: ONBOARDING_KEY, value: 'true' });
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  return {
    hasSeenOnboarding,
    loading,
    completeOnboarding,
  };
};
