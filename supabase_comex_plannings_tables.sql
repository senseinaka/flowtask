-- Fase 4.3.0: tablas espejo en Supabase para "Programación de Pedidos"
-- (3 tablas: import_order_plannings, import_order_planning_milestones,
-- import_order_planning_ai_reports), reflejando migrations.ts v60/v61/v65 y
-- el AppSchema que se va a agregar a powersync.ts.
--
-- Cómo correr: pegar todo este archivo en el SQL Editor de Supabase
-- (Database > SQL Editor > New query) y ejecutar.
set role pg_database_owner;

-- ════════════════════════════════════════════════════════════════════════
-- Plannings (cabecera)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.import_order_plannings (
  id                                    text primary key,
  brand_id                              text not null references public.comex_brands(id) on delete cascade,
  supplier_id                           text references public.comex_suppliers(id) on delete set null,
  country                               text not null default '',
  responsible_user_id                  text not null default '',
  planning_type                        text not null default 'single',
  status                               text not null default 'draft',
  risk_status                          text not null default 'on_time',
  priority                             text not null default 'medium',
  target_coverage_start_date          bigint,
  target_coverage_end_date            bigint,
  target_commercial_availability_date bigint,
  recommended_order_date              bigint,
  approval_deadline_date               bigint,
  estimated_reception_date             bigint,
  demand_annual_estimated              integer,
  demand_monthly_estimated             integer,
  demand_for_period                    integer,
  current_stock                        integer,
  safety_stock                         integer,
  desired_coverage_months              double precision,
  internal_approval_days               integer not null default 0,
  supplier_preparation_days            integer not null default 0,
  production_days                      integer not null default 0,
  inspection_days                      integer not null default 0,
  shipping_days                        integer not null default 0,
  customs_days                         integer not null default 0,
  local_delivery_days                  integer not null default 0,
  safety_days                          integer not null default 0,
  total_lead_time_days                 integer not null default 0,
  ai_recommendation_summary            text,
  ai_risk_explanation                  text,
  notes                                 text not null default '',
  linked_import_id                     text references public.comex_imports(id) on delete set null,
  created_at                           bigint not null,
  updated_at                           bigint not null,
  workspace_id                         text not null
);

create index if not exists idx_import_order_plannings_brand    on public.import_order_plannings(brand_id);
create index if not exists idx_import_order_plannings_supplier on public.import_order_plannings(supplier_id);
create index if not exists idx_import_order_plannings_status   on public.import_order_plannings(status);

-- ════════════════════════════════════════════════════════════════════════
-- Hitos de planificación
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.import_order_planning_milestones (
  id              text primary key,
  planning_id     text not null references public.import_order_plannings(id) on delete cascade,
  milestone_type  text not null,
  estimated_date  bigint,
  calculated_date bigint,
  real_date       bigint,
  status          text not null default 'pending',
  notes           text not null default '',
  sort_order      integer not null default 0,
  created_at      bigint not null,
  updated_at      bigint not null,
  workspace_id    text not null
);

create index if not exists idx_import_order_planning_milestones_planning
  on public.import_order_planning_milestones(planning_id);

-- ════════════════════════════════════════════════════════════════════════
-- Reportes IA
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.import_order_planning_ai_reports (
  id                text primary key,
  report_type       text not null,
  brand_id          text references public.comex_brands(id) on delete cascade,
  supplier_id       text references public.comex_suppliers(id) on delete set null,
  period_start_date bigint,
  period_end_date   bigint,
  summary           text not null default '',
  findings          text not null default '',
  recommendations   text not null default '',
  risks             text not null default '',
  generated_by      text not null default 'ai',
  created_at        bigint not null,
  updated_at        bigint not null,
  workspace_id      text not null
);

create index if not exists idx_import_order_planning_ai_reports_brand
  on public.import_order_planning_ai_reports(brand_id);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Mismo patrón que Fases 4.1/4.2: el upload desde PowerSync usa la
-- service_role key (bypassea RLS). Las policies habilitan a cualquier
-- usuario autenticado a leer las filas de su workspace — un solo
-- workspace_id fijo (d61a4071-1557-4f32-be5e-6443fb336bf5) por ahora.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'import_order_plannings', 'import_order_planning_milestones',
    'import_order_planning_ai_reports'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Authenticated users can read workspace rows" on public.%I', t);
    execute format(
      'create policy "Authenticated users can read workspace rows" on public.%I for select to authenticated using (workspace_id = ''d61a4071-1557-4f32-be5e-6443fb336bf5'')',
      t
    );
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Permisos para service_role (usado por PowerSync para subir cambios)
--
-- Las tablas nuevas se crean bajo pg_database_owner y no heredan los
-- privilegios que service_role ya tiene sobre las tablas existentes. Sin
-- este GRANT, PowerSync recibe 403 "permission denied" al subir cambios.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tables text[] := array[
    'import_order_plannings', 'import_order_planning_milestones',
    'import_order_planning_ai_reports'
  ];
begin
  foreach t in array tables loop
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
