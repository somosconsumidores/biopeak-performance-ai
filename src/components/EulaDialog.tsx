import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EulaDialogProps {
  trigger: React.ReactNode;
}

export const EulaDialog = ({ trigger }: EulaDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold">
            Contrato de Licença de Usuário Final
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] p-6 pt-4">
          <div className="space-y-6 text-sm leading-relaxed">
            <div>
              <h3 className="font-bold mb-3">CONTRATO DE LICENÇA DE USUÁRIO FINAL DE APLICATIVO LICENCIADO</h3>
              <p className="mb-4">
                Os aplicativos disponibilizados pela App Store são licenciados, não vendidos, a você. Sua licença para cada Aplicativo está sujeita à sua aceitação prévia de um Contrato de Licença de Usuário Final de Aplicativo Licenciado ("EULA Padrão") ou de um contrato de licença de usuário final personalizado entre você e o Provedor do Aplicativo ("EULA Personalizado"), caso seja fornecido.
              </p>
              <p className="mb-4">
                Sua licença para qualquer Aplicativo Apple sob este EULA Padrão ou EULA Personalizado é concedida pela Apple, e sua licença para qualquer Aplicativo de Terceiros sob este EULA Padrão ou EULA Personalizado é concedida pelo Provedor do Aplicativo desse Aplicativo de Terceiros. Qualquer Aplicativo sujeito a este EULA Padrão é referido neste documento como "Aplicativo Licenciado". O Provedor do Aplicativo ou a Apple, conforme aplicável ("Licenciante"), reserva todos os direitos sobre o Aplicativo Licenciado que não sejam expressamente concedidos a você sob este EULA Padrão.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">a. Escopo da Licença</h4>
              <p className="mb-4">
                O Licenciante concede a você uma licença intransferível para usar o Aplicativo Licenciado em quaisquer produtos de marca Apple que você possua ou controle e conforme permitido pelas Regras de Uso.
              </p>
              <p className="mb-4">
                Os termos deste EULA Padrão regerão qualquer conteúdo, materiais ou serviços acessíveis a partir do Aplicativo Licenciado ou adquiridos dentro dele, bem como upgrades fornecidos pelo Licenciante que substituam ou complementem o Aplicativo Licenciado original, a menos que tal upgrade seja acompanhado de um EULA Personalizado.
              </p>
              <p className="mb-4">
                Exceto conforme previsto nas Regras de Uso, você não pode distribuir ou disponibilizar o Aplicativo Licenciado em uma rede onde possa ser usado por múltiplos dispositivos ao mesmo tempo. Você não pode transferir, redistribuir ou sublicenciar o Aplicativo Licenciado e, caso venda seu Dispositivo Apple a um terceiro, deverá remover o Aplicativo Licenciado antes de fazê-lo.
              </p>
              <p className="mb-4">
                Você não pode copiar (exceto conforme permitido por esta licença e pelas Regras de Uso), realizar engenharia reversa, desmontar, tentar derivar o código-fonte, modificar ou criar trabalhos derivados do Aplicativo Licenciado, de quaisquer updates ou de qualquer parte dele (exceto na medida em que tal restrição seja proibida pela lei aplicável ou permitida pelos termos de licenciamento de componentes de código aberto incluídos no Aplicativo Licenciado).
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">b. Consentimento para Uso de Dados</h4>
              <p className="mb-4">
                Você concorda que o Licenciante pode coletar e usar dados técnicos e informações relacionadas — incluindo, mas não se limitando, a informações técnicas sobre seu dispositivo, sistema, software do aplicativo e periféricos — que sejam coletadas periodicamente para facilitar a prestação de atualizações de software, suporte a produtos e outros serviços a você (se houver) relacionados ao Aplicativo Licenciado.
              </p>
              <p className="mb-4">
                O Licenciante poderá usar essas informações, desde que em formato que não identifique você pessoalmente, para melhorar seus produtos ou fornecer serviços ou tecnologias.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">c. Rescisão</h4>
              <p className="mb-4">
                Este EULA Padrão é válido até ser rescindido por você ou pelo Licenciante. Seus direitos sob este EULA Padrão serão rescindidos automaticamente caso você não cumpra com qualquer um de seus termos.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">d. Serviços Externos</h4>
              <p className="mb-4">
                O Aplicativo Licenciado pode permitir acesso a serviços e websites do Licenciante e/ou de terceiros (coletivamente e individualmente, "Serviços Externos"). Você concorda em usar os Serviços Externos por sua conta e risco.
              </p>
              <p className="mb-4">
                O Licenciante não é responsável por examinar ou avaliar o conteúdo ou a precisão de quaisquer Serviços Externos de terceiros e não será responsável por tais Serviços Externos.
              </p>
              <p className="mb-4">
                Dados exibidos por qualquer Aplicativo Licenciado ou Serviço Externo, incluindo, mas não se limitando a informações financeiras, médicas e de localização, são apenas para fins informativos gerais e não são garantidos pelo Licenciante ou seus agentes.
              </p>
              <p className="mb-4">
                Você não usará os Serviços Externos de maneira inconsistente com este EULA Padrão ou que infrinja direitos de propriedade intelectual do Licenciante ou de terceiros. Você concorda em não usar os Serviços Externos para assediar, abusar, perseguir, ameaçar ou difamar qualquer pessoa ou entidade, e reconhece que o Licenciante não é responsável por qualquer uso desse tipo.
              </p>
              <p className="mb-4">
                Os Serviços Externos podem não estar disponíveis em todos os idiomas ou em seu país de residência, e podem não ser apropriados ou disponíveis para uso em determinado local. Caso você opte por usá-los, será o único responsável por cumprir as leis aplicáveis.
              </p>
              <p className="mb-4">
                O Licenciante reserva o direito de alterar, suspender, remover, desabilitar ou impor restrições de acesso a quaisquer Serviços Externos a qualquer momento, sem aviso prévio ou responsabilidade.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">e. AUSÊNCIA DE GARANTIA</h4>
              <p className="mb-4 font-semibold">
                VOCÊ RECONHECE E CONCORDA EXPRESSAMENTE QUE O USO DO APLICATIVO LICENCIADO É POR SUA CONTA E RISCO.
              </p>
              <p className="mb-4">
                Na máxima extensão permitida pela lei aplicável, o Aplicativo Licenciado e quaisquer serviços prestados ou fornecidos por ele são disponibilizados "NO ESTADO EM QUE SE ENCONTRAM" e "CONFORME DISPONÍVEIS", com todas as falhas e sem garantias de qualquer tipo.
              </p>
              <p className="mb-4">
                O Licenciante se isenta de todas as garantias, expressas, implícitas ou legais, incluindo, mas não se limitando, às garantias implícitas de comercialização, qualidade satisfatória, adequação a uma finalidade específica, precisão, desfrute pacífico e não violação de direitos de terceiros.
              </p>
              <p className="mb-4">
                Nenhuma informação ou conselho, oral ou escrito, fornecido pelo Licenciante ou por representante autorizado criará qualquer garantia.
              </p>
              <p className="mb-4">
                Se o Aplicativo Licenciado ou serviços se mostrarem defeituosos, você assumirá todos os custos de manutenção, reparo ou correção necessários.
              </p>
              <p className="mb-4">
                Algumas jurisdições não permitem a exclusão de garantias implícitas, de modo que a exclusão acima pode não se aplicar a você.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">f. Limitação de Responsabilidade</h4>
              <p className="mb-4">
                Na medida em que não seja proibido por lei, em nenhum caso o Licenciante será responsável por lesões pessoais ou quaisquer danos incidentais, especiais, indiretos ou consequenciais de qualquer tipo, incluindo, sem limitação, perda de lucros, perda de dados, interrupção de negócios ou quaisquer outros prejuízos comerciais, decorrentes ou relacionados ao uso ou incapacidade de usar o Aplicativo Licenciado, independentemente da teoria de responsabilidade (contrato, ato ilícito ou outro), mesmo que o Licenciante tenha sido avisado da possibilidade de tais danos.
              </p>
              <p className="mb-4">
                Em nenhum caso a responsabilidade total do Licenciante para com você por todos os danos (exceto quando exigido pela lei aplicável em casos de lesão pessoal) excederá cinquenta dólares (US$ 50,00).
              </p>
              <p className="mb-4">
                As limitações acima se aplicarão mesmo que a solução apresentada não cumpra sua finalidade essencial.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">g. Exportação</h4>
              <p className="mb-4">
                Você não poderá usar ou exportar/reexportar o Aplicativo Licenciado, exceto conforme autorizado pela legislação dos Estados Unidos e pelas leis da jurisdição em que o Aplicativo foi obtido.
              </p>
              <p className="mb-4">
                Em particular, o Aplicativo Licenciado não pode ser exportado ou reexportado para (a) países sob embargo dos EUA ou (b) indivíduos presentes nas listas do Departamento do Tesouro dos EUA (Specially Designated Nationals) ou do Departamento de Comércio dos EUA (Denied Persons List ou Entity List).
              </p>
              <p className="mb-4">
                Ao usar o Aplicativo Licenciado, você declara e garante que não se encontra em nenhum desses países nem em tais listas. Você também concorda em não usar esses produtos para fins proibidos pela legislação dos EUA, incluindo, sem limitação, desenvolvimento, design, fabricação ou produção de armas nucleares, mísseis ou químicas/biológicas.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">h. Itens Comerciais</h4>
              <p className="mb-4">
                O Aplicativo Licenciado e a documentação associada são "Itens Comerciais", conforme definido em 48 C.F.R. §2.101, consistindo em "Software Comercial de Computador" e "Documentação de Software Comercial de Computador". Esses itens são licenciados a usuários finais do Governo dos EUA apenas como Itens Comerciais, com apenas os direitos concedidos a todos os outros usuários, de acordo com este EULA.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-3">i. Lei Aplicável</h4>
              <p className="mb-4">
                Exceto na medida em que seja expressamente previsto no parágrafo seguinte, este EULA e a relação entre você e a Apple serão regidos pelas leis do Estado da Califórnia, EUA, excluindo suas disposições sobre conflitos de leis.
              </p>
              <p className="mb-4">
                Você e a Apple concordam em submeter-se à jurisdição pessoal e exclusiva dos tribunais localizados no condado de Santa Clara, Califórnia, para resolver qualquer disputa decorrente deste EULA.
              </p>
              <p className="mb-4">
                Se:
                <br />
                (a) você não for cidadão dos EUA;
                <br />
                (b) não residir nos EUA;
                <br />
                (c) não acessar o Serviço a partir dos EUA; e
                <br />
                (d) for cidadão de um dos países listados abaixo,
                <br />
                então qualquer disputa decorrente deste EULA será regida pela lei aplicável estabelecida abaixo, e você se submete irrevogavelmente à jurisdição não exclusiva dos tribunais localizados no estado, província ou país correspondente:
              </p>
              <p className="mb-4">
                Se você for cidadão de qualquer país da União Europeia, Suíça, Noruega ou Islândia, a lei e o foro aplicáveis serão os de sua residência habitual.
              </p>
              <p className="mb-4">
                Fica expressamente excluída a aplicação da Convenção das Nações Unidas sobre Contratos de Venda Internacional de Mercadorias.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};