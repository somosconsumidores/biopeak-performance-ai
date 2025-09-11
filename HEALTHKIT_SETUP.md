# Configuração HealthKit para BioPeak

Este guia mostra como completar a integração real do HealthKit no BioPeak.

## 📱 Pré-requisitos

- Dispositivo iOS (iPhone/Apple Watch)
- Xcode instalado (apenas macOS)
- Conta Apple Developer

## 🚀 Passos de Instalação

### 1. Instalar Dependência HealthKit

```bash
# Fix date-fns version first
npm install date-fns@^3.6.0

# Clean install to resolve conflicts
rm -rf node_modules package-lock.json
npm install

# Install HealthKit plugin (compatible fork)
npm install @felipeclopes/capacitor-healthkit

# Sync with iOS
npx cap sync ios
```

### 2. Configurar iOS Project

Após executar `npm run build` e `npx cap sync ios`:

#### 2.1. Atualizar Info.plist
Os arquivos `ios/App/App/Info.plist` e `ios/App/App/App.entitlements` já foram criados com as permissões necessárias.

#### 2.2. Abrir no Xcode
```bash
npx cap open ios
```

#### 2.3. Configurar Capabilities no Xcode

1. Selecione o projeto "App" no navegador
2. Vá para a aba "Signing & Capabilities"
3. Clique no botão "+" para adicionar capabilities
4. Adicione "HealthKit"
5. Marque as seguintes opções:
   - ✅ Clinical Health Records
   - ✅ Background Delivery
   - ✅ Steps
   - ✅ Distance
   - ✅ Heart Rate
   - ✅ Active Energy
   - ✅ Workout Types

### 3. Integração de Código

O código foi atualizado para usar `@felipeclopes/capacitor-healthkit` através de uma biblioteca wrapper:

- `src/lib/healthkit.ts` - Wrapper do HealthKit que lida com dispositivo real e desenvolvimento
- `src/types/healthkit.ts` - Atualizado para re-exportar do wrapper  
- Hooks atualizados para usar o novo wrapper

A integração detecta automaticamente se você está em um dispositivo iOS real ou em desenvolvimento e usa a implementação apropriada.

### 4. Testar Integração

1. Execute `npm run build`
2. Execute `npx cap sync ios`
3. Execute `npx cap run ios` ou abra o projeto no Xcode
4. Teste no dispositivo físico (HealthKit não funciona no simulador)

## 📋 Funcionalidades Implementadas

### ✅ Autenticação HealthKit
- Solicitação de permissões
- Verificação de suporte
- Status de conexão

### ✅ Sincronização de Dados
- Workouts dos últimos 30 dias
- Dados de frequência cardíaca
- Calorias queimadas
- Distância e duração

### ✅ Armazenamento
- Tabela `healthkit_activities`
- Integração com `all_activities`
- Edge function para processamento

### ✅ Interface do Usuário
- Componente de status de conexão
- Botões para conectar/sincronizar
- Feedback visual do processo

## 🔧 Troubleshooting

### Erro "Module not found"
- Certifique-se de que executou `npm install @felipeclopes/capacitor-healthkit`
- Execute `npx cap sync ios` após a instalação

### Permissões Negadas
- Vá em Configurações > Privacidade e Segurança > Saúde > BioPeak
- Ative as permissões necessárias

### Dados Não Aparecem
- Verifique se há atividades no app Saúde do iOS
- Teste a sincronização manualmente
- Verifique os logs no console

## 📱 Testando no Dispositivo

1. Conecte um iPhone físico
2. Configure certificado de desenvolvedor
3. Execute o build direto no dispositivo
4. Abra o app e permita acesso ao HealthKit
5. Execute uma atividade no Apple Watch
6. Teste a sincronização no BioPeak

## 🔄 Sincronização Automática

O sistema está configurado para:
- Sincronizar na inicialização do app
- Sincronizar a cada hora (background)
- Permitir sincronização manual

## 📊 Dados Suportados

- **Workouts**: Corrida, Caminhada, Ciclismo, Natação
- **Métricas**: Duração, Distância, Calorias, FC
- **Dispositivos**: Apple Watch, iPhone
- **Período**: Últimos 30 dias

O sistema foi projetado para ser robusto e handle casos de erro graciosamente.