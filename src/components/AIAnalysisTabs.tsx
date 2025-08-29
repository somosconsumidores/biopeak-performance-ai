import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ParsedAnalysis {
  pontosFortes?: string;
  gaps?: string;
  recomendacoes?: string;
  mensagem?: string;
  fullText?: string;
}

export function AIAnalysisTabs({ analysisText, isCached = false }: AIAnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState("pontos-fortes");

  const parseAnalysis = (text: string): ParsedAnalysis => {
    // Padrões para identificar as seções no texto da IA
    const patterns = {
      pontosFortes: /(?:pontos?\s+fortes?|qualidades?|força|virtudes?)[^:]*:?\s*([^]*?)(?=(?:gaps?|lacunas?|pontos?\s+fracos?|melhorar|recomendaç|sugest|mensagem|motivaç|\n\n|\s{2,}\n)|$)/i,
      gaps: /(?:gaps?|lacunas?|pontos?\s+fracos?|melhorar|aspectos?\s+a\s+desenvolver)[^:]*:?\s*([^]*?)(?=(?:recomendaç|sugest|treino|mensagem|motivaç|\n\n|\s{2,}\n)|$)/i,
      recomendacoes: /(?:recomendaç|sugest|treino|plano|estratégi)[^:]*:?\s*([^]*?)(?=(?:mensagem|motivaç|\n\n|\s{2,}\n)|$)/i,
      mensagem: /(?:mensagem|motivaç|conclusão|final)[^:]*:?\s*([^]*?)$/i
    };

    const result: ParsedAnalysis = {};
    
    // Tentar extrair cada seção
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const content = match[1].trim();
        if (content.length > 20) { // Só considerar se tiver conteúdo substancial
          result[key as keyof ParsedAnalysis] = content;
        }
      }
    }

    // Se não conseguiu extrair nenhuma seção específica, usar o texto completo
    if (!result.pontosFortes && !result.gaps && !result.recomendacoes && !result.mensagem) {
      result.fullText = text;
    }

    return result;
  };

  const parsedAnalysis = parseAnalysis(analysisText);

  // Se não conseguiu parsear em seções, mostrar texto completo
  if (parsedAnalysis.fullText) {
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
          <div className="text-purple-900 whitespace-pre-line leading-relaxed">
            {parsedAnalysis.fullText}
          </div>
        </CardContent>
      </Card>
    );
  }

  const tabsData = [
    {
      id: "pontos-fortes",
      label: "Pontos Fortes",
      icon: TrendingUp,
      content: parsedAnalysis.pontosFortes,
      color: "text-green-600"
    },
    {
      id: "gaps",
      label: "Gaps a Trabalhar",
      icon: AlertTriangle,
      content: parsedAnalysis.gaps,
      color: "text-yellow-600"
    },
    {
      id: "recomendacoes",
      label: "Recomendações",
      icon: Target,
      content: parsedAnalysis.recomendacoes,
      color: "text-blue-600"
    },
    {
      id: "mensagem",
      label: "Mensagem Motivadora",
      icon: Heart,
      content: parsedAnalysis.mensagem,
      color: "text-purple-600"
    }
  ].filter(tab => tab.content); // Remove tabs sem conteúdo

  if (tabsData.length === 0) {
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
          <div className="text-purple-900 whitespace-pre-line leading-relaxed">
            {analysisText}
          </div>
        </CardContent>
      </Card>
    );
  }

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-white/50">
            {tabsData.map(tab => {
              const IconComponent = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id} 
                  className="flex flex-col items-center gap-1 p-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <IconComponent className={`h-4 w-4 ${tab.color}`} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {tabsData.map(tab => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4">
              <Card className="bg-white/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <tab.icon className={`h-4 w-4 ${tab.color}`} />
                    {tab.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-purple-900 whitespace-pre-line leading-relaxed">
                    {tab.content}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}