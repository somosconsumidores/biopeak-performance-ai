
# Plano: Corrigir Cache do Card "Último Treino"

## Problema Identificado
O hook `useLastTrainingAnalysis` usa cache de 1 hora **sem background refresh**. Quando há cache válido, ele retorna imediatamente e **nunca busca dados atualizados**. Isso significa que atualizações na tabela `ai_coach_insights_history` não aparecem até o cache expirar.

## Comparação com Implementação Correta

| Comportamento | `useLastTrainingAnalysis` (atual) | `useCoachInsights` (correto) |
|---------------|-----------------------------------|------------------------------|
| Cache válido | Retorna cache e **para** | Retorna cache e **busca em background** |
| Atualização | Só após 1 hora | Imediata (silenciosa) |

## Solução: Implementar Background Refresh

### Mudança no `useLastTrainingAnalysis.ts`

```text
ANTES (problemático):
if (cached) {
  setAnalysis(cached);
  setLoading(false);
  return;  // Para aqui!
}

DEPOIS (correto):
if (cached) {
  setAnalysis(cached);
  setLoading(false);
  fetchAnalysis(false);  // Busca em background
} else {
  fetchAnalysis(true);
}
```

### Detalhes Técnicos

1. Modificar `fetchAnalysis` para aceitar parâmetro `showLoading = true`
2. Quando `showLoading = false`, não alterar estado de loading (refresh silencioso)
3. Remover o `return` que interrompe a execução quando há cache
4. Seguir exatamente o padrão já implementado em `useCoachInsights`

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useLastTrainingAnalysis.ts` | Adicionar background refresh seguindo padrão de `useCoachInsights` |

## Comportamento Esperado Após Fix

1. **Carregamento inicial**: Mostra cache instantaneamente (UX rápida)
2. **Background fetch**: Busca dados atualizados silenciosamente
3. **Atualização automática**: Se houver novos dados, atualiza o card sem flash/reload
4. **Cache atualizado**: Novo cache é salvo para próxima visita

## Impacto
- Usuário vê dados imediatos do cache
- Dados novos aparecem automaticamente em segundos
- Zero impacto na experiência (sem loading spinner adicional)
