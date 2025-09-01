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
    console.log('Parsing AI analysis text:', text.substring(0, 200) + '...');
    
    const result: ParsedAnalysis = {};
    
    // Primeiro, tenta extrair seções com cabeçalhos em negrito
    const boldHeaderPatterns = [
      { key: 'pontosFortes', pattern: /\*\*\s*(?:PONTOS?\s+FORTES?|QUALIDADES?|FORÇA|VIRTUDES?)\s*[:*]*\*\*\s*([^]*?)(?=\*\*\s*(?:GAPS?|LACUNAS?|RECOMENDAÇ|MENSAGEM|MOTIVAÇ|$))/i },
      { key: 'gaps', pattern: /\*\*\s*(?:GAPS?\s+A?\s+TRABALHAR|LACUNAS?|PONTOS?\s+FRACOS?|ASPECTOS?\s+A\s+DESENVOLVER)\s*[:*]*\*\*\s*([^]*?)(?=\*\*\s*(?:RECOMENDAÇ|SUGEST|TREINO|PLANO|MENSAGEM|MOTIVAÇ|$))/i },
      { key: 'recomendacoes', pattern: /\*\*\s*(?:RECOMENDAÇ|SUGEST|TREINO|PLANO|ESTRATÉGI)\s*[:*]*\*\*\s*([^]*?)(?=\*\*\s*(?:MENSAGEM|MOTIVAÇ|CONCLUSÃO|FINAL|$))/i },
      { key: 'mensagem', pattern: /\*\*\s*(?:MENSAGEM|MOTIVAÇ|CONCLUSÃO|FINAL)\s*(?:MOTIVADORA)?\s*[:*]*\*\*\s*([^]*?)$/i }
    ];

    for (const { key, pattern } of boldHeaderPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let content = match[1].trim();
        // Remove formatação markdown residual
        content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
        if (content.length > 10) {
          result[key as keyof ParsedAnalysis] = content;
          console.log(`Found section ${key}:`, content.substring(0, 50) + '...');
        }
      }
    }

    // Se não encontrou seções com cabeçalhos em negrito, tenta uma abordagem mais flexível
    if (Object.keys(result).length === 0) {
      console.log('No bold headers found, trying flexible parsing...');
      
      // Divide por parágrafos duplos
      const sections = text.split(/\n\s*\n+/);
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        const lowerSection = section.toLowerCase();
        
        // Identifica seções por palavras-chave características
        if (!result.pontosFortes && (
          lowerSection.includes('parabéns') || 
          lowerSection.includes('histórico impressionante') ||
          lowerSection.includes('você tem um') ||
          lowerSection.includes('boa marca') ||
          lowerSection.includes('resistência e velocidade')
        )) {
          result.pontosFortes = section;
          console.log('Found pontosFortes by keywords');
        } else if (!result.gaps && (
          lowerSection.includes('embora') || 
          lowerSection.includes('gaps que precisam') ||
          lowerSection.includes('principal deles') ||
          lowerSection.includes('precisamos abordar')
        )) {
          result.gaps = section;
          console.log('Found gaps by keywords');
        } else if (!result.recomendacoes && (
          lowerSection.includes('aumente gradualmente') ||
          lowerSection.includes('inclua treinos') ||
          lowerSection.includes('trabalhe na recuperação') ||
          lowerSection.includes('•') && lowerSection.length > 100
        )) {
          result.recomendacoes = section;
          console.log('Found recomendacoes by keywords');
        } else if (!result.mensagem && (
          lowerSection.includes('acredite') ||
          lowerSection.includes('confie') ||
          lowerSection.includes('disciplina') ||
          (i === sections.length - 1 && section.length > 50) // última seção como fallback
        )) {
          result.mensagem = section;
          console.log('Found mensagem by keywords or position');
        }
      }
    }

    // Se ainda não conseguiu extrair seções, usar texto completo
    if (Object.keys(result).length === 0) {
      console.log('Using full text as fallback');
      result.fullText = text;
    } else {
      console.log('Successfully parsed sections:', Object.keys(result));
    }

    return result;
  };

  const parsedAnalysis = parseAnalysis(analysisText);

  // Se não conseguiu parsear em seções, mostrar texto completo formatado
  if (parsedAnalysis.fullText) {
    const formatTextWithHighlights = (text: string) => {
      // Divide o texto em seções baseado nos cabeçalhos
      const sections = text.split(/(?=(?:Principais gaps|Recomendações práticas|Mensagem motivadora))/i);
      
      return sections.map((section, index) => {
        const trimmedSection = section.trim();
        if (!trimmedSection) return null;
        
        // Verifica se é uma seção especial
        if (trimmedSection.toLowerCase().includes('principais gaps')) {
          return (
            <div key={index} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-bold text-purple-800">Principais gaps a serem trabalhados</h3>
              </div>
              <div className="text-purple-900 leading-relaxed pl-7">
                {trimmedSection.replace(/principais gaps a serem trabalhados/i, '').trim()}
              </div>
            </div>
          );
        }
        
        if (trimmedSection.toLowerCase().includes('recomendações práticas')) {
          return (
            <div key={index} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-purple-800">Recomendações práticas de treino</h3>
              </div>
              <div className="text-purple-900 leading-relaxed pl-7">
                {trimmedSection.replace(/recomendações práticas de treino/i, '').trim()}
              </div>
            </div>
          );
        }
        
        if (trimmedSection.toLowerCase().includes('mensagem motivadora')) {
          return (
            <div key={index} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-bold text-purple-800">Mensagem motivadora</h3>
              </div>
              <div className="text-purple-900 leading-relaxed pl-7">
                {trimmedSection.replace(/mensagem motivadora/i, '').trim()}
              </div>
            </div>
          );
        }
        
        // Para outras seções (como Pontos Fortes), mantém formatação padrão mas com destaque se for o início
        if (index === 0 || trimmedSection.toLowerCase().includes('pontos fortes')) {
          return (
            <div key={index} className="mb-6">
              {trimmedSection.toLowerCase().includes('pontos fortes') && (
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-bold text-purple-800">Pontos Fortes</h3>
                </div>
              )}
              <div className="text-purple-900 leading-relaxed pl-7">
                {trimmedSection.replace(/pontos fortes/i, '').trim()}
              </div>
            </div>
          );
        }
        
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
            {formatTextWithHighlights(parsedAnalysis.fullText)}
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