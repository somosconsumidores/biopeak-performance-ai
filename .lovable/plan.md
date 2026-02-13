
# Novo Step: Dados Biometricos no Wizard de Plano de Treino

## O que sera feito

Adicionar um novo step obrigatorio como o **primeiro passo apos a selecao de esporte** no wizard de criacao de plano de treino, coletando altura (cm), peso (kg) e data de nascimento. Estas informacoes sao essenciais para calcular zonas de frequencia cardiaca, taxa metabolica basal e personalizar intensidades de treino.

## Mudancas planejadas

### 1. Novo componente: `src/components/wizard-steps/BiometricsStep.tsx`
- Campos obrigatorios: altura (cm, input numerico, range 100-250), peso (kg, input numerico, range 30-300), data de nascimento (date picker)
- Pre-preencher com dados do perfil do usuario caso ja existam (via `useProfile`)
- Mensagem explicativa: "Estas informacoes sao essenciais para criarmos um plano personalizado - calculamos suas zonas de treino, taxa metabolica e intensidades ideais com base nestes dados"
- Validacao: todos os 3 campos obrigatorios para prosseguir

### 2. Atualizar `TrainingPlanWizardData` em `src/hooks/useTrainingPlanWizard.ts`
- Adicionar campos `heightCm?: number` e `weightKg?: number` ao interface
- Adicionar step numero **50** (novo step biometrico) na sequencia de **todos os fluxos** (running, cycling, swimming, strength) logo apos step 1 (sport selection)
- Adicionar validacao no `canProceed()` para o step 50: birthDate, heightCm e weightKg devem estar preenchidos
- Na funcao `generateTrainingPlan()`, salvar `height_cm` e `weight_kg` na tabela `profiles`, e `birth_date` na tabela `user_onboarding`

### 3. Atualizar `src/components/TrainingPlanWizard.tsx`
- Importar e renderizar `BiometricsStep` para o step 50
- Adicionar titulo e descricao para o step 50 nos dicionarios `STEP_TITLES` e `STEP_DESCRIPTIONS`

### 4. Sequencia dos fluxos (todas as modalidades)

Antes:
```text
0 (Disclaimer) -> 1 (Sport) -> 2 (Phone) -> ...
```

Depois:
```text
0 (Disclaimer) -> 1 (Sport) -> 50 (Biometricos) -> 2 (Phone) -> ...
```

Para strength (que nao tem phone):
```text
0 (Disclaimer) -> 1 (Sport) -> 50 (Biometricos) -> 40 (Parent Plan) -> ...
```

---

## Detalhes tecnicos

### BiometricsStep.tsx
- Usa `Calendar` com `captionLayout="dropdown-buttons"` para selecao de data de nascimento (reutiliza padrao do `BirthDateStep` existente)
- Inputs numericos para peso e altura com `min`/`max` e placeholders
- Icone de `Ruler`/`Weight`/`Calendar` para cada campo
- Exibe calculo de FC maxima estimada e IMC quando todos os campos estiverem preenchidos

### Persistencia no generateTrainingPlan
- `profiles` table: atualiza `weight_kg`, `height_cm`, `birth_date`
- `user_onboarding` table: atualiza `birth_date`
- Ambos via upsert usando `user_id`

### Validacao (canProceed para step 50)
```typescript
case 50:
  return !!wizardData.birthDate && 
         !!wizardData.weightKg && wizardData.weightKg >= 30 && wizardData.weightKg <= 300 &&
         !!wizardData.heightCm && wizardData.heightCm >= 100 && wizardData.heightCm <= 250;
```
