-- ============================================================
-- Módulo Presupuestos — DDL Supabase
-- Ejecutar en el SQL editor de Supabase
-- ============================================================

-- ── quote_companies ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_companies (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  industry     TEXT NOT NULL DEFAULT '',
  website      TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_companies_workspace
  ON public.quote_companies(workspace_id);

ALTER TABLE public.quote_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON public.quote_companies
  USING (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_companies TO service_role;

-- ── quote_contacts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_contacts (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id   TEXT NOT NULL DEFAULT '',
  name         TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT '',
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_contacts_workspace
  ON public.quote_contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quote_contacts_company
  ON public.quote_contacts(company_id);

ALTER TABLE public.quote_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON public.quote_contacts
  USING (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_contacts TO service_role;

-- ── quotes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotes (
  id                 TEXT PRIMARY KEY,
  workspace_id       TEXT NOT NULL,
  title              TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'new',
  priority           TEXT NOT NULL DEFAULT 'p3',
  channel            TEXT NOT NULL DEFAULT 'email',
  assigned_to        TEXT NOT NULL DEFAULT '',
  company_id         TEXT NOT NULL DEFAULT '',
  contact_id         TEXT NOT NULL DEFAULT '',
  estimated_value    NUMERIC,
  won_value          NUMERIC,
  lost_reason        TEXT NOT NULL DEFAULT '',
  next_follow_up_at  BIGINT,
  sla_due_at         BIGINT,
  notes              TEXT NOT NULL DEFAULT '',
  created_at         BIGINT NOT NULL,
  updated_at         BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotes_workspace
  ON public.quotes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status
  ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to
  ON public.quotes(assigned_to);
CREATE INDEX IF NOT EXISTS idx_quotes_company
  ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_follow_up
  ON public.quotes(next_follow_up_at);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON public.quotes
  USING (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO service_role;

-- ── quote_activities ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_activities (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  quote_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'system',
  payload      TEXT NOT NULL DEFAULT '{}',
  created_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_activities_workspace
  ON public.quote_activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_quote_activities_quote
  ON public.quote_activities(quote_id);

ALTER TABLE public.quote_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON public.quote_activities
  USING (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_activities TO service_role;
