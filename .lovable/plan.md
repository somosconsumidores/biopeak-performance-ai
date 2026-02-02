
# Correção: Variável `today` usada antes da declaração

## Problema Identificado

Na Edge Function `compute-athlete-segmentation`, a variável `today` está sendo referenciada na **linha 234** mas só é declarada na **linha 245**:

```typescript
// Linha 234 - USO (antes da declaração)
.rpc('active_users_with_activities', { 
  p_start: eightWeeksAgo.toISOString().split("T")[0], 
  p_end: today  // ❌ Erro aqui
});

// Linha 245 - DECLARAÇÃO (tarde demais)
const today = new Date().toISOString().split("T")[0];
```

## Solução

Mover a declaração de `today` para **antes** do uso no RPC, junto com as outras variáveis de data.

## Modificação

**Arquivo:** `supabase/functions/compute-athlete-segmentation/index.ts`

```text
Antes (linhas 224-245):
├── eightWeeksAgo declarado
├── fourWeeksAgo declarado
├── RPC usa 'today' ❌
├── ...código...
└── today declarado (tarde demais)

Depois:
├── eightWeeksAgo declarado
├── fourWeeksAgo declarado
├── today declarado ✅
├── RPC usa 'today'
└── ...resto do código
```

## Código Corrigido

```typescript
// 1. Get active users with recent activities (last 60 days)
const eightWeeksAgo = new Date();
eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
const fourWeeksAgo = new Date();
fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
const today = new Date().toISOString().split("T")[0]; // ✅ Movido para cá

// Fetch only ACTIVE SUBSCRIBERS with activities
const { data: usersData, error: usersError } = await supabase
  .rpc('active_users_with_activities', { 
    p_start: eightWeeksAgo.toISOString().split("T")[0], 
    p_end: today // ✅ Agora funciona
  });
```

## Impacto

- Correção de 1 linha (mover declaração)
- Remover declaração duplicada da linha 245
- Tempo: menos de 1 minuto
