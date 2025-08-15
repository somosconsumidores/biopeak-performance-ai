import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SurveyForm } from "./SurveyForm";
import { SurveyStats } from "./SurveyStats";

interface Campaign {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  survey_questions: Array<{
    id: string;
    question_text: string;
    question_type: 'text' | 'multiple_choice' | 'scale';
    is_required: boolean;
    order_index: number;
    options?: any;
  }>;
}

export const SurveyManagement = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_campaigns')
        .select(`
          *,
          survey_questions(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data || []).map(campaign => ({
        ...campaign,
        survey_questions: (campaign.survey_questions || []).map((q: any) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type as 'text' | 'multiple_choice' | 'scale',
          is_required: q.is_required,
          order_index: q.order_index,
          options: q.options
        }))
      })));
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar campanhas de pesquisa.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignStatus = async (campaignId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('survey_campaigns')
        .update({ is_active: !currentStatus })
        .eq('id', campaignId);

      if (error) throw error;
      
      await fetchCampaigns();
      toast({
        title: "Status atualizado",
        description: `Campanha ${!currentStatus ? 'ativada' : 'desativada'} com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da campanha.",
        variant: "destructive"
      });
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('survey_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      
      await fetchCampaigns();
      toast({
        title: "Campanha excluída",
        description: "Campanha excluída com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir campanha.",
        variant: "destructive"
      });
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedCampaign(null);
    fetchCampaigns();
  };

  const isActive = (campaign: Campaign) => {
    const today = new Date().toISOString().split('T')[0];
    return campaign.is_active && 
           campaign.start_date <= today && 
           campaign.end_date >= today;
  };

  if (loading) {
    return <div className="text-center">Carregando campanhas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pesquisas</h2>
          <p className="text-muted-foreground">
            Gerencie campanhas de pesquisa com popup
          </p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedCampaign(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Pesquisa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCampaign ? 'Editar Pesquisa' : 'Nova Pesquisa'}
              </DialogTitle>
            </DialogHeader>
            <SurveyForm 
              campaign={selectedCampaign} 
              onSuccess={handleFormSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhuma campanha de pesquisa criada ainda.
              </p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {campaign.title}
                      {isActive(campaign) && (
                        <Badge variant="default">Ativa</Badge>
                      )}
                      {campaign.is_active && !isActive(campaign) && (
                        <Badge variant="secondary">Programada</Badge>
                      )}
                      {!campaign.is_active && (
                        <Badge variant="outline">Inativa</Badge>
                      )}
                    </CardTitle>
                    {campaign.description && (
                      <CardDescription>{campaign.description}</CardDescription>
                    )}
                    <div className="text-sm text-muted-foreground">
                      Período: {new Date(campaign.start_date).toLocaleDateString()} - {new Date(campaign.end_date).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {campaign.survey_questions?.length || 0} pergunta(s)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        setIsStatsOpen(true);
                      }}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        setIsFormOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleCampaignStatus(campaign.id, campaign.is_active)}
                    >
                      {campaign.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCampaign(campaign.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isStatsOpen} onOpenChange={setIsStatsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estatísticas da Pesquisa</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <SurveyStats campaignId={selectedCampaign.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};