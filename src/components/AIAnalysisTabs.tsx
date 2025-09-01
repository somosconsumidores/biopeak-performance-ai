import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  Heart,
  Bot 
} from "lucide-react";

interface AIAnalysisTabsProps {
  analysisText: string;
  isCached?: boolean;
}

export function AIAnalysisTabs({ analysisText, isCached = false }: AIAnalysisTabsProps) {
  const formatTextWithHighlights = (text: string) => {
    // Remove asteriscos e limpa o texto
    const cleanText = text.replace(/\*([^*]+)\*/g, '$1');
    
    // Divide o texto em seções baseado nos cabeçalhos
    const sections = cleanText.split(/(?=(?:PONTOS FORTES|GAPS A TRABALHAR|RECOMENDAÇÕES|MENSAGEM MOTIVADORA))/i);
    
    return sections.map((section, index) => {
      const trimmedSection = section.trim();
      if (!trimmedSection) return null;
      
      // Verifica se é uma seção especial e formata adequadamente
      if (trimmedSection.match(/^PONTOS FORTES:/i)) {
        return (
          <div key={index} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-bold text-purple-800">Pontos Fortes</h3>
            </div>
            <div className="text-purple-900 leading-relaxed pl-7">
              {trimmedSection.replace(/^PONTOS FORTES:\s*/i, '').trim()}
            </div>
          </div>
        );
      }
      
      if (trimmedSection.match(/^GAPS A TRABALHAR:/i)) {
        return (
          <div key={index} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <h3 className="text-lg font-bold text-purple-800">Gaps a Trabalhar</h3>
            </div>
            <div className="text-purple-900 leading-relaxed pl-7">
              {trimmedSection.replace(/^GAPS A TRABALHAR:\s*/i, '').trim()}
            </div>
          </div>
        );
      }
      
      if (trimmedSection.match(/^RECOMENDAÇÕES:/i)) {
        return (
          <div key={index} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-bold text-purple-800">Recomendações</h3>
            </div>
            <div className="text-purple-900 leading-relaxed pl-7">
              {trimmedSection.replace(/^RECOMENDAÇÕES:\s*/i, '').trim()}
            </div>
          </div>
        );
      }
      
      if (trimmedSection.match(/^MENSAGEM MOTIVADORA:/i)) {
        return (
          <div key={index} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-bold text-purple-800">Mensagem Motivadora</h3>
            </div>
            <div className="text-purple-900 leading-relaxed pl-7">
              {trimmedSection.replace(/^MENSAGEM MOTIVADORA:\s*/i, '').trim()}
            </div>
          </div>
        );
      }
      
      // Para seções sem cabeçalho específico (texto inicial)
      return (
        <div key={index} className="mb-4 text-purple-900 leading-relaxed">
          {trimmedSection}
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-purple-800">
          <Bot className="h-5 w-5" />
          Parecer da IA
          {isCached && (
            <Badge variant="secondary" className="text-xs">
              Análise salva
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {formatTextWithHighlights(analysisText)}
        </div>
      </CardContent>
    </Card>
  );
}