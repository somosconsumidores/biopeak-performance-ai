import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Política de Privacidade do BioPeak
          </h1>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Introdução</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>
                Esta Política de Privacidade descreve como o BioPeak coleta, utiliza, compartilha e protege suas informações pessoais. Também explica os seus direitos e as opções disponíveis para controlar a sua privacidade. Ao utilizar o BioPeak, você concorda com os termos aqui descritos. Recomendamos também a leitura dos nossos Termos de Uso, que regulam o uso dos nossos serviços.
              </p>
              <p>
                O BioPeak é um aplicativo voltado para o monitoramento e aprimoramento da performance esportiva com base em dados biométricos. Nós levamos a sua privacidade a sério e adotamos medidas para protegê-la.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo de Privacidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Coleta, uso e compartilhamento de dados</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-3 text-left">Declaração</th>
                          <th className="border border-border p-3 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-3">Vendemos suas informações pessoais por valor monetário?</td>
                          <td className="border border-border p-3 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Vendemos informações agregadas por valor monetário?</td>
                          <td className="border border-border p-3 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Compartilhamos suas informações pessoais com terceiros que não sejam prestadores de serviços?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Compartilhamos suas informações pessoais para publicidade direcionada?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Usamos categorias de dados confidenciais, como informações de saúde?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Oferecemos proteções de privacidade adicionais para menores de idade (usuários menores de 18 anos)?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Usamos sua lista de contatos?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Excluímos suas informações pessoais quando você solicita a exclusão da conta?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, a menos que necessário por lei</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Reteremos seus dados após a exclusão da conta?</td>
                          <td className="border border-border p-3 font-semibold text-red-600">Não, exceto se exigido por lei</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Controles de Privacidade</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-3 text-left">Declaração</th>
                          <th className="border border-border p-3 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-3">Você pode controlar quem vê sua atividade e conteúdo?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Você pode controlar quem vê sua atividade baseada em localização?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Seus controles de privacidade de atividade e perfil são públicos (definidos como "Todos") por padrão?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, se tiver 18 anos ou mais</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Você pode baixar e excluir suas informações pessoais?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Todos os usuários têm o mesmo conjunto de controles de privacidade?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Rastreamento e Cookies</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-3 text-left">Declaração</th>
                          <th className="border border-border p-3 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-3">Rastrearemos a localização do seu dispositivo enquanto você não estiver usando o app?</td>
                          <td className="border border-border p-3 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Rastrearemos a localização do seu dispositivo para oferecer os serviços do BioPeak?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Usamos cookies e tecnologias semelhantes não essenciais?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Rastrearemos suas atividades de navegação em outros sites?</td>
                          <td className="border border-border p-3 font-semibold text-red-600">Não</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Ouvimos você usando o microfone do dispositivo?</td>
                          <td className="border border-border p-3 font-semibold text-red-600">Não</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Comunicação com Usuários</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-3 text-left">Declaração</th>
                          <th className="border border-border p-3 text-left">Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-3">Avisaremos antes de fazer alterações importantes nesta Política de Privacidade?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Enviaremos comunicações de marketing para você?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, exceto se recusado ou mediante consentimento expresso</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-3">Enviaremos notificações push em dispositivos móveis?</td>
                          <td className="border border-border p-3 font-semibold text-green-600">Sim, com o seu consentimento</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Se você tiver dúvidas sobre esta Política de Privacidade ou quiser exercer seus direitos de privacidade, entre em contato com nossa equipe de suporte através do e-mail: <a href="mailto:relacionamento@consumo-inteligente.com" className="text-primary underline">relacionamento@consumo-inteligente.com</a>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atualizações</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Esta Política poderá ser atualizada periodicamente. Caso façamos mudanças significativas, você será informado por meio do aplicativo ou por outros meios apropriados.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}