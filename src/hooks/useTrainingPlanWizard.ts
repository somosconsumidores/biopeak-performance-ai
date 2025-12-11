import { useState, useEffect } from 'react';
import { useAthleteAnalysis } from './useAthleteAnalysis';
import { useProfile } from './useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { addDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { validateRaceTime } from '@/utils/raceTimeValidation';

export interface TrainingPlanWizardData {
  // Step 0.5: Sport selection (new first step)
  sportType: 'running' | 'cycling' | 'swimming' | 'strength';
  
  // Step 1: Phone number
  phone?: string;
  
  // Step 2: Goal selection
  goal: string;
  goalDescription?: string;
  
  // Cycling-specific fields
  cyclingLevel?: 'beginner' | 'intermediate' | 'advanced';
  ftpWatts?: number;
  hasFtpTest?: boolean;
  maxHeartRate?: number;
  availableHoursPerWeek?: number;
  equipmentType?: 'road' | 'mtb' | 'trainer' | 'mixed';
  targetEventDescription?: string;
  
  // Swimming-specific fields
  swimmingLevel?: 'beginner' | 'intermediate' | 'advanced';
  cssSecondsPerHundred?: number; // Critical Swim Speed (seconds per 100m)
  hasCssTest?: boolean;
  poolLength?: 25 | 50;
  swimmingEquipment?: string[]; // palmar, nadadeira, pull_buoy, snorkel
  time400m?: string; // For CSS calculation
  time200m?: string; // For CSS calculation
  
  // Strength-specific fields
  strengthGoal?: 'injury_prevention' | 'performance' | 'general' | 'core';
  strengthEquipment?: 'full_gym' | 'home_basic' | 'bodyweight';
  strengthFrequency?: 2 | 3;
  parentPlanId?: string; // Links strength plan to main aerobic plan
  
  // Step 3: Athlete level confirmation/adjustment
  athleteLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
  adjustedLevel?: boolean;
  
  // Step 4: Birth date confirmation
  birthDate?: Date;
  
  // Step 5: Gender collection
  gender?: 'male' | 'female';
  
  // Step 6: Current time confirmation
  estimatedTimes: {
    k5?: string;
    k10?: string;
    k21?: string;
    k42?: string;
  };
  adjustedTimes?: boolean;
  unknownPaces?: boolean; // Flag for beginners who don't know their paces
  
  // Step 7: Weekly frequency
  weeklyFrequency: number;
  
  // Step 8: Available days
  availableDays: string[];
  
  // Step 9: Long run day preference
  longRunDay: string;
  
  // Step 10: Start date
  startDate: Date;
  
  // Step 11: Plan duration
  planDurationWeeks: number;
  
  // Step 12: Race date (optional)
  raceDate?: Date;
  hasRaceDate: boolean;
  
  // Step 13: Race goal (optional)
  raceGoal?: string;
  goalTargetTimeMinutes?: number;
  
  // Step 14: Summary and generation (no additional data)
  
  // Step 15: Health declaration (PAR-Q)
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

export const CYCLING_GOALS = [
  { id: 'cycling_general_fitness', label: 'Condicionamento Geral', icon: 'Activity' },
  { id: 'cycling_weight_loss', label: 'Perda de Peso', icon: 'Scale' },
  { id: 'cycling_gran_fondo', label: 'Gran Fondo / 100km', icon: 'Mountain' },
  { id: 'cycling_improve_power', label: 'Melhorar Potência e Tempo Médio', icon: 'TrendingUp' },
  { id: 'cycling_return', label: 'Retorno ao Pedal', icon: 'RotateCcw' },
  { id: 'cycling_triathlon', label: 'Triathlon / Duathlon', icon: 'Trophy' },
  { id: 'cycling_maintenance', label: 'Manutenção e Saúde', icon: 'Heart' },
];

export const SWIMMING_GOALS = [
  { id: 'swimming_general_fitness', label: 'Condicionamento Geral', icon: 'Activity' },
  { id: 'swimming_weight_loss', label: 'Perda de Peso', icon: 'Scale' },
  { id: 'swimming_1500m', label: 'Prova de 1500m', icon: 'Medal' },
  { id: 'swimming_3km', label: 'Prova de 3km / Águas Abertas', icon: 'Waves' },
  { id: 'swimming_triathlon', label: 'Triathlon / Duathlon', icon: 'Trophy' },
  { id: 'swimming_technique', label: 'Melhorar Técnica', icon: 'Target' },
  { id: 'swimming_maintenance', label: 'Manutenção e Saúde', icon: 'Heart' },
];

export const STRENGTH_GOALS = [
  { id: 'strength_injury_prevention', label: 'Prevenção de Lesões', icon: 'Shield' },
  { id: 'strength_performance', label: 'Melhoria de Performance', icon: 'TrendingUp' },
  { id: 'strength_general', label: 'Fortalecimento Geral', icon: 'Dumbbell' },
  { id: 'strength_core', label: 'Foco em Core', icon: 'Target' },
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
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0); // Start at step 0 (disclaimer)
  const [loading, setLoading] = useState(false);
  const [wizardData, setWizardData] = useState<TrainingPlanWizardData>({
    sportType: 'running', // Default to running
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
    return isRaceGoal(); // Show race goal step for race goals
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
    
    // ✅ PRIORIDADE ÚNICA: Meta específica definida pelo usuário no Step 13 (RaceGoalStep)
    // Esta é a meta REAL que o usuário quer atingir
    if (wizardData.goalTargetTimeMinutes !== undefined) {
      console.log('✅ Using user-defined race goal from Step 13:', {
        goalTargetTimeMinutes: wizardData.goalTargetTimeMinutes,
        goal: wizardData.goal
      });
      return wizardData.goalTargetTimeMinutes;
    }
    
    // 🤖 FALLBACK: Se usuário não definiu meta no Step 13, calcular automaticamente
    // baseado em estimativas históricas com fator de melhoria
    if (athleteAnalysis.raceEstimates) {
      const estimates = athleteAnalysis.raceEstimates;
      let targetMinutes: number | undefined;
      
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
      
      // Aplicar fator de melhoria APENAS para estimativas históricas
      if (targetMinutes) {
        const improvementFactor = getImprovementFactor();
        const improvedTime = Math.round(targetMinutes * (1 - improvementFactor));
        console.log('📈 Using historical estimates with improvement factor:', { 
          originalMinutes: targetMinutes,
          improvementFactor,
          improvedTime,
          goal: wizardData.goal 
        });
        return improvedTime;
      }
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
    const baseSteps = [0, 1]; // Step 0 = Disclaimer, Step 1 = Sport Selection
    
    if (wizardData.sportType === 'swimming') {
      // Swimming sequence (steps 20-30)
      baseSteps.push(
        2,   // Phone
        20,  // Swimming Goal
        21,  // Swimming Level
        22,  // CSS
        23,  // Pool Length
        24,  // Swimming Equipment
        25,  // Available Hours (reuse cycling component)
        26,  // Available Days
        27,  // Start Date
        28,  // Plan Duration
        29,  // Summary
        30   // Health Declaration
      );
    } else if (wizardData.sportType === 'strength') {
      // Strength sequence (steps 40-45)
      baseSteps.push(
        40,  // Parent Plan Selection
        41,  // Strength Goal
        42,  // Strength Equipment
        43,  // Strength Frequency
        44,  // Summary
        45   // Health Declaration
      );
    } else if (wizardData.sportType === 'cycling') {
      // Cycling sequence
      baseSteps.push(
        2,  // Phone
        3,  // Cycling Goal
        4,  // Cycling Level
        5,  // FTP
        6,  // Available Hours
        7,  // Available Days  
        8,  // Equipment
        9,  // Start Date
        10, // Plan Duration
        11, // Summary
        12  // Health Declaration
      );
    } else {
      // Running sequence (existing)
      baseSteps.push(2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
      
      if (shouldShowRaceDate()) {
        baseSteps.push(12); // Race date step
      }
      
      if (shouldShowRaceGoal()) {
        baseSteps.push(13); // Race goal step
      }
      
      baseSteps.push(14); // Summary step
      baseSteps.push(15); // Health declaration step
    }
    
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
    const { sportType } = wizardData;
    
    switch (currentStep) {
      case 0:
        return false; // Disclaimer step handles its own navigation
      case 1:
        return !!sportType; // Sport selection
      case 2: {
        // Phone validation
        if (!wizardData.phone) return false;
        const digitsOnly = wizardData.phone.replace(/\D/g, '');
        return digitsOnly.length === 11;
      }
      case 3:
        return !!wizardData.goal; // Goal for both sports
      case 4:
        // Level validation (different for each sport)
        return sportType === 'cycling' ? !!wizardData.cyclingLevel : !!wizardData.athleteLevel;
      case 5:
        // FTP for cycling, Gender for running
        if (sportType === 'cycling') {
          return wizardData.hasFtpTest !== undefined && 
                 (wizardData.hasFtpTest === false || (wizardData.ftpWatts && wizardData.ftpWatts > 50));
        }
        return !!wizardData.gender;
      case 6:
        // Available hours for cycling, Times for running
        if (sportType === 'cycling') {
          return !!wizardData.availableHoursPerWeek && wizardData.availableHoursPerWeek >= 2;
        }
        return wizardData.unknownPaces === true || Object.values(wizardData.estimatedTimes).some(time => time);
      case 7:
        // Days for cycling, Weekly frequency for running
        if (sportType === 'cycling') {
          return wizardData.availableDays.length >= 2;
        }
        return wizardData.weeklyFrequency >= 1 && wizardData.weeklyFrequency <= 7;
      case 8:
        // Equipment for cycling, Available days for running
        if (sportType === 'cycling') {
          return !!wizardData.equipmentType;
        }
        return wizardData.availableDays.length >= wizardData.weeklyFrequency;
      case 9:
        // Start date for cycling, Long run day for running
        if (sportType === 'cycling') {
          return !!wizardData.startDate;
        }
        return !!wizardData.longRunDay && wizardData.availableDays.includes(wizardData.longRunDay);
      case 10:
        // Plan duration for cycling, Start date for running
        if (sportType === 'cycling') {
          return wizardData.planDurationWeeks >= 4 && wizardData.planDurationWeeks <= 52;
        }
        return !!wizardData.startDate;
      case 11:
        // Summary/Health for cycling, Plan duration for running
        if (sportType === 'cycling') {
          return true; // Summary step
        }
        return wizardData.planDurationWeeks >= 4 && wizardData.planDurationWeeks <= 52;
      case 12:
        // Health declaration for cycling, Race date for running
        if (sportType === 'cycling') {
          if (!wizardData.healthDeclaration) return false;
          const allQuestionsAnswered = [
            'question_1_heart_problem',
            'question_2_chest_pain_during_activity',
            'question_3_chest_pain_last_3months',
            'question_4_balance_consciousness_loss',
            'question_5_bone_joint_problem',
            'question_6_taking_medication',
            'question_7_other_impediment',
          ].every(q => wizardData.healthDeclaration![q as keyof typeof wizardData.healthDeclaration] !== undefined);
          
          const hasPositiveAnswer = [
            wizardData.healthDeclaration.question_1_heart_problem,
            wizardData.healthDeclaration.question_2_chest_pain_during_activity,
            wizardData.healthDeclaration.question_3_chest_pain_last_3months,
            wizardData.healthDeclaration.question_4_balance_consciousness_loss,
            wizardData.healthDeclaration.question_5_bone_joint_problem,
            wizardData.healthDeclaration.question_6_taking_medication,
            wizardData.healthDeclaration.question_7_other_impediment,
          ].some(answer => answer === true);
          
          return allQuestionsAnswered && !hasPositiveAnswer && wizardData.healthDeclaration.declaration_accepted === true;
        }
        return !wizardData.hasRaceDate || !!wizardData.raceDate;
      case 13: {
        // RaceGoalStep validation for running only
        if (!wizardData.goalTargetTimeMinutes) return true;
        
        const distanceMap: Record<string, number> = {
          '5k': 5000,
          '10k': 10000,
          'half_marathon': 21097,
          '21k': 21097,
          'marathon': 42195,
          '42k': 42195,
        };
        
        const distanceMeters = distanceMap[wizardData.goal] || 10000;
        const validation = validateRaceTime(wizardData.goalTargetTimeMinutes, distanceMeters, undefined);
        return validation.canProceed;
      }
      case 14:
        return true; // Summary step for running
      case 15: // Health declaration step for running
        if (!wizardData.healthDeclaration) return false;
        
        const allQuestionsAnswered = [
          'question_1_heart_problem',
          'question_2_chest_pain_during_activity',
          'question_3_chest_pain_last_3months',
          'question_4_balance_consciousness_loss',
          'question_5_bone_joint_problem',
          'question_6_taking_medication',
          'question_7_other_impediment',
        ].every(q => wizardData.healthDeclaration![q as keyof typeof wizardData.healthDeclaration] !== undefined);
        
        const hasPositiveAnswer = [
          wizardData.healthDeclaration.question_1_heart_problem,
          wizardData.healthDeclaration.question_2_chest_pain_during_activity,
          wizardData.healthDeclaration.question_3_chest_pain_last_3months,
          wizardData.healthDeclaration.question_4_balance_consciousness_loss,
          wizardData.healthDeclaration.question_5_bone_joint_problem,
          wizardData.healthDeclaration.question_6_taking_medication,
          wizardData.healthDeclaration.question_7_other_impediment,
        ].some(answer => answer === true);
        
        return allQuestionsAnswered && !hasPositiveAnswer && wizardData.healthDeclaration.declaration_accepted === true;
      
      // Swimming steps (20-30)
      case 20: // Swimming Goal
        return !!wizardData.goal;
      case 21: // Swimming Level
        return !!wizardData.swimmingLevel;
      case 22: // CSS
        return wizardData.hasCssTest !== undefined && 
               (wizardData.hasCssTest === false || (wizardData.cssSecondsPerHundred && wizardData.cssSecondsPerHundred > 60));
      case 23: // Pool Length
        return !!wizardData.poolLength;
      case 24: // Swimming Equipment
        return true; // Optional
      case 25: // Available Hours (Swimming)
        return !!wizardData.availableHoursPerWeek && wizardData.availableHoursPerWeek >= 2;
      case 26: // Available Days (Swimming)
        return wizardData.availableDays.length >= 2;
      case 27: // Start Date (Swimming)
        return !!wizardData.startDate;
      case 28: // Plan Duration (Swimming)
        return wizardData.planDurationWeeks >= 4 && wizardData.planDurationWeeks <= 52;
      case 29: // Summary (Swimming)
        return true;
      case 30: { // Health Declaration (Swimming)
        if (!wizardData.healthDeclaration) return false;
        const swimmingQuestionsAnswered = [
          'question_1_heart_problem',
          'question_2_chest_pain_during_activity',
          'question_3_chest_pain_last_3months',
          'question_4_balance_consciousness_loss',
          'question_5_bone_joint_problem',
          'question_6_taking_medication',
          'question_7_other_impediment',
        ].every(q => wizardData.healthDeclaration![q as keyof typeof wizardData.healthDeclaration] !== undefined);
        
        const swimmingHasPositive = [
          wizardData.healthDeclaration.question_1_heart_problem,
          wizardData.healthDeclaration.question_2_chest_pain_during_activity,
          wizardData.healthDeclaration.question_3_chest_pain_last_3months,
          wizardData.healthDeclaration.question_4_balance_consciousness_loss,
          wizardData.healthDeclaration.question_5_bone_joint_problem,
          wizardData.healthDeclaration.question_6_taking_medication,
          wizardData.healthDeclaration.question_7_other_impediment,
        ].some(answer => answer === true);
        
        return swimmingQuestionsAnswered && !swimmingHasPositive && wizardData.healthDeclaration.declaration_accepted === true;
      }
      
      // Strength steps (40-45)
      case 40: // Parent Plan Selection
        return !!wizardData.parentPlanId;
      case 41: // Strength Goal
        return !!wizardData.strengthGoal;
      case 42: // Strength Equipment
        return !!wizardData.strengthEquipment;
      case 43: // Strength Frequency
        return !!wizardData.strengthFrequency && (wizardData.strengthFrequency === 2 || wizardData.strengthFrequency === 3);
      case 44: // Summary (Strength)
        return true;
      case 45: { // Health Declaration (Strength)
        if (!wizardData.healthDeclaration) return false;
        const strengthQuestionsAnswered = [
          'question_1_heart_problem',
          'question_2_chest_pain_during_activity',
          'question_3_chest_pain_last_3months',
          'question_4_balance_consciousness_loss',
          'question_5_bone_joint_problem',
          'question_6_taking_medication',
          'question_7_other_impediment',
        ].every(q => wizardData.healthDeclaration![q as keyof typeof wizardData.healthDeclaration] !== undefined);
        
        const strengthHasPositive = [
          wizardData.healthDeclaration.question_1_heart_problem,
          wizardData.healthDeclaration.question_2_chest_pain_during_activity,
          wizardData.healthDeclaration.question_3_chest_pain_last_3months,
          wizardData.healthDeclaration.question_4_balance_consciousness_loss,
          wizardData.healthDeclaration.question_5_bone_joint_problem,
          wizardData.healthDeclaration.question_6_taking_medication,
          wizardData.healthDeclaration.question_7_other_impediment,
        ].some(answer => answer === true);
        
        return strengthQuestionsAnswered && !strengthHasPositive && wizardData.healthDeclaration.declaration_accepted === true;
      }
      
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

    // Check if user already has active training plans
    const { data: existingActivePlans, error: checkError } = await supabase
      .from('training_plans')
      .select('id, plan_name, status, sport_type, is_complementary')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (checkError) {
      console.error('Error checking existing plans:', checkError);
      toast({
        title: "Erro ao verificar planos",
        description: "Não foi possível verificar seus planos existentes. Tente novamente.",
        variant: "destructive"
      });
      return false;
    }

    // Different validation based on sport type
    if (wizardData.sportType === 'strength') {
      // For strength plans: need exactly 1 aerobic plan, no existing strength plan
      const aerobicPlans = existingActivePlans?.filter(p => !p.is_complementary && p.sport_type !== 'strength') || [];
      const strengthPlans = existingActivePlans?.filter(p => p.is_complementary || p.sport_type === 'strength') || [];
      
      if (aerobicPlans.length === 0) {
        console.log('No aerobic plan found for strength plan');
        toast({
          title: "Plano aeróbico necessário",
          description: "Crie primeiro um plano de corrida, ciclismo ou natação para adicionar treino de força.",
          variant: "destructive",
          duration: 6000
        });
        return false;
      }
      
      if (strengthPlans.length > 0) {
        console.log('User already has a strength plan:', strengthPlans[0]);
        toast({
          title: "Você já possui um plano de força",
          description: "Para criar um novo plano de força, primeiro cancele o plano atual.",
          variant: "destructive",
          duration: 6000
        });
        return false;
      }
    } else {
      // For aerobic plans: cannot have existing aerobic plan
      const aerobicPlans = existingActivePlans?.filter(p => !p.is_complementary && p.sport_type !== 'strength') || [];
      
      if (aerobicPlans.length > 0) {
        console.log('User already has an aerobic plan:', aerobicPlans[0]);
        toast({
          title: "Você já possui um plano aeróbico ativo",
          description: "Para criar um novo plano, primeiro cancele ou finalize o plano atual na página de treinos.",
          variant: "destructive",
          duration: 6000
        });
        return false;
      }
    }

    console.log('✅ No active plans found, proceeding with plan creation');

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
      if (wizardData.phone) {
        // Store phone without formatting
        profileUpdates.phone = wizardData.phone.replace(/\D/g, '');
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

      // Validate critical fields before attempting INSERT
      if (!wizardData.planDurationWeeks || wizardData.planDurationWeeks < 4 || wizardData.planDurationWeeks > 52) {
        console.error('❌ VALIDATION ERROR: Invalid planDurationWeeks:', wizardData.planDurationWeeks);
        toast({
          title: "Erro de validação",
          description: `Duração do plano inválida: ${wizardData.planDurationWeeks} semanas. Deve estar entre 4 e 52.`,
          variant: "destructive",
          duration: 8000
        });
        return false;
      }

      if (!wizardData.goal) {
        console.error('❌ VALIDATION ERROR: Missing goal:', wizardData.goal);
        toast({
          title: "Erro de validação",
          description: "Objetivo do plano não foi selecionado.",
          variant: "destructive",
          duration: 8000
        });
        return false;
      }

      if (!wizardData.startDate) {
        console.error('❌ VALIDATION ERROR: Missing startDate:', wizardData.startDate);
        toast({
          title: "Erro de validação",
          description: "Data de início não foi definida.",
          variant: "destructive",
          duration: 8000
        });
        return false;
      }

      console.log('✅ All validations passed, proceeding with plan creation');

      // Create the training plan (required for preferences foreign key)
      const endDate = addDays(wizardData.startDate, wizardData.planDurationWeeks * 7);
      const planId = uuidv4();
      
      // Helper to get plan name based on sport type
      const getPlanName = (): string => {
        switch (wizardData.sportType) {
          case 'cycling':
            return `Plano ${CYCLING_GOALS.find(g => g.id === wizardData.goal)?.label || 'Ciclismo'}`;
          case 'swimming':
            return `Plano ${SWIMMING_GOALS.find(g => g.id === wizardData.goal)?.label || 'Natação'}`;
          case 'strength':
            return `Plano ${STRENGTH_GOALS.find(g => g.id === wizardData.strengthGoal)?.label || 'Força'}`;
          default:
            return `Plano ${GOALS.find(g => g.id === wizardData.goal)?.label || 'Corrida'}`;
        }
      };
      
      // Calculate target time for race goals
      const calculatedTargetTime = calculateTargetTime();
      
      console.log('💾 Creating training plan with:', {
        planId,
        goal: wizardData.goal,
        goalTargetTimeMinutes: wizardData.goalTargetTimeMinutes,
        calculatedTargetTime,
        source: wizardData.goalTargetTimeMinutes ? 'user-defined (Step 12)' : 
                wizardData.adjustedTimes ? 'adjusted-times (Step 5)' : 
                'historical-estimates'
      });

      console.log('🔍 DEBUG - Training plan data before INSERT:', {
        planId,
        user_id: user.id,
        plan_name: `Plano ${GOALS.find(g => g.id === wizardData.goal)?.label || 'Treino'}`,
        goal_type: wizardData.goal,
        start_date: format(wizardData.startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        weeks: wizardData.planDurationWeeks,
        status: 'pending',
        target_event_date: wizardData.hasRaceDate && wizardData.raceDate ? format(wizardData.raceDate, 'yyyy-MM-dd') : null,
        goal_target_time_minutes: calculatedTargetTime
      });
      
      const { error: planError } = await supabase
        .from('training_plans')
        .insert({
          id: planId,
          user_id: user.id,
          plan_name: getPlanName(),
          goal_type: wizardData.goal || wizardData.strengthGoal || 'general',
          sport_type: wizardData.sportType,
          ftp_watts: wizardData.sportType === 'cycling' ? wizardData.ftpWatts : null,
          equipment_type: wizardData.sportType === 'cycling' ? wizardData.equipmentType : null,
          start_date: format(wizardData.startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          weeks: wizardData.planDurationWeeks,
          status: 'pending',
          target_event_date: wizardData.hasRaceDate && wizardData.raceDate ? format(wizardData.raceDate, 'yyyy-MM-dd') : null,
          goal_target_time_minutes: calculatedTargetTime ? Math.round(calculatedTargetTime) : undefined,
          is_complementary: wizardData.sportType === 'strength',
          parent_plan_id: wizardData.sportType === 'strength' ? wizardData.parentPlanId : null,
        });

      if (planError) {
        console.error('❌ ERROR creating plan - Full details:', {
          error: planError,
          message: planError.message,
          details: planError.details,
          hint: planError.hint,
          code: planError.code,
          wizardData: {
            planDurationWeeks: wizardData.planDurationWeeks,
            goal: wizardData.goal,
            startDate: wizardData.startDate
          }
        });
        toast({
          title: "Erro ao criar plano",
          description: `Detalhes: ${planError.message}. Verifique o console para mais informações.`,
          variant: "destructive",
          duration: 8000
        });
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

      // TimeSpinner já garante valores dentro de limites realistas
      // Validação simplificada apenas para logging
      if (calculatedTargetTime && isRaceGoal()) {
        console.log('✅ Target time set via TimeSpinner (pre-validated):', {
          goal: wizardData.goal,
          targetMinutes: calculatedTargetTime
        });
      }
      
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
        });

      if (preferencesError) {
        console.error('Error creating preferences (will continue with defaults):', preferencesError);
        // Do not block plan generation if preferences fail; function uses sensible defaults
      }

      // Prepare declared_paces and beginner flag
      let declaredPaces = null;
      let absoluteBeginner = false;
      
      if (wizardData.unknownPaces === true) {
        // User marked as beginner/unknown paces
        absoluteBeginner = true;
        console.log('🚨 User marked as absolute beginner - no declared paces');
      } else if (Object.values(wizardData.estimatedTimes).some(t => t)) {
        // User has declared times - convert to paces
        const parseTimeToMinutes = (timeStr: string): number | undefined => {
          if (!timeStr) return undefined;
          const parts = timeStr.split(':').map(p => parseInt(p, 10));
          if (parts.length === 2) return parts[0] + parts[1] / 60; // MM:SS
          if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60; // HH:MM:SS
          return undefined;
        };
        
        declaredPaces = {
          pace_5k: parseTimeToMinutes(wizardData.estimatedTimes.k5 || '') ? parseTimeToMinutes(wizardData.estimatedTimes.k5!)! / 5 : undefined,
          pace_10k: parseTimeToMinutes(wizardData.estimatedTimes.k10 || '') ? parseTimeToMinutes(wizardData.estimatedTimes.k10!)! / 10 : undefined,
          pace_half: parseTimeToMinutes(wizardData.estimatedTimes.k21 || '') ? parseTimeToMinutes(wizardData.estimatedTimes.k21!)! / 21.097 : undefined,
          pace_marathon: parseTimeToMinutes(wizardData.estimatedTimes.k42 || '') ? parseTimeToMinutes(wizardData.estimatedTimes.k42!)! / 42.195 : undefined,
        };
        
        // Remove undefined values
        declaredPaces = Object.fromEntries(
          Object.entries(declaredPaces).filter(([_, v]) => v !== undefined)
        );
        
        if (Object.keys(declaredPaces).length === 0) {
          declaredPaces = null;
        }
      }

      // Determine which edge function to call based on sport type
      let edgeFunctionName: string;
      let functionPayload: any;
      
      switch (wizardData.sportType) {
        case 'cycling':
          edgeFunctionName = 'generate-cycling-plan';
          functionPayload = {
            planId,
            userId: user.id,
            goal: wizardData.goal,
            level: wizardData.cyclingLevel,
            ftpWatts: wizardData.ftpWatts,
            maxHeartRate: wizardData.maxHeartRate,
            availableHoursPerWeek: wizardData.availableHoursPerWeek,
            availableDays: wizardData.availableDays,
            equipmentType: wizardData.equipmentType,
            startDate: format(wizardData.startDate, 'yyyy-MM-dd'),
            planDurationWeeks: wizardData.planDurationWeeks,
            targetEventDate: wizardData.raceDate ? format(wizardData.raceDate, 'yyyy-MM-dd') : null,
            targetEventDescription: wizardData.targetEventDescription
          };
          break;
          
        case 'swimming':
          edgeFunctionName = 'generate-swimming-plan';
          functionPayload = {
            planId,
            userId: user.id,
            cssSecondsPerHundred: wizardData.cssSecondsPerHundred,
            poolLength: wizardData.poolLength,
            availableHoursPerWeek: wizardData.availableHoursPerWeek || (wizardData.weeklyFrequency * 1.5),
            availableDays: wizardData.availableDays,
            swimmingEquipment: wizardData.swimmingEquipment,
            level: wizardData.swimmingLevel,
            startDate: format(wizardData.startDate, 'yyyy-MM-dd'),
            planDurationWeeks: wizardData.planDurationWeeks,
          };
          break;
          
        case 'strength':
          edgeFunctionName = 'generate-strength-plan';
          functionPayload = {
            planId,
            userId: user.id,
            strengthGoal: wizardData.strengthGoal,
            strengthEquipment: wizardData.strengthEquipment,
            strengthFrequency: wizardData.strengthFrequency,
            parentPlanId: wizardData.parentPlanId,
            startDate: format(wizardData.startDate, 'yyyy-MM-dd'),
            planDurationWeeks: wizardData.planDurationWeeks,
          };
          break;
          
        default: // running
          edgeFunctionName = 'generate-training-plan';
          functionPayload = {
            plan_id: planId,
            declared_paces: declaredPaces,
            absolute_beginner: absoluteBeginner
          };
      }

      console.log(`Calling ${edgeFunctionName} with payload:`, functionPayload);
      const { data: fnResult, error: fnError } = await supabase.functions.invoke(edgeFunctionName, {
        body: functionPayload,
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
      
      if (fnResult && fnResult.success === false) {
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