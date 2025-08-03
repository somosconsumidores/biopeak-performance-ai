import { useEffect, useState } from 'react';

type Language = 'pt' | 'en';

interface Translations {
  [key: string]: {
    pt: string;
    en: string;
  };
}

const translations: Translations = {
  // Header navigation
  dashboard: { pt: 'Dashboard', en: 'Dashboard' },
  workouts: { pt: 'Treinos', en: 'Workouts' },
  insights: { pt: 'Insights', en: 'Insights' },
  profile: { pt: 'Perfil', en: 'Profile' },
  syncActivities: { pt: 'Sincronizar Atividades', en: 'Sync Activities' },
  logout: { pt: 'Sair', en: 'Logout' },
  login: { pt: 'Login', en: 'Login' },
  getStarted: { pt: 'Começar Agora', en: 'Get Started' },
  
  // Auth page
  welcomeBack: { pt: 'Bem-vindo de volta!', en: 'Welcome back!' },
  accountCreated: { pt: 'Conta criada!', en: 'Account created!' },
  emailSent: { pt: 'Email enviado!', en: 'Email sent!' },
  joinThousands: { pt: 'Junte-se a milhares de atletas que melhoram a cada dia', en: 'Join thousands of athletes improving every day' },
  signInToAccount: { pt: 'Entre na sua conta', en: 'Sign in to your account' },
  createAccount: { pt: 'Criar conta', en: 'Create account' },
  email: { pt: 'Email', en: 'Email' },
  password: { pt: 'Senha', en: 'Password' },
  confirmPassword: { pt: 'Confirmar Senha', en: 'Confirm Password' },
  signIn: { pt: 'Entrar', en: 'Sign In' },
  signUp: { pt: 'Cadastrar', en: 'Sign Up' },
  forgotPassword: { pt: 'Esqueceu sua senha?', en: 'Forgot your password?' },
  resetPassword: { pt: 'Redefinir Senha', en: 'Reset Password' },
  backToLogin: { pt: 'Voltar para login', en: 'Back to login' },
  dontHaveAccount: { pt: 'Não tem uma conta?', en: "Don't have an account?" },
  alreadyHaveAccount: { pt: 'Já tem uma conta?', en: 'Already have an account?' },
  
  // Landing page
  revolutionizeTraining: { pt: 'Revolucione Seu Treinamento com IA', en: 'Revolutionize Your Training with AI' },
  unlockPotential: { pt: 'Desbloqueie todo o seu potencial atlético com análises avançadas e insights personalizados', en: 'Unlock your full athletic potential with advanced analytics and personalized insights' },
  tryFree: { pt: 'Experimente Grátis', en: 'Try Free' },
  learnMore: { pt: 'Saiba Mais', en: 'Learn More' },
  smartAnalytics: { pt: 'Análises Inteligentes', en: 'Smart Analytics' },
  smartAnalyticsDesc: { pt: 'IA avançada analisa seus dados de treino para fornecer insights acionáveis', en: 'Advanced AI analyzes your training data to provide actionable insights' },
  personalizedCoaching: { pt: 'Treinamento Personalizado', en: 'Personalized Coaching' },
  personalizedCoachingDesc: { pt: 'Receba recomendações personalizadas baseadas no seu histórico e objetivos', en: 'Get personalized recommendations based on your history and goals' },
  realTimeTracking: { pt: 'Acompanhamento em Tempo Real', en: 'Real-time Tracking' },
  realTimeTrackingDesc: { pt: 'Monitore seu progresso em tempo real com métricas detalhadas', en: 'Monitor your progress in real-time with detailed metrics' },
  
  // Dashboard
  welcomeTo: { pt: 'Bem-vindo ao', en: 'Welcome to' },
  latestActivity: { pt: 'Última Atividade', en: 'Latest Activity' },
  performanceOverview: { pt: 'Visão Geral da Performance', en: 'Performance Overview' },
  trainingRecommendations: { pt: 'Recomendações de Treino', en: 'Training Recommendations' },
  commitments: { pt: 'Compromissos', en: 'Commitments' },
  aiInsights: { pt: 'Insights de IA', en: 'AI Insights' },
  
  // Profile
  editProfile: { pt: 'Editar Perfil', en: 'Edit Profile' },
  personalInfo: { pt: 'Informações Pessoais', en: 'Personal Information' },
  name: { pt: 'Nome', en: 'Name' },
  birthDate: { pt: 'Data de Nascimento', en: 'Birth Date' },
  height: { pt: 'Altura', en: 'Height' },
  weight: { pt: 'Peso', en: 'Weight' },
  save: { pt: 'Salvar', en: 'Save' },
  cancel: { pt: 'Cancelar', en: 'Cancel' },
  
  // Common terms
  loading: { pt: 'Carregando...', en: 'Loading...' },
  error: { pt: 'Erro', en: 'Error' },
  success: { pt: 'Sucesso', en: 'Success' },
  noData: { pt: 'Nenhum dado disponível', en: 'No data available' },
  duration: { pt: 'Duração', en: 'Duration' },
  distance: { pt: 'Distância', en: 'Distance' },
  pace: { pt: 'Ritmo', en: 'Pace' },
  heartRate: { pt: 'Frequência Cardíaca', en: 'Heart Rate' },
  calories: { pt: 'Calorias', en: 'Calories' },
  elevation: { pt: 'Elevação', en: 'Elevation' },
  
  // Admin panel
  adminPanel: { pt: 'Painel Administrativo', en: 'Admin Panel' },
  tokenStats: { pt: 'Estatísticas de Tokens', en: 'Token Statistics' },
  userStats: { pt: 'Estatísticas de Usuários', en: 'User Statistics' },
  totalTokens: { pt: 'Total de Tokens', en: 'Total Tokens' },
  activeTokens: { pt: 'Tokens Ativos', en: 'Active Tokens' },
  expiredTokens: { pt: 'Tokens Expirados', en: 'Expired Tokens' },
  expiringSoon: { pt: 'Tokens a expirar em 4 horas', en: 'Tokens expiring in 4 hours' },
  totalUsers: { pt: 'Total de Usuários', en: 'Total Users' },
  usersWithValidTokens: { pt: 'Usuários com Token Válido', en: 'Users with Valid Tokens' },
  usersWithActivities: { pt: 'Usuários com Atividades', en: 'Users with Activities' },
  totalActivities: { pt: 'Total de Atividades', en: 'Total Activities' },
  usersWithCommitments: { pt: 'Usuários com Compromissos', en: 'Users with Commitments' },
  adminActions: { pt: 'Ações Administrativas', en: 'Admin Actions' },
  refreshData: { pt: 'Atualizar Dados', en: 'Refresh Data' },
  
  // Landing page content
  physicalTraining: { pt: 'Treino é Físico.', en: 'Training is Physical.' },
  evolutionInData: { pt: 'Evolução é nos Dados.', en: 'Evolution is in Data.' },
  heroDescription: { 
    pt: 'O primeiro app que usa IA para transformar seus dados de treino Garmin em estratégias inteligentes de performance. Porque treino é físico, mas evolução é nos dados.',
    en: 'The first app that uses AI to transform your Garmin training data into intelligent performance strategies. Because training is physical, but evolution is in data.'
  },
  watchDemo: { pt: 'Ver Demo', en: 'Watch Demo' },
  athletesRegistered: { pt: 'Atletas Registrados', en: 'Registered Athletes' },
  activitiesRegistered: { pt: 'Atividades Registradas', en: 'Registered Activities' },
  insightsProvided: { pt: 'Insights Fornecidos', en: 'Insights Provided' },
  goalsAssigned: { pt: 'Metas Atribuídas', en: 'Goals Assigned' },
  cuttingEdgeTech: { pt: 'Tecnologia de Ponta', en: 'Cutting-Edge Technology' },
  techDescription: {
    pt: 'Combinamos inteligência artificial avançada com dados precisos do Garmin para oferecer insights que nenhum outro app consegue.',
    en: 'We combine advanced artificial intelligence with precise Garmin data to offer insights that no other app can provide.'
  },
  intelligentAI: { pt: 'IA Inteligente', en: 'Intelligent AI' },
  aiDescription: { pt: 'Análise avançada dos seus treinos com machine learning para insights personalizados.', en: 'Advanced analysis of your workouts with machine learning for personalized insights.' },
  garminIntegration: { pt: 'Integração Garmin', en: 'Garmin Integration' },
  garminDescription: { pt: 'Sincronização automática com seus dispositivos Garmin para dados precisos.', en: 'Automatic synchronization with your Garmin devices for accurate data.' },
  continuousEvolution: { pt: 'Evolução Contínua', en: 'Continuous Evolution' },
  evolutionDescription: { pt: 'Acompanhe sua progressão com métricas detalhadas e recomendações.', en: 'Track your progression with detailed metrics and recommendations.' },
  smartGoals: { pt: 'Metas Inteligentes', en: 'Smart Goals' },
  goalsDescription: { pt: 'Definição automática de objetivos baseados no seu perfil e performance.', en: 'Automatic goal setting based on your profile and performance.' },
  whyBioPeak: { pt: 'Por que BioPeak?', en: 'Why BioPeak?' },
  whyDescription: {
    pt: 'Não somos apenas mais um app de treino. Somos a evolução da análise esportiva, transformando cada batimento cardíaco em estratégia de performance.',
    en: "We're not just another training app. We're the evolution of sports analysis, transforming every heartbeat into performance strategy."
  },
  readyToEvolve: { pt: 'Pronto para Evoluir?', en: 'Ready to Evolve?' },
  ctaDescription: {
    pt: 'Junte-se a milhares de atletas que já descobriram o poder da análise inteligente. Comece sua jornada para a performance máxima hoje.',
    en: 'Join thousands of athletes who have already discovered the power of intelligent analysis. Start your journey to maximum performance today.'
  },
  startFree: { pt: 'Começar Grátis', en: 'Start Free' },
  talkToExpert: { pt: 'Falar c/ Expert', en: 'Talk to Expert' },
  // Footer
  transformingTraining: { pt: 'Transformando treinos em estratégia com inteligência artificial.', en: 'Transforming workouts into strategy with artificial intelligence.' },
  product: { pt: 'Produto', en: 'Product' },
  aiAnalysis: { pt: 'Análise IA', en: 'AI Analysis' },
  support: { pt: 'Suporte', en: 'Support' },
  helpCenter: { pt: 'Central de Ajuda', en: 'Help Center' },
  documentation: { pt: 'Documentação', en: 'Documentation' },
  contact: { pt: 'Contato', en: 'Contact' },
  status: { pt: 'Status', en: 'Status' },
  company: { pt: 'Empresa', en: 'Company' },
  about: { pt: 'Sobre', en: 'About' },
  blog: { pt: 'Blog', en: 'Blog' },
  careers: { pt: 'Carreiras', en: 'Careers' },
  privacy: { pt: 'Privacidade', en: 'Privacy' },
  allRightsReserved: { pt: 'Todos os direitos reservados.', en: 'All rights reserved.' },
};

export const useTranslation = () => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('biopeak-language') as Language;
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return { t, language, setLanguage };
};