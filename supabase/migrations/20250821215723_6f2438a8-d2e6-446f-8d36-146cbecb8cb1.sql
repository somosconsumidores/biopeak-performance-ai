
-- 1) Enfileira atividades que têm details mas não têm registro em variation_analysis
SELECT public.enqueue_missing_variation_analysis_jobs();

-- 2) Processa os jobs imediatamente (até 500 por execução)
SELECT public.process_variation_analysis_jobs(500);

-- 3) (Opcional) Verificação rápida do estado da fila
SELECT status, COUNT(*) 
FROM public.variation_analysis_jobs 
GROUP BY status 
ORDER BY status;

-- 4) (Opcional) Amostra dos resultados calculados
SELECT user_id, activity_id, activity_source, activity_date, activity_type, cv_fc, cv_pace, updated_at
FROM public.variation_analysis
ORDER BY updated_at DESC
LIMIT 50;
