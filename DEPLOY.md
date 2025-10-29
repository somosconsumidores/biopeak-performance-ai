# 🚀 Edge Functions Deployment Guide

Este documento descreve como fazer deploy das Edge Functions do projeto via GitHub Actions.

## 📋 Índice

- [Deploy Automático](#deploy-automático)
- [Deploy Manual](#deploy-manual)
- [Validação em PRs](#validação-em-prs)
- [Troubleshooting](#troubleshooting)
- [Links Úteis](#links-úteis)

---

## 🤖 Deploy Automático

### Como Funciona

O deploy automático é acionado quando você faz push para a branch `main` com alterações em:
- `supabase/functions/**`
- `supabase/config.toml`

### Processo

1. **Detecta funções modificadas** usando `git diff`
2. **Deploy apenas das funções alteradas** para otimizar tempo
3. **Logs detalhados** de cada função deployada
4. **Notificação automática** em caso de falha

### Exemplo de Workflow

```bash
# 1. Modifique uma edge function
vim supabase/functions/strava-webhook/index.ts

# 2. Commit e push
git add .
git commit -m "fix: improve strava webhook error handling"
git push origin main

# 3. GitHub Actions detecta e deploya automaticamente
# Acompanhe em: https://github.com/YOUR_ORG/YOUR_REPO/actions
```

### Ver Logs do Deploy

1. Acesse [GitHub Actions](https://github.com/YOUR_ORG/YOUR_REPO/actions)
2. Clique no workflow **"Deploy Edge Functions (Auto)"**
3. Selecione a execução mais recente
4. Expanda os steps para ver logs detalhados

---

## 🎯 Deploy Manual

### Quando Usar

- Hotfix urgente em produção
- Re-deploy após rollback
- Deploy seletivo sem mexer em outras funções
- Teste de função específica

### Como Fazer

1. Acesse [GitHub Actions](https://github.com/YOUR_ORG/YOUR_REPO/actions)
2. Clique em **"Deploy Specific Function (Manual)"**
3. Clique no botão **"Run workflow"**
4. Selecione a função no dropdown
5. Clique em **"Run workflow"** novamente
6. Acompanhe o deploy em tempo real

### Funções Disponíveis

Use o script helper para listar todas as funções:

```bash
bash .github/scripts/list-functions.sh
```

**Principais funções:**
- `strava-webhook` - Webhook do Strava
- `garmin-activities-webhook` - Webhook de atividades Garmin
- `sync-garmin-activities` - Sincronização de atividades
- `strava-sync-background` - Sync background Strava
- `calculate-statistics-metrics` - Cálculo de métricas
- ... e mais 45+ funções

---

## ✅ Validação em PRs

### O Que é Validado

Quando você cria um Pull Request modificando edge functions, o GitHub Actions automaticamente valida:

1. **Estrutura de arquivos**
   - Verifica se existe `index.ts`
   - Valida estrutura de diretórios

2. **Lint (Deno)**
   - Verifica code style
   - Identifica problemas de formatação

3. **Type Check (TypeScript)**
   - Valida tipos TypeScript
   - Previne erros de runtime

### Exemplo de Workflow

```bash
# 1. Crie uma branch
git checkout -b fix/webhook-error-handling

# 2. Modifique a função
vim supabase/functions/strava-webhook/index.ts

# 3. Commit e push
git add .
git commit -m "fix: add better error handling"
git push origin fix/webhook-error-handling

# 4. Abra PR no GitHub
# GitHub Actions roda validações automaticamente

# 5. Se passar: ✅ PR liberado para merge
# 6. Se falhar: ❌ PR bloqueado até correção
```

### Ver Resultados da Validação

1. Acesse seu Pull Request
2. Role até a seção **"Checks"**
3. Veja status de cada validação
4. Clique em **"Details"** para logs completos

---

## 🔧 Troubleshooting

### Deploy Falhou

**Erro:** `Failed to deploy: function-name`

**Soluções:**
1. Verifique os logs no GitHub Actions
2. Confirme que `SUPABASE_ACCESS_TOKEN` está configurado
3. Verifique se a função tem `index.ts`
4. Teste localmente: `supabase functions serve function-name`

### Função Não Detectada

**Erro:** `Function directory not found`

**Soluções:**
1. Verifique o nome da função (case-sensitive)
2. Confirme que existe `supabase/functions/FUNCTION_NAME/index.ts`
3. Execute: `bash .github/scripts/list-functions.sh`

### Type Check Falhou

**Erro:** `Type check failed`

**Soluções:**
1. Execute localmente: `deno check supabase/functions/FUNCTION_NAME/index.ts`
2. Corrija os erros de tipo
3. Re-push para re-executar validação

### Secrets Não Configurados

**Erro:** `SUPABASE_ACCESS_TOKEN is not set`

**Solução:**
1. Acesse **Settings** → **Secrets and variables** → **Actions**
2. Configure:
   - `SUPABASE_ACCESS_TOKEN` - Token do Supabase
   - `PROJECT_ID` - ID do projeto (`grcwlmltlcltmwbhdpky`)

### Rollback de Deploy

**Cenário:** Deploy quebrou produção

**Solução:**
1. Reverta o commit problemático:
   ```bash
   git revert HEAD
   git push origin main
   ```
2. Ou faça deploy manual da versão anterior:
   - Checkout do commit anterior
   - Use **"Deploy Specific Function (Manual)"**

---

## 📊 Monitoramento

### Ver Logs das Funções em Produção

1. **Supabase Dashboard:**
   - https://supabase.com/dashboard/project/grcwlmltlcltmwbhdpky
   - Edge Functions → Logs

2. **Lovable Edge Function Logs:**
   - Use a ferramenta de logs do Lovable
   - Filtre por nome da função

### Métricas Importantes

- **Success Rate:** % de execuções bem-sucedidas
- **Response Time:** Tempo médio de resposta
- **Error Count:** Número de erros nas últimas 24h

---

## 🔗 Links Úteis

### GitHub
- [GitHub Actions](https://github.com/YOUR_ORG/YOUR_REPO/actions)
- [Secrets Configuration](https://github.com/YOUR_ORG/YOUR_REPO/settings/secrets/actions)

### Supabase
- [Dashboard](https://supabase.com/dashboard/project/grcwlmltlcltmwbhdpky)
- [Edge Functions Logs](https://supabase.com/dashboard/project/grcwlmltlcltmwbhdpky/functions)
- [Database](https://supabase.com/dashboard/project/grcwlmltlcltmwbhdpky/editor)

### Documentação
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Deno Deploy](https://deno.com/deploy/docs)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

## 🆘 Suporte

**Em caso de problemas:**
1. Verifique os logs no GitHub Actions
2. Consulte a seção de [Troubleshooting](#troubleshooting)
3. Verifique os logs no Supabase Dashboard
4. Contate a equipe de desenvolvimento

---

## 📝 Changelog de Deploys

Para ver histórico completo de deploys:
- [GitHub Actions History](https://github.com/YOUR_ORG/YOUR_REPO/actions)
- Filtre por workflow: **"Deploy Edge Functions"**

---

**Última atualização:** 2025-01-29
