-- Cajas Internas — Fix RLS de escritura (los cambios desde la app no se guardaban)
-- Correr en: Supabase > SQL Editor > New query
--
-- PROBLEMA detectado con el renombrado de cajas (junio 2026):
--   Las 10 tablas cash_* originales (creadas por supabase_cajas_tables.sql) quedaron
--   con el patrón VIEJO de seguridad: RLS activado pero con UNA SOLA policy de SELECT
--   para `authenticated`, y los GRANT de escritura apuntando a `service_role`.
--   Desde la migración de seguridad, el cliente sube los cambios con el JWT del
--   usuario logueado (rol `authenticated`), NO con service_role. Resultado: todo
--   INSERT/UPDATE/DELETE de cajas hecho desde la app era rechazado por RLS (error
--   42501). El connector saltea esa fila para no trabar la cola de sync y completa la
--   transacción igual, así que en el siguiente checkpoint baja el valor viejo desde
--   Supabase y pisa el cambio local → "el cambio no se guarda" (ej.: renombrar caja).
--
-- FIX: dar a las 10 tablas la policy `authenticated_workspace_all` (FOR ALL) + el
--   GRANT de escritura a `authenticated`, exactamente como ya tiene cash_attachments.
--   Se elimina la policy vieja "Workspace read" (redundante: FOR ALL ya cubre SELECT).
--   Idempotente (drop policy if exists + create): si ya estuviera aplicado no cambia
--   nada. NO toca las sync-rules (las descargas van por replicación, ignoran RLS).
--
-- Después de correr esto, los cambios NUEVOS suben bien. Los writes que ya habían
-- sido rechazados/descartados antes del fix hay que rehacerlos (ej.: volver a
-- renombrar la caja), porque el connector ya los sacó de la cola.

do $$
declare
  t text;
  tables text[] := array[
    'cash_companies', 'cashboxes', 'cashbox_permissions',
    'cash_categories', 'cash_movements', 'cash_movement_amounts',
    'cash_counts', 'cash_count_details', 'cash_differences', 'cash_audit_logs'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    -- Saca la policy vieja de solo lectura (queda cubierta por la FOR ALL de abajo).
    execute format('drop policy if exists "Workspace read" on public.%I', t);
    -- Policy de acceso total dentro del workspace, para el rol authenticated.
    execute format('drop policy if exists "authenticated_workspace_all" on public.%I', t);
    execute format(
      'create policy "authenticated_workspace_all" on public.%I '
      || 'for all to authenticated '
      || 'using      (workspace_id = ''d61a4071-1557-4f32-be5e-6443fb336bf5'') '
      || 'with check (workspace_id = ''d61a4071-1557-4f32-be5e-6443fb336bf5'')',
      t
    );
    -- GRANT de escritura al rol con el que sube el cliente.
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
