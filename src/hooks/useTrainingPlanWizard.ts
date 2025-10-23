import { useState, useEffect } from 'react';
import { useAthleteAnalysis } from './useAthleteAnalysis';
import { useProfile } from './useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export interface TrainingPlanWizardData {
  // Step 1: Goal selection
  goal: string;
  goalDescription?: string;
  
  // Step 2: Athlete level confirmation/adjustment
  athleteLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
  adjustedLevel?: boolean;
  
  // Step 3: Birth date confirmation
  birthDate?: Date;
  
  // Step 4: Gender collection
  gender?: 'male' | 'female';
  
  // Step 5: Current time confirmation
  estimatedTimes: {
    k5?: string;
    k10?: string;
    k21?: string;
    k42?: string;
  };
  adjustedTimes?: boolean;
  
  // Step 6: Weekly frequency
  weeklyFrequency: number;
  
  // Step 7: Available days
  availableDays: string[];
  
  // Step 8: Long run day preference
  longRunDay: string;
  
  // Step 9: Start date
  startDate: Date;
  
  // Step 10: Plan duration
  planDurationWeeks: number;
  
  // Step 11: Race date (optional)
  raceDate?: Date;
  hasRaceDate: boolean;
  
  // Step 12: Race goal (optional)
  raceGoal?: string;
  goalTargetTimeMinutes?: number;
  
  // Step 13: Summary and generation (no additional data)
  
  // Step 14: Health declaration (PAR-Q)
  healthDeclaration?: {
    question_1_heart_problem?: boolean;
    question_2_chest_pain_during_activity?: boolean;
    question_3_chest_pain_last_3months?: boolean;
    question_4_balance_consciousness_loss?: boolean;
    question_5_bone_joint_problem?: boolean;
    question_6_taking_medication?: boolean;
    question_7_other_impediment?: boolean;
    question_8_additional_info?: string;
    declaration_accepted?: boolean;
  };
}

const GOALS = [
  { id: 'general_fitness', label: 'Condicionamento Físico Geral' },
  { id: 'weight_loss', label: 'Perda de Peso' },
  { id: '5k', label: 'Primeira Corrida de 5K' },
  { id: '10k', label: 'Corrida de 10K' },
  { id: 'half_marathon', label: 'Meia Maratona (21K)' },
  { id: 'marathon', label: 'Maratona (42K)' },
  { id: 'improve_times', label: 'Melhorar Tempos Atuais' },
  { id: 'return_running', label: 'Retorno à Corrida' },
  { id: 'maintenance', label: 'Manutenção da Forma' },
];

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Segunda-feira' },
  { id: 'tuesday', label: 'Terça-feira' },
  { id: 'wednesday', label: 'Quarta-feira' },
  { id: 'thursday', label: 'Quinta-feira' },
  { id: 'friday', label: 'Sexta-feira' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
];

export function useTrainingPlanWizard() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const athleteAnalysis = useAthleteAnalysis();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [wizardData, setWizardData] = useState<TrainingPlanWizardData>({
    goal: '',
    athleteLevel: 'Beginner',
    estimatedTimes: {},
    weeklyFrequency: 3,
    availableDays: [],
    longRunDay: 'sunday',
    startDate: addDays(new Date(), 7), // Start next week by default
    planDurationWeeks: 12,
    hasRaceDate: false,
  });

  // Initialize data from athlete analysis and profile when available
  useEffect(() => {
    if (athleteAnalysis.level && !wizardData.adjustedLevel) {
      setWizardData(prev => ({
        ...prev,
        athleteLevel: athleteAnalysis.level!,
      }));
    }
  }, [athleteAnalysis.level, wizardData.adjustedLevel]);

  useEffect(() => {
    if (athleteAnalysis.raceEstimates && Object.keys(athleteAnalysis.raceEstimates).length > 0) {
      setWizardData(prev => ({
        ...prev,
        estimatedTimes: {
          k5: athleteAnalysis.raceEstimates.k5?.formatted,
          k10: athleteAnalysis.raceEstimates.k10?.formatted,
          k21: athleteAnalysis.raceEstimates.k21?.formatted,
          k42: athleteAnalysis.raceEstimates.k42?.formatted,
        },
      }));
    }
  }, [athleteAnalysis.raceEstimates]);

  useEffect(() => {
    if (profile?.birth_date && !wizardData.birthDate) {
      setWizardData(prev => ({
        ...prev,
        birthDate: new Date(profile.birth_date!),
      }));
    }
  }, [profile, wizardData.birthDate]);

  // Helper functions for conditional flow
  const isRaceGoal = () => {
    return ['5k', '10k', 'half_marathon', '21k', 'marathon', '42k'].includes(wizardData.goal);
  };

  const shouldShowRaceDate = () => {
    return isRaceGoal() || wizardData.goal === 'improve_times';
  };

  const shouldShowRaceGoal = () => {
    return false; // Never show race goal step - we calculate it automatically
  };

  // Helper function to parse time strings to minutes
  const parseTimeToMinutes = (timeStr: string): number | undefined => {
    if (!timeStr) return undefined;
    const parts = timeStr.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2) {
      // MM:SS format
      return parts[0] + parts[1] / 60;
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return parts[0] * 60 + parts[1] + parts[2] / 60;
    }
    return undefined;
  };

  // Calculate target time automatically for race goals
  const calculateTargetTime = () => {
    if (!isRaceGoal()) return undefined;
    
    let targetMinutes: number | undefined;
    
    // Check if user has adjusted times manually
    if (wizardData.adjustedTimes && wizardData.estimatedTimes) {
      // Use user-adjusted times
      switch (wizardData.goal) {
        case '5k':
          targetMinutes = parseTimeToMinutes(wizardData.estimatedTimes.k5);
          break;
        case '10k':
          targetMinutes = parseTimeToMinutes(wizardData.estimatedTimes.k10);
          break;
        case 'half_marathon':
        case '21k':
          targetMinutes = parseTimeToMinutes(wizardData.estimatedTimes.k21);
          break;
        case 'marathon':
        case '42k':
          targetMinutes = parseTimeToMinutes(wizardData.estimatedTimes.k42);
          break;
      }
    } else if (athleteAnalysis.raceEstimates) {
      // Use historical estimates
      const estimates = athleteAnalysis.raceEstimates;
      switch (wizardData.goal) {
        case '5k':
          targetMinutes = estimates.k5?.seconds ? estimates.k5.seconds / 60 : undefined;
          break;
        case '10k':
          targetMinutes = estimates.k10?.seconds ? estimates.k10.seconds / 60 : undefined;
          break;
        case 'half_marathon':
        case '21k':
          targetMinutes = estimates.k21?.seconds ? estimates.k21.seconds / 60 : undefined;
          break;
        case 'marathon':
        case '42k':
          targetMinutes = estimates.k42?.seconds ? estimates.k42.seconds / 60 : undefined;
          break;
      }
    }
    
    // Apply improvement factor based on plan duration and athlete level
    if (targetMinutes) {
      const improvementFactor = getImprovementFactor();
      return Math.round(targetMinutes * (1 - improvementFactor));
    }
    
    return undefined;
  };

  const getImprovementFactor = () => {
    const baseImprovement = {
      'Beginner': 0.15,     // 15% improvement potential
      'Intermediate': 0.08, // 8% improvement potential
      'Advanced': 0.05,     // 5% improvement potential
      'Elite': 0.03,        // 3% improvement potential
    };
    
    const planLengthMultiplier = Math.min(wizardData.planDurationWeeks / 16, 1); // Max improvement at 16+ weeks
    return baseImprovement[wizardData.athleteLevel] * planLengthMultiplier;
  };

  // Dynamic step calculation
  const getStepSequence = () => {
    const baseSteps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Core steps 1-10
    
    if (shouldShowRaceDate()) {
      baseSteps.push(11); // Race date step
    }
    
    // Never add step 12 (race goal) as we calculate it automatically
    
    baseSteps.push(13); // Summary step
    baseSteps.push(14); // Health declaration step (must be last before generation)
    return baseSteps;
  };

  const stepSequence = getStepSequence();
  const totalSteps = stepSequence.length;

  const updateWizardData = (updates: Partial<TrainingPlanWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    const currentIndex = stepSequence.indexOf(currentStep);
    if (currentIndex < stepSequence.length - 1) {
      const nextStepNumber = stepSequence[currentIndex + 1];
      setCurrentStep(nextStepNumber);
    }
  };

  const previousStep = () => {
    const currentIndex = stepSequence.indexOf(currentStep);
    if (currentIndex > 0) {
      const previousStepNumber = stepSequence[currentIndex - 1];
      setCurrentStep(previousStepNumber);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!wizardData.goal;
      case 2:
        return !!wizardData.athleteLevel;
      case 3:
        return !!wizardData.birthDate;
      case 4:
        return !!wizardData.gender;
      case 5:
        return true; // Times are optional/can be estimated
      case 6:
        return wizardData.weeklyFrequency >= 1 && wizardData.weeklyFrequency <= 7;
      case 7:
        return wizardData.availableDays.length >= wizardData.weeklyFrequency;
      case 8:
        return !!wizardData.longRunDay && wizardData.availableDays.includes(wizardData.longRunDay);
      case 9:
        return !!wizardData.startDate;
      case 10:
        return wizardData.planDurationWeeks >= 4 && wizardData.planDurationWeeks <= 52;
      case 11:
        return !wizardData.hasRaceDate || !!wizardData.raceDate;
      case 12:
        // If step 12 is ever re-enabled, validate the target time
        if (!wizardData.goalTargetTimeMinutes) return true; // Optional field
        
        // Import validation at runtime to check if goal is achievable
        // This prevents users from setting impossible goals
        return true; // Will be validated by RaceGoalStep component's UI blocking
      case 13:
        return true; // Summary step
      case 14: // Health declaration step
        if (!wizardData.healthDeclaration) return false;
        
        // Check all 7 questions are answered
        const allQuestionsAnswered = [
          'question_1_heart_problem',
          'question_2_chest_pain_during_activity',
          'question_3_chest_pain_last_3months',
          'question_4_balance_consciousness_loss',
          'question_5_bone_joint_problem',
          'question_6_taking_medication',
          'question_7_other_impediment',
        ].every(q => wizardData.healthDeclaration![q as keyof typeof wizardData.healthDeclaration] !== undefined);
        
        // Check if eligible (all answers must be false/NO)
        const hasPositiveAnswer = [
          wizardData.healthDeclaration.question_1_heart_problem,
          wizardData.healthDeclaration.question_2_chest_pain_during_activity,
          wizardData.healthDeclaration.question_3_chest_pain_last_3months,
          wizardData.healthDeclaration.question_4_balance_consciousness_loss,
          wizardData.healthDeclaration.question_5_bone_joint_problem,
          wizardData.healthDeclaration.question_6_taking_medication,
          wizardData.healthDeclaration.question_7_other_impediment,
        ].some(answer => answer === true);
        
        // Can only proceed if all questions answered, no positive answers, and declaration accepted
        return allQuestionsAnswered && !hasPositiveAnswer && wizardData.healthDeclaration.declaration_accepted === true;
      default:
        return false;
    }
  };

  const generateTrainingPlan = async () => {
    if (!user) return false;

    // Validate health declaration
    if (!wizardData.healthDeclaration?.declaration_accepted) {
      console.error('Health declaration not accepted');
      return false;
    }

    // Check eligibility (all answers must be NO/false)
    const hasPositiveAnswer = [
      wizardData.healthDeclaration.question_1_heart_problem,
      wizardData.healthDeclaration.question_2_chest_pain_during_activity,
      wizardData.healthDeclaration.question_3_chest_pain_last_3months,
      wizardData.healthDeclaration.question_4_balance_consciousness_loss,
      wizardData.healthDeclaration.question_5_bone_joint_problem,
      wizardData.healthDeclaration.question_6_taking_medication,
      wizardData.healthDeclaration.question_7_other_impediment,
    ].some(answer => answer === true);

    if (hasPositiveAnswer) {
      console.error('User not eligible due to health concerns');
      return false;
    }

    setLoading(true);
    try {
      // First, update profile with any missing data
      const profileUpdates: any = {};
      if (wizardData.birthDate && !profile?.birth_date) {
        profileUpdates.birth_date = format(wizardData.birthDate, 'yyyy-MM-dd');
      }
      if (wizardData.gender) {
        profileUpdates.gender = wizardData.gender;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('user_id', user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      // First, save health declaration for legal protection
      const { data: healthDeclaration, error: healthError } = await supabase
        .from('health_declarations')
        .insert({
          user_id: user.id,
          question_1_heart_problem: wizardData.healthDeclaration.question_1_heart_problem || false,
          question_2_chest_pain_during_activity: wizardData.healthDeclaration.question_2_chest_pain_during_activity || false,
          question_3_chest_pain_last_3months: wizardData.healthDeclaration.question_3_chest_pain_last_3months || false,
          question_4_balance_consciousness_loss: wizardData.healthDeclaration.question_4_balance_consciousness_loss || false,
          question_5_bone_joint_problem: wizardData.healthDeclaration.question_5_bone_joint_problem || false,
          question_6_taking_medication: wizardData.healthDeclaration.question_6_taking_medication || false,
          question_7_other_impediment: wizardData.healthDeclaration.question_7_other_impediment || false,
          question_8_additional_info: wizardData.healthDeclaration.question_8_additional_info || null,
          declaration_accepted: true,
          is_eligible: true, // We already validated this above
        })
        .select()
        .single();

      if (healthError) {
        console.error('Error saving health declaration:', healthError);
        return false;
      }

      // Create the training plan (required for preferences foreign key)
      const endDate = addDays(wizardData.startDate, wizardData.planDurationWeeks * 7);
      const planId = uuidv4();
      const { error: planError } = await supabase
        .from('training_plans')
        .insert({
          id: planId,
          user_id: user.id,
          plan_name: `Plano ${GOALS.find(g => g.id === wizardData.goal)?.label || 'Treino'}`,
          goal_type: wizardData.goal,
          start_date: format(wizardData.startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          weeks: wizardData.planDurationWeeks,
          status: 'pending',
          target_event_date: wizardData.hasRaceDate && wizardData.raceDate ? format(wizardData.raceDate, 'yyyy-MM-dd') : null,
        });

      if (planError) {
        console.error('Error creating plan:', planError);
        return false;
      }

      // Link health declaration to training plan
      await supabase
        .from('health_declarations')
        .update({ training_plan_id: planId })
        .eq('id', healthDeclaration.id);

      // Then create preferences linked to the plan
      const dayIdx: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const daysArray = wizardData.availableDays.map(d => dayIdx[d] ?? 0);
      const longRunIdx = dayIdx[wizardData.longRunDay] ?? 6;

      // Calculate target time for race goals
      const calculatedTargetTime = calculateTargetTime();
      
      const { error: preferencesError } = await supabase
        .from('training_plan_preferences')
        .insert({
          user_id: user.id,
          plan_id: planId,
          days_per_week: wizardData.weeklyFrequency,
          days_of_week: daysArray,
          long_run_weekday: longRunIdx,
          start_asap: false,
          start_date: format(wizardData.startDate, 'yyyy-MM-dd'),
          goal_target_time_minutes: calculatedTargetTime,
        });

      if (preferencesError) {
        console.error('Error creating preferences (will continue with defaults):', preferencesError);
        // Do not block plan generation if preferences fail; function uses sensible defaults
      }

      // Trigger Edge Function to generate the detailed plan
      console.log('Calling generate-training-plan with plan_id:', planId);
      const { data: fnResult, error: fnError } = await supabase.functions.invoke('generate-training-plan', {
        body: { plan_id: planId },
      });
      
      if (fnError) {
        console.error('Error invoking generate-training-plan:', fnError);
        console.error('Function error details:', {
          message: fnError.message,
          context: fnError.context,
          details: fnError.details
        });
        return false;
      }
      
      if (fnResult && !fnResult.ok) {
        console.error('Function returned error:', fnResult.error);
        return false;
      }
      
      console.log('Training plan generated successfully:', fnResult);

      return true;
    } catch (error) {
      console.error('Error generating training plan:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentStep,
    totalSteps,
    wizardData,
    loading,
    athleteAnalysis,
    profile,
    goals: GOALS,
    daysOfWeek: DAYS_OF_WEEK,
    updateWizardData,
    nextStep,
    previousStep,
    canProceed, // Return as function, not executed value
    generateTrainingPlan,
    isRaceGoal: isRaceGoal(),
    shouldShowRaceDate: shouldShowRaceDate(),
    shouldShowRaceGoal: shouldShowRaceGoal(),
    calculateTargetTime,
    stepSequence,
  };
}