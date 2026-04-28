-- =====================================================================
-- KPY CSS Analyzer — Migration: angular_encapsulation_count en scans
-- =====================================================================
-- Añade un contador agregado de selectores Angular ViewEncapsulation
-- (:host, :host-context, ::ng-deep, /deep/, >>>) en la tabla scans para
-- poder graficar la evolución del KPI a lo largo de los scans de un
-- proyecto sin tener que rehidratar el JSONB de scan_details.
-- =====================================================================

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS angular_encapsulation_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.scans.angular_encapsulation_count IS
  'Número de apariciones de selectores Angular ViewEncapsulation (:host, :host-context, ::ng-deep, /deep/, >>>) en el CSS analizado. Objetivo: 0.';

-- Backfill: scans antiguos quedan en 0 (no podemos recalcular sin reanalizar el CSS).
-- Para repoblar valores reales se puede leer scan_details.analysis_data->>'angularEncapsulationCount':
--
--   UPDATE public.scans s
--   SET angular_encapsulation_count = COALESCE(
--     (sd.analysis_data ->> 'angularEncapsulationCount')::int,
--     0
--   )
--   FROM public.scan_details sd
--   WHERE sd.scan_id = s.id;

-- =====================================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================================
