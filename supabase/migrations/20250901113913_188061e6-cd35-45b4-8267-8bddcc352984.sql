-- Remove triggers que disparam processamento por linha e causam interrupção em inserts em massa
DROP TRIGGER IF EXISTS process_chart_after_insert_strava_gpx ON public.strava_gpx_activity_details;
DROP TRIGGER IF EXISTS trg_variation_analysis_strava_gpx ON public.strava_gpx_activity_details;
DROP TRIGGER IF EXISTS trg_variation_analysis_strava_gpx_insupd ON public.strava_gpx_activity_details;

-- Opcional: mantemos outros triggers (updated_at) e os processos serão disparados explicitamente via funções Edge
