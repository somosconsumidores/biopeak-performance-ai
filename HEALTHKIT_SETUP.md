# 📱 Setup HealthKit - BioPeak (Plugin Customizado)

## Visão Geral

O BioPeak utiliza um plugin HealthKit customizado desenvolvido especificamente para capturar dados completos de treino do iOS, incluindo:

- **Workouts** (resumos de treino)
- **GPS Routes** (rotas completas com latitude, longitude, altitude)
- **Séries Temporais** (frequência cardíaca, energia, pace)
- **Integração completa** com análises de IA do BioPeak

## 🔧 Configuração

### 1. Plugin Nativo (Já Incluído)

O plugin customizado `BioPeakHealthKit` está incluído no projeto iOS:
- `ios/App/App/Plugins/BioPeakHealthKit.swift` - Implementação Swift
- `ios/App/App/Plugins/BioPeakHealthKit.m` - Bridge Objective-C

### 2. Configurar Projeto iOS

Após qualquer alteração no código nativo, execute:

```bash
# Sincronizar com iOS
npx cap sync ios

# Abrir no Xcode para configuração final
npx cap open ios
```

### 3. Configurar Permissões iOS

No **Xcode**, adicione as seguintes permissões no `Info.plist`:

```xml
<!-- HealthKit Permissions -->
<key>NSHealthShareUsageDescription</key>
<string>BioPeak precisa acessar seus dados de saúde para sincronizar e analisar suas atividades físicas do Apple Watch.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>BioPeak pode atualizar seus dados de saúde com informações de atividades.</string>

<!-- Location Permission (for GPS data) -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>BioPeak precisa acessar localização para capturar rotas GPS dos treinos.</string>
```

### 4. Configurar HealthKit Capability

No **Xcode**:
1. Selecione o target do projeto
2. Vá para **Signing & Capabilities**
3. Clique **+ Capability**
4. Adicione **HealthKit**
5. Configure as permissões:
   - ✅ **Clinical Health Records**
   - ✅ **Background Delivery**
   - ✅ **Workouts**
   - ✅ **Heart Rate**
   - ✅ **Active Energy**
   - ✅ **Distance**
   - ✅ **Steps**
   - ✅ **Workout Routes**

## 🚀 Funcionalidades Implementadas

### APIs Disponíveis

O plugin customizado oferece as seguintes APIs:

```typescript
// Solicitar permissões HealthKit
await HealthKit.requestAuthorization({
  read: ['workouts', 'heart_rate', 'calories', 'distance', 'steps'],
  write: []
});

// Buscar workouts dos últimos 30 dias
const workouts = await HealthKit.queryWorkouts();

// Buscar rota GPS de um workout específico
const locations = await HealthKit.queryWorkoutRoute(workoutUUID);

// Buscar séries temporais (HR, energia)
const series = await HealthKit.queryWorkoutSeries(workoutUUID, startDate, endDate);
```

### Dados Capturados

#### Resumo do Workout
- UUID único
- Tipo de atividade (corrida, caminhada, ciclismo, etc.)
- Data/hora de início e fim
- Duração total
- Distância percorrida
- Energia gasta (calorias)
- Dispositivo de origem

#### Rota GPS
- Coordenadas (latitude, longitude)
- Altitude
- Timestamp de cada ponto
- Velocidade instantânea
- Precisão horizontal/vertical
- Direção (course)

#### Séries Temporais
- **Frequência Cardíaca**: valores ao longo do tempo
- **Energia**: consumo acumulado de calorias
- **Timestamps**: sincronização temporal precisa

### Integração com Supabase

Os dados são salvos nas seguintes tabelas:

```sql
-- Atividades principais
healthkit_activities

-- Coordenadas GPS
activity_coordinates (activity_source = 'healthkit')

-- Cache para gráficos
activity_chart_cache (activity_source = 'healthkit')

-- Status de sincronização
healthkit_sync_status
```

## 📊 Análises de IA Suportadas

Com os dados completos capturados, o BioPeak pode realizar:

- **Cálculo de VO₂max** baseado em GPS e frequência cardíaca
- **Análise de pace zones** e eficiência
- **Predição de performance** usando séries temporais
- **Detecção de padrões** em rotas e métricas
- **Comparação entre atividades** com dados precisos

## 🧪 Teste da Implementação

### Teste em Dispositivo Físico (Obrigatório)

⚠️ **HealthKit só funciona em dispositivos iOS reais, não no simulador**

1. Conecte um iPhone/Apple Watch
2. Execute o projeto via Xcode
3. Permita acesso ao HealthKit quando solicitado
4. Execute uma sincronização de teste

### Validação dos Dados

```typescript
// Hook para sincronização
import { useHealthKitSync } from '@/hooks/useHealthKitSync';

const { syncActivities, isLoading, lastSyncResult } = useHealthKitSync();

// Executar sincronização
const result = await syncActivities();
console.log('Sincronizado:', result.syncedCount, 'atividades');
```

## 🔧 Troubleshooting

### HealthKit não Disponível
- Verifique se está executando em dispositivo iOS real
- Confirme que o HealthKit capability foi adicionado no Xcode

### Permissões Negadas
- Vá para **Configurações** → **Privacidade** → **Saúde** → **BioPeak**
- Ative todas as permissões necessárias

### GPS/Rotas não Aparecem
- Verifique permissão de localização
- Confirme que o treino foi feito com GPS ativo no Apple Watch
- Alguns treinos indoor não têm dados de rota (normal)

### Dados não Sincronizam
- Verifique logs no console do Xcode
- Confirme conectividade com Supabase
- Execute `npx cap sync ios` após mudanças

## 🔮 Próximos Passos

### Android Health Connect
A arquitetura está preparada para adicionar suporte ao Android Health Connect, mantendo a mesma interface unificada.

### Expansão de Métricas
O plugin pode ser facilmente estendido para capturar:
- SpO₂ (saturação de oxigênio)
- Dados de sono
- Variabilidade da frequência cardíaca (HRV)
- Dados de recuperação

---

**✅ Plugin customizado totalmente funcional**  
**✅ Dados completos para análises de IA**  
**✅ Zero custos recorrentes**  
**✅ Controle total da implementação**