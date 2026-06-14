-- Ejecutar en el editor SQL de Supabase
-- Agrega la columna logo_data (imagen en base64 con prefijo data:image/...;base64,...)
-- a las 5 tablas espejo de Comex que ya sincronizan vía PowerSync.

ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS logo_data TEXT;
ALTER TABLE comex_freight_operators ADD COLUMN IF NOT EXISTS logo_data TEXT;
ALTER TABLE comex_gestores ADD COLUMN IF NOT EXISTS logo_data TEXT;
ALTER TABLE comex_despachantes ADD COLUMN IF NOT EXISTS logo_data TEXT;
ALTER TABLE comex_brands ADD COLUMN IF NOT EXISTS logo_data TEXT;
