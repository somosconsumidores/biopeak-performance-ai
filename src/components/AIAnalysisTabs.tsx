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
    // Padrões melhorados para identificar as seções no texto da IA
    const patterns = {
      // Busca por **PONTOS FORTES:** ou variações
      pontosFortes: /\*\*\s*(?:pontos?\s+fortes?|qualidades?|força|virtudes?)\s*[:*]*\*\*\s*([^]*?)(?=\*\*\s*(?:gaps?|lacunas?|pontos?\s+fracos?|melhorar|aspectos?\s+a\s+desenvolver|recomendaç|sugest|treino|plano|estratégi|mensagem|motivaç)|$)/i,
      
      // Busca por **GAPS A TRABALHAR:** ou variações
      gaps: /\*\*\s*(?:gaps?\s+a?\s+trabalhar|lacunas?|pontos?\s+fracos?|melhorar|aspectos?\s+a\s+desenvolver)\s*[:*]*\*\*\s*([^]*?)(?=\*\*\s*(?:recomendaç|sugest|treino|plano|estratégi|mensagem|motivaç)|$)/i,
      
      // Busca por **RECOMENDAÇÕES:** ou variações
      recomendacoes: /\*\*\s*(?:recomendaç|sugest|treino|plano|estratégi)\s*[:*]*\*\*\s*([^]*?)(?=\*\*\s*(?:mensagem|motivaç|conclusão|final)|$)/i,
      
      // Busca por **MENSAGEM MOTIVADORA:** ou variações
      mensagem: /\*\*\s*(?:mensagem|motivaç|conclusão|final)\s*[:*]*\*\*\s*([^]*?)$/i
    };

    const result: ParsedAnalysis = {};
    
    // Tentar extrair cada seção
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let content = match[1].trim();
        
        // Remove formatação markdown residual dos cabeçalhos
        content = content.replace(/^\*\*[^*]+\*\*\s*/g, '');
        content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
        
        if (content.length > 10) { // Só considerar se tiver conteúdo substancial
          result[key as keyof ParsedAnalysis] = content;
        }
      }
    }

    // Fallback: se não conseguiu extrair seções específicas, tenta patterns mais flexíveis
    if (!result.pontosFortes && !result.gaps && !result.recomendacoes && !result.mensagem) {
      // Tenta dividir por parágrafos se contém palavras-chave
      const paragraphs = text.split(/\n\s*\n/);
      
      for (const paragraph of paragraphs) {
        const lowerPara = paragraph.toLowerCase();
        
        if (!result.pontosFortes && (lowerPara.includes('parabéns') || lowerPara.includes('pontos fortes') || lowerPara.includes('histórico impressionante'))) {
          result.pontosFortes = paragraph.trim();
        } else if (!result.gaps && (lowerPara.includes('embora') || lowerPara.includes('gaps') || lowerPara.includes('precisamos abordar'))) {
          result.gaps = paragraph.trim();
        } else if (!result.recomendacoes && (lowerPara.includes('aumente') || lowerPara.includes('recomenda') || lowerPara.includes('inclua treinos'))) {
          result.recomendacoes = paragraph.trim();
        } else if (!result.mensagem && (lowerPara.includes('motivadora') || lowerPara.includes('acredite') || lowerPara.includes('confie'))) {
          result.mensagem = paragraph.trim();
        }
      }
    }

    // Se ainda não conseguiu extrair nenhuma seção específica, usar o texto completo
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