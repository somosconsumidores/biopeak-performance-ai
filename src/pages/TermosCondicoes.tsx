import { useTranslation } from '@/hooks/useTranslation';

export const TermosCondicoes = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-primary bg-clip-text text-transparent">
          Termos e Condições da Assinatura
        </h1>
        
        <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-foreground">
          <p>
            Ao optar por assinar o plano pro de BioPeak você está aderindo a uma plataforma que acredita que a evolução da performance de um atleta é feita com base em dados. Hoje, com mais de 1.200 mil atletas na plataforma, nos orgulhamos de promover a filosofia do treino com orientação e responsabilidade, onde o atleta entende suas métricas e os limites do seu corpo.
          </p>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">DOS NOSSOS SERVIÇOS</h2>
            <p>
              O assinante do plano pro BioPeak conta com uma série de análises exclusivas que irão sempre ajudar o atleta a evoluir de forma consistente. Por exemplo, ao assinar o plano pro, você terá acesso imediato as seguintes análises:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>análise do risco de overtraining com base em seu histórico de atividades</li>
              <li>biopeak fitness score, que é o score criado por nós e que permite acompanhar a sua evolução com base em uma única métrica</li>
              <li>análise do sono, caso você use um wearable durante suas noites de sono</li>
              <li>análise individual treino a treino, onde você pode saber o que funcionou bem, o que não funcionou bem e onde pode melhorar</li>
              <li>calendário de provas onde acompanhamos a sua preparação e te ajudamos a atingir os seus objetivos almejados para a prova</li>
              <li>insights gerais sobre sua performance olhando um histórico de 30 dias de atividades</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">DOS NOSSOS VALORES</h2>
            <p>
              Excelência e Proximidade. Nossa missão exige excelência em nossas análises e proximidade no acompanhamento da evolução do atleta. Nossas análises provêm de nosso próprio conhecimento. Devemos atender as expectativas de nossos atletas e evoluir para oferecer análises cada vez mais modernas e úteis. O êxito de nossa missão é condicionado pela evolução real de nossos atletas.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">DA FORMA DE PAGAMENTO DA ANUIDADE</h2>
            <p>
              Lembre-se que o plano pro BioPeak é uma assinatura de uso contínuo, devendo ser confirmado através do pagamento de uma mensalidade. O pagamento é feito todo mês. O seu vínculo com BioPeak é contínuo e a cobrança será feita de forma automática e sem prévio aviso, até sua ordem em contrário.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">DA COBRANÇA</h2>
            <p>
              A cobrança da sua mensalidade será feita em seu cartão de crédito, que deverá estar vigente no momento da assinatura. Caso deseje alterar seu cartão de crédito, entre em contato através de nosso canal oficial de atendimento (relacionamento@biopeak-ai.com). O valor da assinatura será reajustado anualmente pelo IGP-M.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">DO CANCELAMENTO DA ASSINATURA</h2>
            <p>
              Suas mensalidades serão cobradas regularmente, até sua manifestação em contrário, conforme nosso compromisso com o atleta. Para efetivação do cancelamento da assinatura, é necessário seu contato com nossa central de atendimento através do e-mail relacionamento@biopeak-ai.com ou via cancelamento direto do débito em sua central de assinaturas da Apple.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">OFERTA</h2>
            <p>
              Todo atleta, inclusive os mais antigos, tem direito de aderir a qualquer oferta vigente da BioPeak, sem distinção fundada na data de adesão.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
