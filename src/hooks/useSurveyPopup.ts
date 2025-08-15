import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: 'text' | 'multiple_choice' | 'scale';
  options?: string[];
  is_required: boolean;
  order_index: number;
}

export interface SurveyCampaign {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  questions?: SurveyQuestion[];
}

export const useSurveyPopup = () => {
  const [currentSurvey, setCurrentSurvey] = useState<SurveyCampaign | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    checkForActiveSurvey();
  }, [user]);

  const checkForActiveSurvey = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Check if user has already seen any active surveys
      const { data: interactions } = await supabase
        .from('survey_user_interactions')
        .select('campaign_id')
        .eq('user_id', user.id);

      const seenCampaignIds = interactions?.map(i => i.campaign_id) || [];

      // Get active survey that user hasn't seen
      const { data: campaigns } = await supabase
        .from('survey_campaigns')
        .select(`
          *,
          survey_questions(*)
        `)
        .eq('is_active', true)
        .lte('start_date', new Date().toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0])
        .not('id', 'in', `(${seenCampaignIds.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (campaigns && campaigns.length > 0) {
        const campaign = campaigns[0];
        // Sort questions by order_index
        if (campaign.survey_questions) {
          campaign.survey_questions.sort((a: any, b: any) => a.order_index - b.order_index);
        }
        setCurrentSurvey(campaign as SurveyCampaign);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Error checking for active surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async (responses: Record<string, string>) => {
    if (!currentSurvey || !user) return;

    try {
      // Submit responses
      const responseData = Object.entries(responses).map(([questionId, answer]) => ({
        campaign_id: currentSurvey.id,
        user_id: user.id,
        question_id: questionId,
        response_text: answer,
        response_option: answer
      }));

      await supabase.from('survey_responses').insert(responseData);

      // Mark as interacted
      await supabase.from('survey_user_interactions').insert({
        campaign_id: currentSurvey.id,
        user_id: user.id,
        action: 'responded'
      });

      setIsVisible(false);
      setCurrentSurvey(null);
    } catch (error) {
      console.error('Error submitting survey response:', error);
      throw error;
    }
  };

  const dismissSurvey = async () => {
    if (!currentSurvey || !user) return;

    try {
      // Mark as dismissed
      await supabase.from('survey_user_interactions').insert({
        campaign_id: currentSurvey.id,
        user_id: user.id,
        action: 'dismissed'
      });

      setIsVisible(false);
      setCurrentSurvey(null);
    } catch (error) {
      console.error('Error dismissing survey:', error);
    }
  };

  return {
    currentSurvey,
    isVisible,
    loading,
    submitResponse,
    dismissSurvey
  };
};