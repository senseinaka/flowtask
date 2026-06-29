-- Personal doméstico (Finanzas Personales): jornal por hora + viático fijo por
-- jornada, configurables por concepto (ej. Sandra). Al cargar una entrada se
-- puede tipear la cantidad de horas y el monto se calcula como
--   horas * hourly_rate + viatic_amount.
--
-- Sólo afecta la tabla PERSONAL `finance_concepts`. NO se toca
-- `company_finance_concepts` (Finanzas Empresa no usa jornal/viático).
--
-- Ejecutar en el SQL Editor de Supabase (proyecto Summit). Es idempotente.
ALTER TABLE finance_concepts ADD COLUMN IF NOT EXISTS hourly_rate   numeric NOT NULL DEFAULT 0;
ALTER TABLE finance_concepts ADD COLUMN IF NOT EXISTS viatic_amount numeric NOT NULL DEFAULT 0;

-- No requiere cambios en sync-rules: la regla de finance_concepts usa SELECT *,
-- así que las columnas nuevas se replican automáticamente.
-- Tras correr esto, reiniciar `npm run dev` (cambió el AppSchema cliente en
-- powersync.ts: finance_concepts ahora declara hourly_rate y viatic_amount).
