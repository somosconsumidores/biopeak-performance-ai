

# Correção do Erro na Edge Function `send-push-notification`

## Problema Identificado

O erro `TypeError: oneSignalResult.errors?.some is not a function` acontece porque a API do OneSignal retorna `errors` em formatos diferentes dependendo do tipo de erro:

- **Às vezes como array**: `["All included players are not subscribed"]`
- **Às vezes como objeto**: `{ "error": "Invalid app_id" }`
- **Às vezes como string**: `"Something went wrong"`

O código atual assume que `errors` sempre é um array, o que causa o crash quando é outro tipo.

## Solução

Criar uma função auxiliar que verifica de forma segura se há erros de "not subscribed", independentemente do formato retornado pela API:

```text
+----------------------------------+
|   Resposta da API OneSignal      |
+----------------------------------+
           |
           v
+----------------------------------+
|  É um array?                     |
|  → Usa .some() normalmente       |
+----------------------------------+
           |
           v
+----------------------------------+
|  É uma string?                   |
|  → Verifica com .includes()      |
+----------------------------------+
           |
           v
+----------------------------------+
|  É um objeto?                    |
|  → Converte para JSON string     |
|    e verifica com .includes()    |
+----------------------------------+
```

## Alterações

### Arquivo: `supabase/functions/send-push-notification/index.ts`

1. **Adicionar função auxiliar** para verificar erros de forma segura:
   ```typescript
   function hasNotSubscribedError(errors: unknown): boolean {
     if (!errors) return false;
     
     // Se for array, usa .some()
     if (Array.isArray(errors)) {
       return errors.some((err: unknown) => {
         const errStr = typeof err === 'string' ? err : JSON.stringify(err);
         return errStr.includes('not subscribed') || errStr.includes('All included players');
       });
     }
     
     // Se for string ou objeto, converte e verifica
     const errStr = typeof errors === 'string' ? errors : JSON.stringify(errors);
     return errStr.includes('not subscribed') || errStr.includes('All included players');
   }
   ```

2. **Adicionar função auxiliar** para verificar se há erros (length > 0):
   ```typescript
   function hasErrors(errors: unknown): boolean {
     if (!errors) return false;
     if (Array.isArray(errors)) return errors.length > 0;
     if (typeof errors === 'object') return Object.keys(errors).length > 0;
     return !!errors;
   }
   ```

3. **Substituir** as verificações diretas:
   - Linha 85-87: `oneSignalResult.errors?.some(...)` → `hasNotSubscribedError(oneSignalResult.errors)`
   - Linha 135: `fallbackResult.errors?.length > 0` → `hasErrors(fallbackResult.errors)`
   - Linha 163: `oneSignalResult.errors?.length > 0` → `hasErrors(oneSignalResult.errors)`

4. **Adicionar log de debug** para registrar o formato exato do erro quando ocorrer, facilitando diagnósticos futuros.

## Benefícios

- Corrige o crash atual
- Torna a função robusta contra qualquer formato de resposta da API OneSignal
- Melhora os logs para facilitar debugging futuro
- Mantém o mecanismo de fallback funcionando corretamente

