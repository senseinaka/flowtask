-- Cajas Internas — Orden de cajas/empresas + congruencia de monedas
-- Correr en: Supabase > SQL Editor > New query
--
-- Qué hace:
--   1. Agrega columna `sort_order` (integer) a cash_companies y cashboxes.
--   2. Seed del orden pedido: Naka arriba de EV; dentro de cada empresa
--      caja de cobros/ventas → caja 1 → caja 2.
--   3. Homogeneiza las monedas por empresa: Naka = ARS/USD/EUR, EV = ARS/USD.
--
-- No hace falta tocar las sync-rules: la publicación `powersync` es FOR ALL TABLES,
-- la regla ya es SELECT * y `powersync_repl` ya tiene SELECT sobre estas tablas,
-- así que la columna nueva baja sola. Después de correr esto, REINICIAR la app
-- (el AppSchema del cliente ya declara `sort_order`).

-- ── 1. Columnas sort_order ────────────────────────────────────────────────
alter table public.cash_companies add column if not exists sort_order integer not null default 0;
alter table public.cashboxes      add column if not exists sort_order integer not null default 0;

-- ── 2. Orden de empresas (Naka primero, luego Estación Vertical) ───────────
update public.cash_companies set sort_order = 0 where id = 'cashco-naka';
update public.cash_companies set sort_order = 1 where id = 'cashco-ev';

-- ── 3. Orden de cajas dentro de cada empresa (flujo: cobros → caja 1 → caja 2)
-- Naka Outdoors
update public.cashboxes set sort_order = 1 where id = 'cashbx-naka-local';    -- ventas / cobros
update public.cashboxes set sort_order = 2 where id = 'cashbx-naka-gonzalo';  -- caja 1
update public.cashboxes set sort_order = 3 where id = 'cashbx-naka-hernan';   -- caja 2
-- Estación Vertical
update public.cashboxes set sort_order = 1 where id = 'cashbx-ev-cajeros';    -- cobros diarios
update public.cashboxes set sort_order = 2 where id = 'cashbx-ev-1';          -- caja 1
update public.cashboxes set sort_order = 3 where id = 'cashbx-ev-martin';     -- caja 2

-- ── 4. Congruencia de monedas por empresa ─────────────────────────────────
-- Naka maneja pesos, dólares y euros; Estación Vertical solo pesos y dólares.
update public.cashboxes
   set currencies = '["ARS","USD","EUR"]'
 where workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   and company_id   = 'cashco-naka';

update public.cashboxes
   set currencies = '["ARS","USD"]'
 where workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   and company_id   = 'cashco-ev';
