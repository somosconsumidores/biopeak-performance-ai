

# Fix: Campo `distance_m` / `hr` nao reconhecido pela Edge Function

## Problema
A edge function `analyze-efficiency-fingerprint` filtra pontos usando nomes de campo incorretos:
- Usa `p.distance_meters` mas os dados armazenam como `distance_m`
- Usa `p.heart_rate` mas dados HealthKit armazenam como `hr`

Isso faz com que TODOS os pontos sejam filtrados, resultando em 0 pontos validos e resposta `insufficient_data: true` (ou 400 na versao antiga).

## Evidencia
Query no banco para activity_id `21929844707`:
```text
first_point: {
  distance_m: 1.39,      // <-- NAO "distance_meters"
  heart_rate: 73,         // <-- OK para Garmin
  speed_ms: 0,
  power_watts: 0,
  elevation_m: 15.2
}
```

## Solucao
Atualizar a edge function para aceitar ambos os nomes de campo:

### Arquivo: `supabase/functions/analyze-efficiency-fingerprint/index.ts`

Alterar o filtro e mapeamento (linhas 299-307) para:

```typescript
const validPoints: DataPoint[] = seriesData
  .filter((p: any) => {
    const speed = p.speed_ms || 0;
    const hr = p.heart_rate || p.hr || 0;
    const dist = p.distance_meters || p.distance_m || 0;
    return speed > 0.5 && hr > 30 && dist > 0;
  })
  .map((p: any) => ({
    distance_meters: p.distance_meters || p.distance_m || 0,
    speed_ms: p.speed_ms || 0,
    heart_rate: p.heart_rate || p.hr || 0,
    power_watts: p.power_watts || null,
    elevation: p.elevation || p.elevation_m || null,
  }));
```

Isso resolve a compatibilidade com ambas as fontes (Garmin e HealthKit) sem alterar nenhuma outra parte do codigo.

## Impacto
- Atividades Garmin e HealthKit passarao a ser analisadas corretamente
- Nenhuma mudanca no frontend necessaria
- A edge function sera redeployada automaticamente

