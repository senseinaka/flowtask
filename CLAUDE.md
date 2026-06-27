# Summit — Contexto del proyecto para Claude Code

> **Para Claude:** Al finalizar una sesión con cambios arquitecturales o fixes significativos, proponer al usuario actualizar este archivo con lo que cambió. Este archivo es el único contexto que persiste entre sesiones.

> **Para Claude — antes de programar tareas grandes:** Para tareas estructurales, de riesgo medio/alto, o que toquen múltiples módulos, consultar Graphify o leer `graphify-out/GRAPH_REPORT.md` antes de editar código. Esto aplica especialmente a: módulos nuevos, cambios en Supabase/sync, autenticación, rutas, arquitectura, integraciones, dashboards de Finanzas/Empresa, Calendario, CRM y refactors. Antes de empezar, explicar: (1) archivos involucrados, (2) dependencias, (3) riesgos, (4) patrones existentes a reutilizar, (5) plan de implementación.

## Qué es Summit

Summit es el sistema operativo central de **Naka Outdoors** y de su CEO, **Diego Nakamura**. Centraliza en una sola aplicación de escritorio todo lo necesario para gestionar la empresa y la productividad personal:

### Módulos actuales

- **Comex (Comercio Exterior):** gestión completa de importaciones de Naka Outdoors. Seguimiento de embarques, documentos para despachante y personal, presupuestos logísticos de operadores de flete, pagos, costos, arancel, proformas, planificación de pedidos con IA, y **cotizaciones USD/EUR** propias vs. la Divisa Venta del BCRA (`/comex/cotizaciones`).
- **Tareas / Kanban:** sistema de gestión de tareas con tablero kanban, dependencias, recordatorios y delegación.
- **Agenda / Calendario:** integración con Google Calendar. Sistema para programar envíos de mensajes por WhatsApp con recordatorios automáticos.
- **Contactos:** agenda de contactos de la empresa.
- **Presupuestos / CRM:** generación de presupuestos y seguimiento comercial tipo CRM.
- **Finanzas personales:** módulo para llevar todas las cuentas mensuales personales de Diego (movimientos, conceptos recurrentes, cargas múltiples).
- **Finanzas empresa:** módulo equivalente para las cuentas mensuales de Naka Outdoors.
- **Conciliador Contable:** conciliación mensual de ventas entre Flexxus (sistema de facturación), cupones de tarjetas (CSV/XLSX de procesadora) y Mercado Pago (principal y secundaria). Motor de matching en 4 niveles, KPIs visuales y edición manual de resultados.
- **Email:** recepción y envío de correos electrónicos desde la app.
- **Backup:** backup automático de código (GitHub) y datos (Google Drive) en la nube.
- **Configuración:** módulo robusto de ajustes para todos los menús y preferencias del sistema.
- **Knowledge:** captura y organización de información (textos, archivos, imágenes, PDFs) con resúmenes por IA (Haiku) y resúmenes globales por tema. Rutas `/knowledge`. Sincroniza vía PowerSync.
- **Mercado Pago:** integración con la API de MP para descargar reportes de liquidaciones, sincronizar transacciones, y conciliarlas con operaciones internas. Multi-cuenta. Rutas `/contable/mercadopago`. Tablas PowerSync: `mercadopago_connections`, `mercadopago_report_jobs`, `mercadopago_report_files`, `mercadopago_transactions`.
- **Contable → Servicios:** gestión de servicios recurrentes: software/SaaS, seguros, hosting, bancarios, suscripciones, etc. Panel de control con vencimientos, historial de pagos/renovaciones, soporte inline para datos de pólizas de seguros. Catálogos editables (categorías, áreas, medios de pago) vía tabla `service_catalog`. Rutas `/contable/servicios`.
- **RRHH — Sueldos:** administración mensual de sueldos por colaborador. Extrae datos de PDFs de recibos de sueldo, los guarda en Supabase via PowerSync, genera alertas inteligentes (nuevos, ausentes, variaciones), compara con el mes anterior y exporta planillas XLS. Los PDFs se almacenan en Google Drive (`Summit RRHH/Sueldos/MM-YYYY/`).
- **RRHH — Nómina:** módulo de ficha de colaboradores. Registro completo (datos personales, laborales, bancarios, Drive). Genera la nómina desde la última liquidación, asigna legajos automáticos (4 dígitos), crea carpetas Drive en `Summit RRHH/Legajos/XXXX Nombre/` con subcarpetas, muestra historial salarial por colaborador con gráfico de área. Rutas: `/rrhh/nomina` y `/rrhh/nomina/:id`.
- **Cortex:** módulo interno para explorar el grafo de dependencias del código fuente. Generado por Graphify, permite consultas en lenguaje natural, rutas entre componentes y análisis de impacto. Solo visible para el admin.

### Visión a futuro

El sistema está diseñado para crecer. Próximas expansiones planificadas:
- Facturación
- Stock e inventario
- Módulo de depósito / almacén
- Recursos humanos
- Marketing
- **Cerebro de IA** que pueda coordinar y ejecutar acciones en todos los módulos

### Arquitectura multi-dispositivo y offline-first

Summit está instalado en **múltiples máquinas**. Todos los dispositivos acceden y modifican los mismos datos según permisos. El sistema debe funcionar **offline**: los datos se descargan localmente al iniciar y se sincronizan en la nube a medida que cambian.

- **Código:** versionado en GitHub (`senseinaka/flowtask`), permite desarrollo desde distintas conexiones.
- **Datos:** almacenados en **Supabase** (fuente de verdad), sincronizados a local via **PowerSync**. Los cambios siempre se escriben a Supabase y se bajan a local automáticamente.
- **Archivos:** almacenados en **Google Drive**.
- **Local:** PowerSync mantiene una copia local (`powersync.db`) para funcionamiento offline. `flowtask.db` solo para datos intrínsecamente locales (caché de email, adjuntos binarios).

---

**Nombre del producto:** Summit
**Nombre técnico interno:** `flowtask` (paquete npm, repo GitHub `senseinaka/flowtask`, AppData, appId)
**Stack:** Electron + React + TypeScript + Vite + React Query + PowerSync + better-sqlite3 + Supabase

> **Nota sobre el nombre:** El producto se llama "Summit" pero el nombre técnico interno sigue siendo "flowtask". Esto es intencional — cambiarlo rompería el auto-update y las rutas de datos de usuarios existentes. En código se usan: `"name": "flowtask"`, `appId: "com.flowtask.app"`, `%APPDATA%\flowtask\`, `flowtask.db`, repo `senseinaka/flowtask`. El nombre visible al usuario ("Summit") vive en `"productName"` del `package.json`.

---

## Cómo correr el proyecto

```bash
# Directorio del proyecto
cd C:\Projects\flowtask

# Dev (renderer con HMR + main process compilado)
npm run dev

# Build de distribución
npm run build:win

# Release (build + publica en GitHub Releases para auto-update)
npm run release
```

**HMR:** los cambios en `src/renderer/` se aplican en caliente sin reiniciar.
**Main process:** cualquier cambio en `src/main/` requiere `npm run dev` de nuevo (rebuild completo).

---

## Arquitectura de bases de datos — LO MÁS IMPORTANTE

El proyecto usa **dos bases de datos SQLite simultáneas**. Esta distinción es crítica y explica el 90% de los bugs no obvios.

### 1. `flowtask.db` — base local (better-sqlite3)

- **Ruta:** `%APPDATA%\flowtask\flowtask\flowtask.db`
- **API:** `getDb()` desde `src/main/database/db.ts`
- **Características:** síncrona, nativa, rápida. Solo accesible desde el main process.
- **Nunca es borrada por el servidor de sync.**
- **NO sincroniza entre dispositivos por sí sola.**

Contiene: todas las tablas originales del proyecto (proyectos, tareas, finanzas, comex, etc.) más las tablas de solo lectura local.

### 2. `powersync.db` — base sincronizada (PowerSync + Supabase)

- **Ruta:** `%APPDATA%\flowtask\flowtask\powersync.db`
- **API:** `getPowerSyncDb()` desde `src/main/database/powersync.ts`
- **Características:** asíncrona (devuelve Promises). Sincroniza con Supabase via el servidor PowerSync.
- **El servidor PowerSync puede borrar tablas** que no estén en sus sync-rules en cada ciclo de reconciliación.
- Se configura con `.env.local` en la raíz del proyecto (ver sección de variables de entorno).

### Regla de escritura

```
Lecturas/escrituras que deben sincronizar  →  getPowerSyncDb()
Lecturas/escrituras solo-local             →  getDb()
```

---

## Arquitectura de sincronización — DIRECTIVA FUNDAMENTAL

**Supabase es la fuente de verdad. Todos los datos deben sincronizarse vía PowerSync → Supabase.**

- Toda escritura va a `getPowerSyncDb()` (nunca a `getDb()` para datos de negocio).
- PowerSync sube los cambios a Supabase vía `ps_crud` y los baja via sync-rules.
- `flowtask.db` (`getDb()`) es **solo** para datos que por naturaleza son locales e irrepresentables en otro dispositivo: adjuntos de tareas, caché de email, configuración local.
- **Nunca usar `flowtask.db` como workaround** para problemas de sync. Si un dato desaparece, el fix correcto es arreglar las sync-rules o el schema de Supabase, no moverlo a local.

### ✅ Todas las tablas de negocio sincronizan via PowerSync ↔ Supabase

Se leen y escriben exclusivamente via `getPowerSyncDb()`. Requieren sync-rules en el servidor PowerSync con filtro `workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'`:

- `projects`, `tasks`, `task_dependencies`
- `user_permissions`, `user_profiles`
- `finance_accounts`, `finance_categories`, `finance_payment_methods`
- `finance_concepts`, `finance_movements`, `finance_month_insights`, `finance_movement_entries`
- `calendar_event_links`
- `quote_companies`, `quote_contacts`, `quotes`, `quote_activities`
- `company_finance_accounts`, `company_finance_categories`, `company_finance_payment_methods`
- `company_finance_concepts`, `company_finance_movements`, `company_finance_month_insights`
- `company_finance_movement_entries`
- Todas las tablas `comex_*` e `import_order_*` (incluidas `comex_logistics_quotes`, `comex_quote_files`)
- `knowledge_entries`, `knowledge_global_summaries`
- `rrhh_colaboradores`, `rrhh_periodos`, `rrhh_sueldos`, `rrhh_nomina_config`, `rrhh_listas`
- `mercadopago_connections`, `mercadopago_report_jobs`, `mercadopago_report_files`, `mercadopago_transactions`
- `accounting_services`, `accounting_service_payments`, `service_catalog`

**Si un dato de negocio desaparece al reiniciar:** el problema está en las sync-rules (workspace_id incorrecto, tabla faltante) o en el schema de Supabase (columna faltante). No mover a `flowtask.db`.

**DDL pendiente de ejecutar en Supabase (Contable → Servicios, jun 2026):**
```sql
CREATE TABLE public.service_catalog (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'd61a4071-1557-4f32-be5e-6443fb336bf5',
  config_type TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  sort_order BIGINT NOT NULL DEFAULT 0,
  deleted_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0
);
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_workspace_all" ON public.service_catalog
  FOR ALL TO authenticated
  USING  (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5')
  WITH CHECK (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_catalog TO authenticated;
CREATE INDEX ON public.service_catalog (workspace_id, config_type);
```
Y agregar a sync-rules de PowerSync:
```yaml
- SELECT * FROM service_catalog WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
```

**DDL RRHH multiempresa — APLICADO en Supabase (jun 2026):**
```sql
-- 1) Discriminador NAKA/Estación Vertical en las 4 tablas
ALTER TABLE rrhh_colaboradores ADD COLUMN IF NOT EXISTS empresa text NOT NULL DEFAULT 'naka';
ALTER TABLE rrhh_periodos      ADD COLUMN IF NOT EXISTS empresa text NOT NULL DEFAULT 'naka';
ALTER TABLE rrhh_sueldos       ADD COLUMN IF NOT EXISTS empresa text NOT NULL DEFAULT 'naka';
ALTER TABLE rrhh_nomina_config ADD COLUMN IF NOT EXISTS empresa text NOT NULL DEFAULT 'naka';

-- 2) Backfill (el DEFAULT de Postgres es metadata-only y NO se replica → hace falta el UPDATE
--    explícito para que PowerSync re-emita las filas; la guarda IS DISTINCT FROM 'ev' no pisa EV)
UPDATE rrhh_colaboradores SET empresa='naka' WHERE empresa IS DISTINCT FROM 'ev';
UPDATE rrhh_periodos      SET empresa='naka' WHERE empresa IS DISTINCT FROM 'ev';
UPDATE rrhh_sueldos       SET empresa='naka' WHERE empresa IS DISTINCT FROM 'ev';
UPDATE rrhh_nomina_config SET empresa='naka' WHERE empresa IS DISTINCT FROM 'ev';

-- 3) DROP de 3 índices UNIQUE secundarios — OBLIGATORIO para multiempresa (chocan apenas dos
--    empresas comparten mes/año o DNI; trababan ps_crud con 23505). La unicidad la garantiza el código.
DROP INDEX idx_rrhh_periodo_mes;   -- era UNIQUE(workspace_id, anio, mes)
DROP INDEX idx_rrhh_colab_doc;     -- era UNIQUE(workspace_id, documento)
DROP INDEX idx_rrhh_sueldo_uniq;   -- era UNIQUE(workspace_id, periodo_id, colaborador_id)
```
Sync-rules: **sin cambios** (filtran por `workspace_id` con `SELECT *`; la columna fluye sola).
**Lección:** una tabla PowerSync con discriminador de empresa NO debe tener UNIQUE secundario que
incluya columnas que varían por empresa — ver regla [[feedback-powersync-unique-constraints]].

### Reglas al crear una tabla sincronizada nueva (Supabase)

1. **RLS + policy para `authenticated` + GRANT** (ver template en "DDL pendiente en Supabase"): `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... FOR ALL TO authenticated USING (workspace_id = '...') WITH CHECK (...)` + `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`. Los uploads suben con el JWT del usuario (rol `authenticated`), no con service_role — si falta el GRANT, fallan con `42501 permission denied`; si falta la policy, con RLS violation.

2. **NUNCA un constraint `UNIQUE` además de la PK (`id`).** PowerSync resuelve conflictos solo por la PK; si dos dispositivos crean la misma fila lógica, la segunda viola el UNIQUE (`23505`) y **bloquea toda la cola de sync para todos**. Para garantizar unicidad, hacer el `id` determinístico sobre la tupla (ej. `insight-${year}-${month}`, `${taskId}__${dependsOnId}`, `file-${fileHash}`) → misma fila lógica = misma PK → PowerSync deduplica solo. (jun 2026: se dropearon 6 UNIQUE secundarias por este motivo.)

### ❌ Solo local (NO sincroniza — por diseño)

Estas tablas viven únicamente en `flowtask.db` porque representan estado local del dispositivo que no tiene sentido sincronizar:

- `attachments` — archivos adjuntos de tareas (binarios locales)
- `email_*` — módulo de correo (usa `email-db.ts`, caché local de IMAP)
- `recon_*` — Conciliador Contable: `recon_periods`, `recon_imports`, `recon_invoices`, `recon_cupones`, `recon_ml_ops`, `recon_results`, `recon_audit` (solo el contador opera este módulo en su PC)
- `bcra_rates_cache` — caché local de cotizaciones diarias del BCRA (módulo Comex → Cotizaciones, migración v95). Se rebaja de la API pública del BCRA; no tiene sentido sincronizar.
- Tablas de caché y configuración de UI local

### Función `restoreComexLocalCache` / `restoreCompanyFinanceLocalCache`

Estas funciones copian `flowtask.db → psDb` en el primer arranque (cuando `psDb count = 0`) para hacer el bootstrap inicial de datos históricos. **No son la fuente de verdad** — son un mecanismo de seeding único para que PowerSync pueda subir los datos existentes a Supabase en la primera sincronización.

---

## Patrón de migraciones (flowtask.db)

Las migraciones de `flowtask.db` están en `src/main/database/migrations.ts`.

```typescript
// Cada migración es un objeto { version: number, up: (db) => void }
// Se aplican en orden ascendente; la versión actual se guarda en PRAGMA user_version
// Versión actual: v95 (bcra_rates_cache)
// v80: knowledge_entries + knowledge_global_summaries
// v81: user_profiles
// v82–v94: mercadopago_*, accounting_services / service_catalog, RRHH multiempresa + SAC (ver migrations.ts)
// v95: bcra_rates_cache (caché local de cotizaciones BCRA — NO sincroniza)
```

**Reglas:**
- Siempre incrementar `version` en 1.
- **El array `MIGRATIONS` debe mantenerse en orden ascendente por `version`.** `runMigrations` ordena automáticamente antes de aplicar, pero si el array está desordenado en el source, una migración puede ejecutarse antes de sus dependencias en la misma sesión de desarrollo. Agregar siempre al final del array.
- Las migraciones son permanentes — no hay rollback.
- Para renombrar tablas con nuevas FK: crear `_v2`, copiar datos, borrar original, renombrar (ver migración 72 que eliminó las FK de las tablas de entradas).
- Si hay duda de si una columna ya existe, usar `PRAGMA table_info(tabla)` para verificar antes de `ALTER TABLE` (ver migración 71).

---

## Módulo de finanzas — arquitectura específica

### Finanzas personales

- **Queries:** `src/main/database/queries/finance.ts`
- **UI:** `src/renderer/src/routes/finance/FinanceDashboard.tsx`

### Finanzas empresa

- **Queries:** `src/main/database/queries/company-finance.ts`
- **UI:** `src/renderer/src/routes/company-finance/CompanyFinanceDashboard.tsx`

### Conceptos clave del módulo

- **Concepto** (`finance_concepts`): template de un gasto recurrente (ej. "Supermercado"). Tiene `tracks_multiple_entries` para indicar que acepta varias cargas por mes.
- **Movimiento** (`finance_movements`): instancia mensual de un concepto (ej. "Supermercado — Junio 2025"). Tiene `amount_actual` que se recalcula como la suma de sus cargas.
- **Entrada/Carga** (`finance_movement_entries`, `company_finance_movement_entries`): cada pago individual dentro de un movimiento multi-carga. Se leen y escriben exclusivamente via `getPowerSyncDb()` (pure PowerSync, sin dual-write). `addMovementEntry`, `updateMovementEntry` y `removeMovementEntry` usan `writeTransaction` para escribir la entrada y recalcular el movimiento en la misma transacción SQLite.

### Función `recalcMovementFromEntries`

En ambos archivos de queries. Lee `SUM(amount)` de las cargas, y actualiza `amount_actual`, `status`, y `payment_date` en el movimiento via `getPowerSyncDb()` para que el total sincronice.

### `entries_count` en movimientos

El campo `entries_count` se calcula con `attachEntriesCounts()` (async), que consulta `getPowerSyncDb()` después de traer los movimientos. Ver función en `finance.ts` y `company-finance.ts`.

---

## Módulo de email — arquitectura específica

El módulo de email es **completamente independiente de PowerSync**. No sincroniza entre dispositivos — cada instalación descarga su propio caché IMAP.

- **DB local:** `flowtask.db` vía `src/main/database/email-db.ts` (`getEmailDb()`). Tablas: `email_accounts`, `email_messages`, `email_attachments`.
- **Adjuntos:** `%APPDATA%\flowtask\email-attachments\` (binarios locales, nunca se suben a Supabase).
- **IMAP:** `imapflow` para sync, envío via `nodemailer` (SMTP).
- **Queries:** `src/main/database/queries/email.ts`
- **Hooks:** `src/renderer/src/hooks/useEmail.ts`
- **UI:** `src/renderer/src/routes/email/EmailDashboard.tsx`

### Soft-delete y Papelera

`email:messages:delete` mueve el mensaje a la carpeta `Trash` (campo `folder`) tanto en la DB local como en el servidor IMAP (`imapMoveToTrash`). **No borra físicamente.**

- `email:messages:purge` — borrado permanente (solo desde Trash)
- `email:messages:restore` — mueve de vuelta a INBOX (local + IMAP `imapRestoreFromTrash`)

### Renderizado de emails HTML

Los emails HTML se muestran dentro de un `<iframe srcDoc sandbox="allow-same-origin allow-popups">` (componente `EmailBody`). Esto aísla los `<style>` embebidos del email del CSS global de la app, evitando que el HTML del email cambie colores del sidebar u otros elementos de la UI.

---

## Patrón de IPC (main ↔ renderer)

La comunicación entre el main process y el renderer se hace via IPC de Electron:

- **Main expone funciones** en `src/main/index.ts` via `ipcMain.handle('channel', handler)`
- **Renderer las llama** via `window.api.nombreFuncion()` (definido en `src/preload/index.ts`)
- **React Query** en el renderer maneja cache, invalidación y re-fetch

El renderer NO tiene acceso directo a `getDb()` ni `getPowerSyncDb()` — todo pasa por IPC.

---

## Variables de entorno (.env.local)

Archivo en la raíz del proyecto (dev) o junto al ejecutable instalado (producción):

```
POWERSYNC_URL=https://...
POWERSYNC_JWT_PRIVATE_KEY_B64=...
POWERSYNC_JWT_KID=...
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
```

`SUPABASE_ANON_KEY` contiene la **publishable key** del sistema nuevo de Supabase (`sb_publishable_...`), no la anon JWT legacy (deshabilitada jun 2026). Se manda como header `apikey` en el login (`auth.service.ts`) y en los uploads de PowerSync (`uploadData`).

**Auth de los uploads (jun 2026):** PowerSync sube con el **access token del usuario logueado** (`getSession().accessToken`, rol `authenticated`); RLS hace cumplir el acceso por workspace. Antes usaba `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS y viajaba en texto plano en cada máquina = agujero de seguridad) — **fue eliminado y no debe volver al cliente**. La `sb_secret_...` (reemplazo del service_role) es server-side; Summit no la usa.

El JWT para autenticarse en PowerSync se firma localmente con la clave privada RSA en cada conexión (TTL: 24h). Si la sesión dura más de 24h sin reiniciar la app, la cola de sync puede congelarse — la solución es reiniciar.

---

## Constantes importantes

```typescript
WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'  // único workspace del proyecto
```

Todas las tablas tienen `workspace_id TEXT NOT NULL DEFAULT 'd61a4071-1557-4f32-be5e-6443fb336bf5'`.

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main/database/db.ts` | Singleton de `flowtask.db` (better-sqlite3) |
| `src/main/database/powersync.ts` | Singleton de PowerSync, schema, conexión, migraciones de datos |
| `src/main/database/migrations.ts` | Migraciones de `flowtask.db` (versión actual: v95) |
| `src/main/database/queries/finance.ts` | CRUD finanzas personales |
| `src/main/database/queries/company-finance.ts` | CRUD finanzas empresa |
| `src/main/database/queries/recon.ts` | CRUD + motor del Conciliador Contable (solo `getDb()`) |
| `src/main/database/queries/permissions.ts` | CRUD permisos + perfiles de usuario (`listUserProfiles`, `upsertUserProfile`, `adminSaveUserProfile`, `deleteUserProfile`) |
| `src/main/services/auth.service.ts` | Login/logout/refresh Supabase Auth + upsert de user_profile en cada login |
| `src/main/services/recon-parsers.service.ts` | Parsers de archivos Flexxus, cupones y ML |
| `src/main/ipc/permissions.ipc.ts` | Handlers IPC de permisos y perfiles (`permissions:profiles:*`) |
| `src/main/ipc/recon.ipc.ts` | Handlers IPC del Conciliador |
| `src/main/index.ts` | Punto de entrada main, registra handlers IPC |
| `src/preload/index.ts` | Expone API al renderer via contextBridge |
| `src/shared/modules.ts` | Catálogo de módulos (MODULES array + ADMIN_USER_ID) |
| `src/renderer/src/hooks/useRecon.ts` | Hooks React Query del Conciliador |
| `src/renderer/src/components/settings/PermissionsAdmin.tsx` | Panel de administración de usuarios y permisos (two-panel) |
| `src/renderer/src/routes/finance/FinanceDashboard.tsx` | UI finanzas personales (~4500 líneas) |
| `src/renderer/src/routes/company-finance/CompanyFinanceDashboard.tsx` | UI finanzas empresa (~similar tamaño) |
| `src/renderer/src/routes/contable/ReconPeriodView.tsx` | Shell del período con drill-down entre tabs |
| `src/renderer/src/routes/contable/ReconTabResultados.tsx` | Tabla de resultados con 4 modos de vista |

---

## Repo y distribución

- **GitHub:** `github.com/senseinaka/flowtask` (público)
- **Auto-update:** `electron-updater` lee los releases de GitHub. El comando `npm run release` hace build + publica.
- **AppId:** `com.flowtask.app`
- **ProductName:** `Summit`

---

## Módulo Conciliador Contable — arquitectura específica

### Propósito

Conciliación mensual de ventas entre tres fuentes:
1. **Flexxus** — sistema de facturación (exporta XLSX con sección "Ingresos Ventas")
2. **Cupones de tarjetas** — procesadora de pagos (exporta CSV o XLSX)
3. **Mercado Pago** — dos cuentas: principal y secundaria (exportan XLS)

### CRÍTICO: módulo LOCAL-ONLY (NO usa PowerSync)

**Todas las tablas del Conciliador usan `getDb()` (`flowtask.db`).** No sincronizan entre dispositivos. Esto es por diseño: los archivos fuente (Flexxus, ML, cupones) los importa solo el contador en su PC.

**Nunca mover estas tablas a PowerSync** sin coordinar con Diego.

### Migración v78 — 6 tablas en `flowtask.db`

| Tabla | Contenido |
|-------|-----------|
| `recon_periods` | Períodos de conciliación (mes/año + estado) |
| `recon_imports` | Log de cada archivo importado por período |
| `recon_invoices` | Facturas parseadas de Flexxus |
| `recon_cupones` | Cupones parseados de la procesadora de tarjetas |
| `recon_ml_ops` | Operaciones parseadas de Mercado Pago |
| `recon_results` | Resultados del motor de matching (uno por factura/operación) |
| `recon_audit` | Historial de cambios manuales de estado |

### Fuentes de importación (`ReconImportSource`)

```typescript
type ReconImportSource =
  | 'flexxus_ventas'   // XLSX Flexxus — sección "Ingresos Ventas"
  | 'cupones_csv'      // CSV de procesadora de tarjetas (Latin-1, separador `;`)
  | 'cupones_xlsx'     // XLSX de cupones con sección "TARJETAS DE CREDITO"
  | 'ml_principal'     // XLS Mercado Pago cuenta principal
  | 'ml_secundaria'    // XLS Mercado Pago cuenta secundaria
```

### Estados de conciliación (`ReconEstado`)

```typescript
type ReconEstado =
  | 'conciliado'         // match exacto por external_reference
  | 'dif_menor'          // match por referencia con diferencia < 1%
  | 'conciliado_monto'   // match por monto exacto (sin referencia)
  | 'diferencia_monto'   // match fuzzy con diferencia ≤5%
  | 'rechazado_ml'       // ML rechazó la operación
  | 'no_cobrado_ml'      // no tiene contraparte en ML
  | 'pendiente'          // sin match encontrado
  | 'requiere_revision'  // marcado manualmente para revisar
  | 'manual'             // asignado manualmente por el usuario
```

### Motor de conciliación (`runReconEngine`)

Corre 4 niveles de matching en orden (greedy, sin reusar operaciones):

1. **Nivel 1 — `external_reference == comprobante`**: ML.external_reference = número de comprobante Flexxus. Diferencia < 1% → `conciliado`, < 5% → `dif_menor`, resto → `diferencia_monto`.
2. **Nivel 2 — monto exacto** (< 1% diferencia): sin match por referencia, busca monto similar.
3. **Nivel 3 — monto fuzzy** (≤ 5% diferencia): candidato con menor diferencia proporcional.
4. **Nivel 4 — sin match**: facturas no conciliadas → `no_cobrado_ml` (si tiene importe tarjetas > 0) o `pendiente`. Operaciones ML sin match → `rechazado_ml` (si status en REJECTED_STATUSES) o `pendiente`.

El engine borra los resultados anteriores del período antes de insertar los nuevos.

### Parsers de archivos (`src/main/services/recon-parsers.service.ts`)

| Función | Fuente | Detalle |
|---------|--------|---------|
| `parseFlexxus(buffer)` | XLSX Flexxus | `raw: true` — celdas numéricas devuelven número real directo |
| `parseCuponesCSV(buffer)` | CSV Latin-1 | Encoding ISO-8859-1, separador `;`, valores en `="..."` |
| `parseCuponesXLSX(buffer)` | XLSX cupones | `raw: true`, busca header dinámicamente |
| `parseML(buffer)` | XLS MercadoPago | `raw: true`, detecta columnas dinámicamente por nombre |

**CRÍTICO — `parseFlexxus` usa `raw: true`:** Flexxus exporta celdas numéricas como números reales de JavaScript (ej. `269900`). Si se cambia a `raw: false`, SheetJS devuelve strings con punto decimal (`"269900.00"`), y la función `num()` original quitaba el punto → `26990000` (100× el valor real). El fix definitivo es `raw: true`.

**Función `num(raw)` — detección inteligente de separadores:**

```typescript
// Prioridad: si hay coma DESPUÉS del último punto → coma es decimal ("1.234,56")
// Si hay un solo punto con ≤2 dígitos después → punto es decimal ("269900.00")
// Si hay un solo punto con 3+ dígitos después → punto es miles ("269.900")
// Si hay múltiples puntos → todos son miles ("1.234.567")
```

### Archivos clave del módulo

| Archivo | Rol |
|---------|-----|
| `src/main/database/queries/recon.ts` | CRUD completo: períodos, imports, invoices, cupones, ML ops, results, audit, KPIs, engine |
| `src/main/services/recon-parsers.service.ts` | Parsers de los 5 tipos de archivo |
| `src/main/ipc/recon.ipc.ts` | Handlers IPC (`recon:*`) incluyendo `recon:import` con soporte drag-drop |
| `src/renderer/src/hooks/useRecon.ts` | Hooks React Query para todo el módulo |
| `src/renderer/src/routes/contable/ReconDashboard.tsx` | Lista de períodos, crear nuevo período |
| `src/renderer/src/routes/contable/ReconPeriodView.tsx` | Vista de un período con 3 tabs (shell liviano) |
| `src/renderer/src/routes/contable/ReconTabImportar.tsx` | Tab de importación con drag & drop por fuente |
| `src/renderer/src/routes/contable/ReconTabResultados.tsx` | Tab de resultados: 4 modos de vista, fullscreen, búsqueda, teclado, batch |
| `src/renderer/src/routes/contable/ReconTabKPIs.tsx` | Tab de KPIs: 4 summary cards, barra apilada, desglose por estado |

### Arquitectura UI del período

`ReconPeriodView.tsx` es un shell que solo maneja estado de tab y drill-down. Los 3 sub-componentes son completamente independientes:

- **ReconTabImportar**: 5 tarjetas drag & drop (una por fuente). Acepta drop de archivos con validación de extensión. Usa `(file as File & { path?: string }).path` para obtener el path nativo del SO y pasarlo al IPC via `preFilePath`.
- **ReconTabResultados**: 4 modos de vista (`compact | grouped | dual | cards`). Vista compacta usa `table-fixed w-full` con `<colgroup>` de anchos fijos compactos para que Notas tome el espacio restante. La pestaña Resultados usa ancho completo (sin `max-w-4xl`).
- **ReconTabKPIs**: drill-down → llama `onDrillDown(estado)` en el padre, que cambia tab a Resultados con filtro `initialEstado`.

### Acceso al módulo

Menú `Contable`, gateado por permiso `canRead('contable')` en `Sidebar.tsx`. Rutas:
- `/contable/recon` → `ReconDashboard`
- `/contable/recon/:id` → `ReconPeriodView`

---

## Sistema de permisos y usuarios

### Arquitectura

El sistema de acceso multi-usuario tiene dos tablas en PowerSync:

| Tabla | Propósito |
|-------|-----------|
| `user_permissions` | Permisos por módulo/submódulo para cada usuario (`level`: `'none'` \| `'read'` \| `'write'`) |
| `user_profiles` | Nombre y email legibles de cada usuario; se actualiza automáticamente al hacer login |

Ambas sincronizan vía PowerSync → todos los dispositivos ven el mismo estado.

### `user_permissions` (migración v64)

- `user_id`, `module_key`, `submodule_key`, `level`, `workspace_id`
- Gateada en el Sidebar por `canRead(moduleKey)` (hook `usePermissions`)
- Admin puede setear permisos desde Settings → Permisos

### `user_profiles` (migración v81)

Columnas: `id`, `workspace_id`, `email`, `display_name`, `last_seen_at`.

**Dos funciones distintas en `queries/permissions.ts`:**

```typescript
// Llamada en login (auth.service.ts → saveSession): actualiza email, display_name Y last_seen_at = now
upsertUserProfile({ id, email, display_name })

// Llamada por el admin desde UI: actualiza email y display_name, NO toca last_seen_at
// Para usuarios nuevos crea con last_seen_at = 0 ("Nunca conectado")
adminSaveUserProfile({ id, email, display_name })
```

**Regla:** nunca llamar `adminSaveUserProfile` desde un flujo de login — eso pisaría `last_seen_at` e impediría detectar si el usuario nunca se conectó.

### Panel de administración (`PermissionsAdmin.tsx`)

Panel de dos columnas en Settings → Permisos (solo visible para `ADMIN_USER_ID`):
- **Columna izquierda (`w-64`):** lista de usuarios con avatar/iniciales, nombre, email, badge de estado online
- **Columna derecha:** edición de nombre/email del usuario seleccionado, copia de UUID, permisos por módulo con presets (sin acceso / solo lectura / lectura+escritura), botón eliminar con confirmación inline
- **Usuarios sin perfil:** al seleccionarlos aparece `CreateProfileInline` con inputs de nombre+email para asignarles identidad
- **Nuevo usuario:** modal con UUID (con botón Paste), nombre, email, preset de permisos inicial

**`key={selected.id}`** en el call site de `UserHeader` — fuerza remount al cambiar de usuario para resetear estado local de edición.

### DDL pendiente en Supabase

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  last_seen_at BIGINT NOT NULL
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_workspace_all" ON user_profiles
  FOR ALL TO authenticated
  USING (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5')
  WITH CHECK (workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5');
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
CREATE INDEX ON user_profiles(workspace_id);
```

---

## Módulo Knowledge — estado actual (junio 2026)

**Tablas creadas (migración v80):** `knowledge_entries` + `knowledge_global_summaries`. PowerSync AppSchema y sync listeners ya configurados. Tipos en `src/shared/types.ts` ya definidos (`KnowledgeEntry`, `KnowledgeGlobalSummary`, etc.).

**Pendiente de implementar:**
- `src/main/database/queries/knowledge.ts` — CRUD
- `src/main/services/knowledge-ai.service.ts` — resúmenes IA con claude-haiku-4-5
- `src/main/ipc/knowledge.ipc.ts` — handlers IPC
- `src/renderer/src/hooks/useKnowledge.ts` — hooks React Query
- `src/renderer/src/routes/knowledge/KnowledgeDashboard.tsx` — UI

**DDL Supabase también pendiente.** Ver el plan en `.claude/plans/` para el schema completo.

---

## Módulo Comex → Cotizaciones USD/EUR (junio 2026)

Seguimiento de las cotizaciones propias de USD y EUR (precios al público en ARS) contra la **Divisa Venta** del BCRA, con gráfico de 6 meses, historial y chip de desvío porcentual. Ruta `/comex/cotizaciones` (último ítem del menú Comex).

- **Cotizaciones propias:** tabla PowerSync `comex_cotizaciones` (`moneda`, `valor_ars`, `nota`, `created_at`). Se cargan a mano; la **fecha es editable** (default hoy) → `created_at` = mediodía de la fecha elegida (evita saltos de TZ). Cada moneda es una `MonedaCard` con estado local propio — **no compartir un solo estado entre USD y EUR** (ese fue un bug: editar una borraba el valor de la otra).
- **BCRA:** `src/main/services/bcra.service.ts` baja la serie diaria de la API pública. **Endpoint correcto:** `/estadisticascambiarias/v1.0/Cotizaciones/{moneda}?fechadesde=&fechahasta=` (CON la moneda en el path — el endpoint sin moneda **no** acepta rango de fechas y da 400). `results` es un **array** de días; el valor en ARS está en `detalle[].tipoCotizacion` (NÚMERO — no existe compra/venta ni un discriminador `'Divisa'`). **Fechas en hora LOCAL** (`getFullYear/Month/Date`, no `toISOString()`): en Argentina (UTC-3) el ISO salta al día siguiente de noche y el BCRA rechaza "fecha mayor al día actual". Cachea en `bcra_rates_cache` (flowtask.db, **local, NO sincroniza**, migración v95) con fetch incremental de los días faltantes.
- **Archivos:** `CotizacionesPage.tsx`, hooks en `useComex.ts` (`useCotizaciones`, `useAddCotizacion`, `useBcraRates`, `useRefreshBcra`), IPC `comex:cotizaciones:*` y `comex:bcra:*`.
- **DDL Supabase** (ya aplicado jun 2026): tabla `comex_cotizaciones` con RLS + GRANT para `authenticated` (template estándar) + sync-rule `SELECT * FROM comex_cotizaciones WHERE workspace_id = '...'`.

---

## Bugs conocidos y sus fixes (historial relevante)

### Fix: PowerSync "Sin conexión" persistente — transporte, reconexión y cola (resuelto — junio 2026)

**Síntoma:** badge en "Sin conexión" indefinido; `SyncStatus` con `connected:false, connecting:false, hasSynced:true` **sin** error de upload/download, `lastSyncedAt` congelado.

Cuatro causas distintas, todas en `powersync.ts` salvo la #4:

1. **NO usar WebSocket como `connectionMethod` en `@powersync/node`.** Se probó `SyncStreamConnectionMethod.WEB_SOCKET` para evitar el idle-drop del HTTP streaming — el handshake WS abre, pero el stream autenticado **no completa y deja de sincronizar del todo** (lastSyncedAt congelado). **El transporte que funciona es el HTTP streaming (default): no pasar `connectionMethod` a `db.connect()`.**

2. **Watchdog de reconexión.** El Rust client queda en `connected:false / connecting:false` sin error tras un cierre limpio del server (idle, deploy) y no reintenta solo. `scheduleWatchdog()` lo detecta en el listener `statusChanged` y llama `_psDb.connect()` directo (sin `disconnect()` previo, que dispararía otro evento idle) a los ~10s. Se cancela al reconectar o ante disconnect intencional (logout → flag `_intentionalDisconnect`).

3. **`uploadData` salta filas con 403/42501 (RLS).** Cualquier `throw` en `uploadData` reintenta la transacción para siempre y **traba toda la cola `ps_crud`** (ver regla de tablas nuevas). Una tabla sin policy/GRANT para `authenticated` devolvía 403 y congelaba el sync de todo. Ahora ese caso se **saltea** (igual que el skip de PGRST205) y se reporta la tabla en el badge — el fix de fondo sigue siendo correr el DDL (RLS+GRANT) de esa tabla.

4. **`usePowerSyncStatus` es singleton** (`src/renderer/.../hooks/usePowerSyncStatus.ts`). `window.api.off(channel)` hace `removeAllListeners`, así que al desmontar un componente (ej. `SyncStatusBadge` al salir de Sistema) se mataba el listener de PowerSync de **todos** (incluido el Sidebar), que quedaba congelado. Ahora hay un único listener IPC a nivel de módulo con un `Set` de suscriptores.

**Diagnóstico de la cola sin abrir la app:** leer `%APPDATA%\flowtask\flowtask\powersync.db` read-only con **Python** sqlite3 (`sqlite3.connect("file:...?mode=ro&immutable=1", uri=True)`) — `better-sqlite3` falla por ABI de Electron (NODE_MODULE_VERSION). `SELECT COUNT(*) FROM ps_crud` = 0 → no hay bloqueo de upload, el problema es solo de conexión.

**Badge + reconexión:** `SyncStatusBadge` muestra el error real (no "[object Object]"), es expandible y tiene botón "Reconectar" cuando está desconectado; el Sidebar tiene indicador "Sync" persistente (dot verde/ámbar) que también reconecta al click.

### Fix: cargas no guardaban valores — FK constraint (resuelto — junio 2025)

**Problema:** al agregar una carga en un movimiento multi-entrada, el valor se perdía.

**Causa:** `finance_movement_entries` tenía FK `REFERENCES finance_movements(id)`, pero `finance_movements` vive en PowerSync, no en `flowtask.db` → `SQLITE_CONSTRAINT_FOREIGNKEY` al insertar.

**Fix:** Migración 72: recreó las tablas de entradas sin la FK.

### Fix: valor de carga se reseteaba a $0 al agregar una segunda carga (resuelto — junio 2026)

**Problema:** el usuario tipeaba un valor en "Supermercado 1" y al hacer click en "+ Agregar" (para crear "Supermercado 2"), el valor de Supermercado 1 volvía a $0.

**Causa:** el flujo de `MovementEntriesQuickList` es de dos pasos: crear la carga con `amount=0`, luego editar el monto inline. Al hacer click en "+ Agregar", si `onBlur` no disparaba antes del click (o si `add.mutate` completaba antes que `update.mutate`), el refetch devolvía `amount=0` de la DB y el input perdía el valor escrito.

**Fix:** `EntryAmountInput` (en `FinanceDashboard.tsx`) tiene ahora:
1. **Autosave por debounce de 500ms** — cuando el usuario deja de tipear, el valor se guarda automáticamente sin necesitar blur ni Enter.
2. **Sync del display cuando el servidor actualiza** — si el valor del servidor cambia y el input no está enfocado, `draft` se sincroniza al nuevo valor.
3. **Refs `onSaveRef` y `valueRef`** — evitan closures stale en el timer del debounce.

El mismo fix aplica a `CompanyFinanceDashboard.tsx` si tiene `EntryAmountInput` propio.

### Fix: badge del contador de cargas siempre en 0 (resuelto — junio 2025)

**Causa:** el subquery `COUNT(*)` en `MOVEMENT_BASE_SELECT` corría contra PowerSync (siempre vacío). 
**Fix:** `attachEntriesCounts()` consulta `flowtask.db` después de traer los movimientos y adjunta el conteo.

### Fix: input "Monto" no aceptaba teclado (resuelto — junio 2025)

**Causa:** `type="number"` + locale argentino (coma como decimal) → Chromium/Electron rechaza caracteres del teclado.
**Fix:** `type="text"` + `inputMode="decimal"` en ambos dashboards. El código ya parsea coma: `Number(value.replace(',', '.'))`.

### Fix: sincronización de cargas y company_finance entre dispositivos (resuelto — junio 2025)

**Problema raíz:** los sync-rules del servidor PowerSync tenían typos en el workspace_id para la mayoría de las tablas (`...336fb5` en vez de `...336bf5`, y `finance_movement_entries` con un UUID completamente corrupto). El servidor devolvía 0 filas para esas tablas → PowerSync las borraba localmente en cada ciclo de sync.

**Fix:**
1. Corregidos los sync-rules en el dashboard de PowerSync (todos los workspace_id ahora son `d61a4071-1557-4f32-be5e-6443fb336bf5`).
2. `addMovementEntry` / `updateMovementEntry` / `removeMovementEntry` (en ambos módulos): ahora escriben en `flowtask.db` Y en PowerSync dentro de la misma transacción (dual-write → Supabase).
3. `restoreCompanyFinanceLocalCache` y `restoreComexLocalCache`: refactorizadas para usar `migrateLegacyTableData` en vez de escribir directamente a `ps_data__`. Así la primera ejecución sube los datos existentes a Supabase vía ps_crud.

### Fix: badge PowerSync mostraba "object Object" en lugar del error real (resuelto — junio 2025)

**Causa:** `errorMessage()` en `powersync.ts` hacía `String(err)` cuando el error no era `instanceof Error`. Los errores de Postgres que devuelve PowerSync son objetos planos `{ message, code, hint }`, por lo que `String(obj)` = `[object Object]`.

**Fix:** `errorMessage()` ahora extrae `obj.message`, luego `obj.error`, luego `JSON.stringify(obj)` como fallback. Si el badge de sync muestra un error incomprensible, revisar primero `errorMessage()` en `powersync.ts` (~línea 1485).

**Regla:** nunca hacer `String(err)` ni `${err}` en catch blocks — siempre usar `errorMessage(err)` o `(err as Error).message` con guardia de tipo.

### Fix: cola de sync bloqueada por string "null" en columnas numéricas (resuelto — junio 2025)

**Causa:** filas de `comex_import_extra_costs` tenían el literal `"null"` (string) en columnas `REAL` (`percepcion_caba`, `percepcion_bsas`, `importe_iva`, etc.). Supabase rechazaba el upload con error `22P02` (tipo inválido) y bloqueaba **toda** la cola `ps_crud` — ningún cambio subía a Supabase mientras hubiera una fila así pendiente.

**Síntoma:** badge de sync en error permanente, tooltip con `[object Object]` (antes del fix de errorMessage) o con el mensaje `22P02: invalid input syntax for type double precision`.

**Fix:** `fixLegacyNullDoubleStrings()` en `powersync.ts`, que se llama en cada `connectPowerSync()`:
- Recorre **todas** las filas de `comex_import_extra_costs` buscando `= 'null'` en las columnas numéricas conocidas.
- Corrige en `flowtask.db` y en `powersync.db` (encola UPDATE a Supabase).
- También corrige entradas en `ps_crud` que ya estuvieran pendientes con ese valor.

**Regla:** si se agrega una nueva columna `REAL`/`DOUBLE` a `comex_import_extra_costs`, agregarla también a `EXTRA_COST_DOUBLE_COLS` en `powersync.ts`.

### Fix: import_order_plannings subía con workspace_id = null (resuelto — junio 2025)

**Causa:** `PLANNING_COLUMNS` en `comex.ts` no incluía `workspace_id`. El INSERT dinámico lo omitía → la fila llegaba a Supabase con `null` y era rechazada con error `23502` (NOT NULL violation). Lo mismo pasaba en `import_order_planning_milestones` y `import_order_planning_ai_reports`.

**Síntoma:** badge de sync en error, mensaje `null value in column "workspace_id" of relation "import_order_plannings" violates not-null constraint`.

**Fix:**
- Agregado `workspace_id, WORKSPACE_ID` explícitamente en los tres INSERTs de `comex.ts`.
- `fixNullWorkspaceIds()` en `powersync.ts` (corre en cada `connectPowerSync`): parchea filas existentes con `workspace_id = null` en esas tres tablas y corrige entradas pendientes en `ps_crud`.

**Regla:** al crear un nuevo INSERT en `comex.ts` (o cualquier módulo que use PowerSync), siempre incluir `workspace_id = WORKSPACE_ID`. Si el INSERT usa columnas dinámicas (como `PLANNING_COLUMNS`), agregar `workspace_id` explícitamente fuera del array. Agregar la tabla a `TABLES_MISSING_WORKSPACE_ID` en `powersync.ts` solo si ya hay filas viejas sin workspace_id en producción.

## Comportamiento de borrado en cascada (Comex)

`deleteImport` borra en orden todos los registros hijos antes de borrar el import (no hay ON DELETE CASCADE en SQLite/PowerSync). El orden actual:

```
comex_quote_files → comex_logistics_quotes → comex_payments →
comex_import_customs → comex_import_costs → comex_inal_certs →
comex_import_tributos → comex_import_extra_costs → comex_proformas →
comex_documents → comex_import_items → comex_imports
```

`deleteQuote` borra `comex_quote_files` antes de borrar `comex_logistics_quotes`.

**Regla:** si se agrega una nueva tabla hija de `comex_imports`, agregarla al cascade de `deleteImport`.

---

## Presupuestos logísticos — adjuntos y HTML de cotizaciones (migración 73)

**Qué se agregó (junio 2026):**
- Campo `quote_html` (HTML de la cotización recibida) y `quote_received_at` en `comex_logistics_quotes`
- Tabla nueva `comex_quote_files` para adjuntos de cada cotización (archivos en Google Drive)
- UI expandible por operador en `QuoteRow` con área de paste HTML, preview y lista de archivos

**SQL aplicado en Supabase** (junio 2026, via script Node.js con conexión directa PostgreSQL):
- `ALTER TABLE comex_logistics_quotes ADD COLUMN quote_html` ✓
- `ALTER TABLE comex_logistics_quotes ADD COLUMN quote_received_at` ✓
- `CREATE TABLE comex_quote_files` ✓
- `CREATE TABLE calendar_event_links` ✓

`comex_quote_files` ya está en las sync-rules de PowerSync con el filtro `workspace_id` correcto (confirmado junio 2026).

**Drive:** Los archivos se guardan en `FlowTask Comex / {nombre importación} / Presupuestos Logísticos / {archivo}`.

---

## Patrón: nodos compuestos en el timeline de importación

El timeline de comex (`ComexImportDetail.tsx`) tiene dos tipos de nodos:
- **Nodo simple:** botón que llama `onChangeStatus(step)` directamente.
- **Nodo compuesto:** abre un panel con sub-estados (expandible, click-outside + Escape para cerrar).

Nodos compuestos existentes:
- `ProveedorNode` (paso 4, color amber `#f59e0b`): sub-estados `production → carga_armada → esperando_embarcar`
- `ForwarderNode` (paso 5, color sky `#38bdf8`): sub-estados `forwarder → cotizacion_pedida → forwarder_seleccionado`. El primer sub-estado ("Forwarder sin cotizar") es el estado inicial automático, no aparece como botón seleccionable en el panel.

Para agregar un nuevo nodo compuesto:
1. Agregar los nuevos valores a `ImportStatus` en `types.ts` + sus labels y colores.
2. Agregar el paso principal a `TIMELINE_STEPS` (entre los pasos correctos).
3. Agregar `NUEVO_SUB_STEPS` con los sub-estados.
4. Actualizar `toMainStep()` para que los sub-estados mapeen al paso principal.
5. Actualizar `getStepDate()` para los nuevos estados (puede devolver `{ ts: null }` si no hay fecha específica).
6. Crear el componente `NuevoNode` copiando `ProveedorNode` o `ForwarderNode` como template.
7. Agregar el `if (step === 'nuevo')` en el `.map()` de `ImportTimeline`.
8. **No requiere migración de DB** — `status` es TEXT sin CHECK constraint en SQLite ni en Supabase.

---

## Módulo de Calendario — arquitectura específica

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main/services/google-calendar.service.ts` | Integración OAuth con Google Calendar API (leer, crear, editar, borrar eventos) |
| `src/main/database/queries/calendar.ts` | Queries locales: `getUnifiedEvents`, `createManualEvent`, `updateManualEvent`, `deleteManualEvent`, links opt-in |
| `src/main/database/queries/calendar-wa-reminders.ts` | CRUD de recordatorios WA persistentes: `upsertWaReminder`, `deleteWaReminder`, `getPendingWaReminders`, etc. |
| `src/main/ipc/calendar.ipc.ts` | Handlers IPC del módulo calendario |
| `src/main/services/scheduler.service.ts` | Timers in-memory para recordatorios WA + restore desde DB al arrancar |
| `src/renderer/src/routes/Calendar.tsx` | UI principal del calendario |
| `src/renderer/src/hooks/useCalendar.ts` | Hooks React Query para todos los handlers del calendario |

### Tablas locales (flowtask.db — NO sincronizan)

- **`calendar_events_cache`**: caché local de eventos de Google Calendar (columnas: `google_event_id`, `google_calendar_id`, `summary`, `description`, `location`, `start_at`, `end_at`, `all_day`). Se sincroniza periódicamente desde Google Calendar vía `syncEnabledCalendars()`. Las escrituras manuales (crear/editar evento) también actualizan esta caché via `upsertEventCache()`.

- **`calendar_wa_reminders`**: recordatorios WA persistentes (migración 76). Columnas: `id` (UUID), `event_id` (ID unificado del evento, ej. `google:abc123`), `phone`, `message`, `send_at`, `sent_at`, `created_at`. Persiste los recordatorios para que sobrevivan reinicios de la app.

- **`calendar_connections`**: configuración de conexión OAuth (tokens de acceso, calendarios habilitados).

### Tablas sincronizadas via PowerSync

- **`calendar_event_links`**: links opt-in entre eventos de Finanzas/Comex y Google Calendar. Sincroniza entre dispositivos (ej. distintos usuarios pueden ver qué ítems ya tienen evento en GCal). Tiene `owner_user_id` para restricciones de borrado.

### Identificadores de eventos unificados

El tipo `UnifiedCalendarEvent` tiene un campo `id` que sigue el patrón `{source}:{original_id}`:
- `google:{googleEventId}` — evento de Google Calendar
- `finance:{movementId}` — vencimiento de Finanzas Personal
- `company_finance:{movementId}` — vencimiento de Finanzas Empresa
- `comex_planning:{milestoneId}` — hito de Programación de Pedidos

Este ID compuesto es el que se usa como `event_id` en `calendar_wa_reminders`.

### Navegación del calendario (teclado + rueda)

Implementado en `Calendar.tsx` via dos `useEffect` con listener nativo:

**Teclado (`document` keydown):**
- `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` → período anterior / siguiente (respeta la vista activa: mes/semana/día)
- `T` / `t` → hoy

**Rueda del mouse (`onWheel` sobre el grid):**
- Scroll hacia abajo → `goNext()`, scroll hacia arriba → `goPrev()`
- Throttle de 300ms (`lastWheelRef`) para evitar saltos múltiples
- Listener nativo con `{ passive: false }` para que `e.preventDefault()` funcione correctamente en el div `overflow-auto`

**Guard `navBlocked`:**
```typescript
const navBlocked = modal?.mode === 'create' || modal?.mode === 'edit'
```
Ambos handlers (teclado y rueda) se bloquean **solo cuando hay un EventModal abierto** (create/edit). El `DayZoomModal` (mode `'day-zoom'`) **no bloquea** la navegación — el fondo puede seguir moviéndose mientras el zoom está abierto.

### DayZoomModal

Al hacer click en cualquier celda del grid se abre el `DayZoomModal` (en vez de abrir directamente el modal de creación):

- Muestra todos los eventos del día ordenados: todo-el-día primero, luego por `start_at`
- Cada evento muestra: barra de color de la fuente, título, rango horario, label de la fuente (`SOURCE_LABELS[ev.source]`), descripción truncada
- Click en evento navega al `EventModal` de edición (solo para eventos `google` o con `link`)
- Botón "Nuevo evento en este día" abre `EventModal` de create con la fecha prefijada → cierra el zoom
- **Ampliar/minimizar:** botón `Maximize2`/`Minimize2` en el header, alterna entre tamaño normal (`max-w-xl, max-h-80vh`) y pantalla completa (`calc(100vw-2rem) × calc(100vh-2rem)`)
- Estado `ModalState` ampliado: `{ mode: 'create' } | { mode: 'edit' } | { mode: 'day-zoom'; date: Dayjs }`

### Sistema de recordatorios WA

**Flujo de creación:**
1. `Calendar.tsx` llama `window.api.calendar.scheduleWaReminder(ev.id, phone, message, sendAt)`
2. IPC → `schedulerService.scheduleDirectWaReminder(id, phone, message, sendAt)`
3. El scheduler persiste en DB via `upsertWaReminder(id, phone, message, sendAt)` y luego crea un `setTimeout`
4. Al disparar el timer: envía WA via Evolution API y llama `markWaReminderSent(eventId)`

**Restore al arrancar:**
- `schedulerService.start()` llama `loadPendingWaReminders()` que lee `getPendingWaReminders()` (filtro `sent_at IS NULL`) y recrea los timers en memoria.

**Cancelación:**
- `window.api.calendar.cancelWaReminder(eventId)` → `schedulerService.cancelDirectWaReminder(id)` → borra el timer + llama `deleteWaReminder(eventId)`

### Evolution API (WhatsApp)

- **URL por defecto:** `https://evolution-api-production-d7fd.up.railway.app`
- **Instancia:** `flowtask`
- **Endpoint de envío:** `POST /message/sendText/flowtask`
- **Teléfono:** sin `+`, sin espacios (ej. `5491112345678`)
- **Servicio:** `src/main/services/whatsapp.service.ts`

### Contacto personal (Mis datos personales)

- Hook: `usePersonalContact()` en `src/renderer/src/hooks/useSettings.ts`
- Llamada IPC: `window.api.settings.getPersonalContact()` → devuelve `PersonalContactInfo`
- Campos: `name`, `whatsapp_number` (con código de país, sin `+`), `email`, `other`
- Configurado en Settings → "Mis datos personales"

### Contactos (agenda)

- Tabla `contacts` en `flowtask.db` (local-only, no sincroniza)
- Campo `phone`: almacenado solo dígitos (strip de caracteres no-numéricos al guardar)
- Hook: `useContacts()` en `src/renderer/src/hooks/useContacts.ts`
- IPC: `window.api.contacts.list()`

---

## Bugs corregidos — Calendario (junio 2026)

### Fix: eventos recurrentes se creaban en fecha incorrecta y como un solo evento maestro (resuelto)

**Síntoma:** al crear un evento recurrente de 9 semanas, Google Calendar mostraba 1 solo evento el día 23-06 en vez de 9 eventos a partir del 30-06.

**Causa raíz 1 — RRULE:** el enfoque original creaba 1 evento de Google Calendar con `recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=...;COUNT=9']`. Google Calendar trata esto como 1 evento maestro con 9 ocurrencias virtuales — el usuario solo ve el primer evento en la vista de semana actual.

**Causa raíz 2 — `toISOString()` con Z:** `new Date(ts).toISOString()` producía una cadena UTC con `Z` (ej. `"2026-06-30T00:00:00Z"`). Google Calendar evaluaba `BYDAY` en UTC → para eventos planificados pasada las 21:00 (Argentina UTC-3), el día en UTC era el día siguiente → evento creado un día antes de lo esperado.

**Fix:**

1. **Abandonado el enfoque RRULE.** Ahora se crean N eventos individuales (sin campo `recurrence`) via loop secuencial de `mutateAsync`:
   ```typescript
   for (const inst of recurringInstances) {
     await createEvent.mutateAsync({ calendarId, input: { ...campos, startAt, endAt } })
   }
   ```
2. **`fmtLocal(ts)` en `google-calendar.service.ts`:** produce `"YYYY-MM-DDTHH:mm:ss"` sin `Z`. Google Calendar usa el campo `timeZone` para interpretar la hora local. Ya no hay conversión UTC involuntaria.
3. **`isBatchCreating` state:** previene que el botón "Guardar" se habilite brevemente entre calls secuenciales (`mutation.isPending` baja a false entre calls).

**Regla:** nunca usar `new Date(ts).toISOString()` para enviar datetimes a la Google Calendar API. Usar siempre `fmtLocal(ts)` de `google-calendar.service.ts` combinado con el campo `timeZone`.

### Fix: preview de instancias recurrentes mostraba N-1 eventos (resuelto)

**Síntoma:** seleccionar 9 semanas mostraba solo 8 eventos en el preview.

**Causa:** el contenedor tenía `max-h-40` (160px). 9 ítems de ~18px c/u = 162px > 160px → el ítem 9 quedaba visualmente cortado.

**Fix:** cambiado a `max-h-64` (256px) + numeración `{i + 1}.` para contar fácilmente.

---

## Bugs corregidos — revisión de código (junio 2026)

### Seguridad: TLS global deshabilitado

**Problema:** `process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'` al inicio de `index.ts` deshabilitaba la verificación de certificados para **todas** las conexiones HTTPS del proceso main (Supabase, IMAP, PowerSync).

**Fix:** Reemplazado por `google.options({ agent: new https.Agent({ rejectUnauthorized: false }) })` al inicio de `index.ts`. El bypass TLS ahora aplica **solo a googleapis** (Drive, Calendar, Auth). Las demás conexiones validan TLS normalmente.

### Seguridad: `shell:open` aceptaba cualquier esquema de URL

**Problema:** `ipcMain.handle('shell:open', ...)` pasaba la URL directamente a `shell.openExternal()`. El renderer podía enviar `ms-msdt:...` u otros protocolo handlers del SO (clase Follina).

**Fix:** Whitelist de esquemas en `sync.ipc.ts`: solo `https://` y `http://` son aceptados.

### Migraciones: v50 declarada antes de v49 en el array

**Problema:** `runMigrations` procesaba el array en orden de declaración sin ordenar. En DBs migrando desde < v49, v50 corría primero, `user_version` quedaba en 50, y v49 (tablas WhatsApp) se salteaba para siempre.

**Fix:** `runMigrations` ahora ordena el array por `version` antes de filtrar y aplicar.

### Comex: campo `canal` omitido del INSERT en `upsertCustoms`

**Problema:** Al crear un registro de aduana por primera vez, `canal` se ignoraba silenciosamente (estaba en el UPDATE pero no en el INSERT).

**Fix:** Agregado `canal` en la lista de columnas y valores del INSERT en `upsertCustoms` (`comex.ts`).

### PowerSync: PGRST204 retry con múltiples columnas desconocidas bloqueaba la cola

**Problema:** El retry de columna desconocida solo stripea una columna por intento. Con dos columnas nuevas simultáneas, el segundo intento fallaba con otro PGRST204 y lanzaba excepción sin llamar `transaction.complete()`, bloqueando la cola indefinidamente.

**Fix:** El bloque `case PATCH` ahora usa un `while` loop que stripea columnas desconocidas hasta que el request tenga éxito (o hasta que el payload quede vacío).

### Comex: `deleteImport` y `deleteQuote` no borraban registros hijos

**Problema:** Borrar una importación dejaba huérfanos en 11 tablas hijas. Borrar una cotización dejaba huérfanos en `comex_quote_files`.

**Fix:** Ambas funciones en `comex.ts` ahora borran en cascada en orden correcto.

### PowerSync: JWT expiraba en 1h

**Problema:** Con sesiones de más de 1h sin reiniciar, el upload a PowerSync fallaba con 401 y la cola quedaba congelada.

**Fix:** TTL del JWT aumentado de 3600 a 86400 segundos (24h).

### PowerSync: cambios en `company_finance_*` no actualizaban el renderer

**Problema:** `registerSyncListeners` no incluía las tablas `company_finance_*` en el listener de cambios. Cambios locales y remotos en Finanzas Empresa no disparaban `powersync:dataChanged`.

**Fix:** Las 7 tablas `company_finance_*` agregadas al listener en `powersync.ts`.

### Finanzas: migración dual-write → PowerSync-only (completada — junio 2026)

**Problema:** `finance_movement_entries` y `company_finance_movement_entries` hacían dual-write a `flowtask.db` + PowerSync. Esto violaba la directiva fundamental y podía causar divergencia entre dispositivos.

**Fix:** Todas las funciones de cargas (`addMovementEntry`, `updateMovementEntry`, `removeMovementEntry`, `listMovementEntries`, `attachEntriesCounts`, `deleteFinanceMovement`, `deleteCompanyFinanceMovement`, e `importMovements`) en `finance.ts` y `company-finance.ts` ahora usan exclusivamente `getPowerSyncDb()`. El `import { getDb }` fue eliminado de ambos archivos.

**Patrón de transacción:** `addMovementEntry` y `updateMovementEntry` usan `writeTransaction(tx)` para INSERT/UPDATE + `recalcMovementFromEntries(tx, id)` en la misma transacción SQLite. Los reads del recalc dentro de la transacción ven sus propias escrituras aún no commiteadas (comportamiento estándar de SQLite).

### Fix: Conciliador Contable — montos Flexxus 100× más grandes de lo real (resuelto — junio 2026)

**Síntoma:** importar el archivo Flexxus mostraba montos como `$26.990.000` en lugar de `$269.900`.

**Causa:** `parseFlexxus` usaba `raw: false` en SheetJS. Flexxus exporta celdas numéricas como `"269900.00"` (punto como decimal, formato US). La función `num()` original hacía `.replace(/\./g, '')` → `"26990000"` → 100× el valor real.

**Fix:** `parseFlexxus` ahora usa `raw: true`. Las celdas numéricas devuelven el número JavaScript directamente (`269900`), sin parseo de string.

**Nota sobre datos existentes:** si el archivo ya fue importado antes del fix, los valores incorrectos quedan guardados en `recon_invoices`. Solución: re-importar el archivo Flexxus desde la tab Importar del período.

**Regla:** en `parseFlexxus`, no cambiar `raw: true` a `raw: false`. La función `num()` en `recon-parsers.service.ts` tiene detección inteligente de separadores como fallback, pero `raw: true` es la protección principal.

### Comex: consolidación Marcas → Proveedores/Marcas (migración v79 — junio 2026)

**Concepto central:** "un proveedor es una marca" — en Naka Outdoors cada proveedor representa una marca de producto. La tabla `comex_brands` era redundante con `comex_suppliers`.

**Qué se hizo:**
- Eliminado submenu "Marcas" del sidebar Comex (9 → 8 entradas). Renombrado "Proveedores" → "Proveedores / Marcas".
- 6 nuevas columnas agregadas a `comex_suppliers` (y al schema PowerSync): `category`, `demand_annual`, `demand_monthly_json`, `current_stock`, `safety_stock`, `purchase_frequency_days`.
- Migración v79: copia datos de `comex_brands` (con `primary_supplier_id`) a `comex_suppliers` via `PRAGMA table_info` + ALTER TABLE idempotente + UPDATE condicional.
- `ComexBrands.tsx` y `ComexBrandDetail.tsx`: archivos conservados pero **desconectados del router** (ya no tienen ruta activa).
- `import_order_plannings` ahora usa `supplier_id` como referencia principal. **Compat:** `brand_id = supplier_id` en plannings nuevos (supplier actúa como marca).
- `ComexPlannings.tsx`: QuickCreateModal simplificado de 2 selectores (Marca + Proveedor) a 1 selector ("Proveedor / Marca"). Muestra `${s.brand} (${s.name})` cuando brand difiere del nombre de empresa.
- `ComexPlanningDetail.tsx`: fallback de nombre de marca: `brand?.name ?? supplier?.brand ?? supplier?.name ?? 'Programación'` (soporta plannings viejos y nuevos).
- `ComexSupplierDetail.tsx`: nueva sección "Marca & Demanda" con campos de demanda y grilla mensual (`MonthlyDemandGrid`).
- `ComexPlanningAIReports.tsx`: selector unificado "Proveedor / Marca"; en lista de reportes, `brand_id || supplier_id` busca en suppliers.

**Regla:** al crear nuevos plannings, siempre `brand_id = supplier_id`. No crear registros en `comex_brands` para marcas nuevas — usar el campo `brand` de `comex_suppliers`.

**Pendiente en Supabase (aún no aplicado):** ejecutar en el SQL editor:
```sql
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS demand_annual DOUBLE PRECISION;
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS demand_monthly_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS current_stock DOUBLE PRECISION;
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS safety_stock DOUBLE PRECISION;
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS purchase_frequency_days INTEGER;
```

---

## Módulo Contable → Servicios (junio 2026)

### Propósito

Panel de control de servicios recurrentes de la empresa: software/SaaS, seguros, dominios/hosting, servicios profesionales, bancarios, suscripciones, etc. Permite registrar cada pago/renovación, llevar historial, ver próximos vencimientos y gestionar datos de pólizas de seguros inline.

### Tablas (PowerSync ↔ Supabase — 3 tablas)

| Tabla | Contenido |
|-------|-----------|
| `accounting_services` | Un registro por servicio. Incluye campos de póliza de seguro inline (activos solo si `category = 'seguro'`). Soft delete via `deleted_at`. |
| `accounting_service_payments` | Historial de pagos/renovaciones por servicio. Asociado a `service_id`. |
| `service_catalog` | Catálogo editable de categorías, áreas internas y medios de pago. `config_type` = `'category'` \| `'area'` \| `'payment_method'`. Auto-seed de defaults en primer uso con IDs determinísticos (`catalog-{type}-{value}`). |

### IDs determinísticos en service_catalog

Los defaults se insertan con `id = catalog-${type}-${value}` (ej. `catalog-category-software`). Esto garantiza idempotencia: si dos dispositivos ceden simultáneamente, producen la misma PK y PowerSync deduplica sin error 23505. Los entries creados por el usuario tienen `id = catalog-${type}-${slug}-${timestamp}`.

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main/database/queries/accounting-services.ts` | CRUD servicios y pagos |
| `src/main/database/queries/service-catalog.ts` | CRUD catálogo + auto-seed de defaults |
| `src/main/ipc/accounting-services.ipc.ts` | Handlers IPC (`services:*`) |
| `src/main/ipc/service-catalog.ipc.ts` | Handlers IPC (`catalog:list`, `catalog:upsert`, `catalog:delete`) |
| `src/renderer/src/hooks/useAccountingServices.ts` | Hooks React Query servicios y pagos |
| `src/renderer/src/hooks/useServiceCatalog.ts` | Hooks React Query catálogo |
| `src/renderer/src/routes/contable/ServicesDashboard.tsx` | Panel principal con tabla, filtros, KPIs y modales |
| `src/renderer/src/routes/contable/ServiceFormModal.tsx` | Modal edición: 2 tabs (General / Contactos y docs), dropdowns con ⚙ para gestionar catálogo |
| `src/renderer/src/routes/contable/ServicePaymentsModal.tsx` | Modal de historial y registro de pagos |
| `src/renderer/src/routes/contable/ServiceCatalogModal.tsx` | Mini-modal para gestionar entradas de un tipo de catálogo (add/edit label/delete) |
| `src/renderer/src/routes/contable/services.constants.ts` | Constantes: STATUS_OPTIONS, FREQUENCY_OPTIONS, CURRENCY_OPTIONS (ARS/USD/EUR), helpers `dueStatus`, `fmtMoney` |

### Campos del formulario (ServiceFormModal — 2 tabs)

**Tab General:** nombre*, categoría (catálogo⚙), proveedor, área interna (datalist⚙), responsable interno, estado, descripción, valor, moneda, frecuencia, medio de pago (catálogo⚙), renovación automática, requiere aprobación, fechas (inicio/último pago/próximo venc./próxima renovación/límite decisión), datos de póliza (condicional si `category = 'seguro'`).

**Tab Contactos y docs:** contacto en proveedor (nombre/email/teléfono), responsable interno (nombre/email/teléfono), documentos (URL carpeta Drive, portal proveedor, notas).

### Reglas de tipo (IMPORTANTE)

`AccountingService.category` y `AccountingService.payment_method` son `string` (no union literal) para soportar valores custom del catálogo. Los helpers `CATEGORY_LABEL` y `PAYMENT_METHOD_LABEL` en `services.constants.ts` siguen siendo `Record<ServiceCategory, string>` para los defaults — usar cast `as ServiceCategory` con `?? rawValue` fallback.

---

## Módulo RRHH — Sueldos (junio 2026)

### Propósito

Carga mensual de recibos de sueldo en PDF → extracción de datos por colaborador → almacenamiento en Supabase → seguimiento histórico con comparación mes a mes → export a XLS.

### Tablas (PowerSync ↔ Supabase — 3 tablas)

| Tabla | Contenido |
|-------|-----------|
| `rrhh_colaboradores` | Un registro por empleado (documento es PK lógica). Campos: `nombre`, `documento`, `cuil`, `tarea_habitual`, `legajo`, `fecha_ingreso`, `activo` |
| `rrhh_periodos` | Un registro por mes/año procesado. Campos: `anio`, `mes`, `label`, `total_neto`, `cantidad_colaboradores`, `pdf_nombre`, `pdf_drive_file_id`, `pdf_drive_folder_id`, `fecha_pago`, `estado` ('borrador'/'confirmado') |
| `rrhh_sueldos` | Un registro por colaborador por período. Campos: `periodo_id`, `colaborador_id`, `total_neto`, `tarea`, `periodo_abonado`, `notas` |

**SQL aplicado en Supabase (junio 2026):**

```sql
-- Tablas base (creadas desde el inicio)
CREATE TABLE rrhh_colaboradores (...);
CREATE TABLE rrhh_periodos (...);
CREATE TABLE rrhh_sueldos (...);

-- Columnas agregadas posteriormente
ALTER TABLE rrhh_sueldos ADD COLUMN notas TEXT;
ALTER TABLE rrhh_colaboradores ADD COLUMN legajo TEXT;
ALTER TABLE rrhh_colaboradores ADD COLUMN fecha_ingreso TEXT;
```

Las tablas están en las sync-rules de PowerSync con `workspace_id = 'd61a4071-...'`.

### Multiempresa: NAKA + Estación Vertical (jun 2026)

El módulo maneja **dos empresas con datos 100% aislados** vía discriminador `empresa`
(`'naka'` | `'ev'`) en 4 tablas: `rrhh_colaboradores`, `rrhh_periodos`, `rrhh_sueldos`,
`rrhh_nomina_config`. `rrhh_listas` (sectores/puestos/categorías/bancos) es **compartida**.
Submenús: Sueldos NAKA · Nómina NAKA · Sueldos EV · Nómina EV. Títulos "Sueldos NAKA" /
"Sueldos Estación Vertical", etc. (`RRHH_EMPRESA_LABEL`).

- **Backend**: cada query/service/IPC recibe `empresa` como **parámetro explícito** (las ops por
  `id` único no lo necesitan). `getNextLegajoNumber` scopea la secuencia de legajo por empresa.
  Tipos en `shared/types.ts`: `RrhhEmpresa`, `RRHH_EMPRESAS`, `RRHH_EMPRESA_LABEL`.
- **Frontend**: `empresa` se resuelve desde la ruta `:empresa` vía `RrhhEmpresaContext`
  (`RrhhEmpresaLayout` + `useRrhhEmpresa`). Los hooks de `useRrhh.ts` la leen del context y la
  incluyen en **cada `queryKey`** → la caché de NAKA y EV no se mezcla. **Un solo componente por
  vista** parametrizado por empresa (no copy-paste) → cualquier cambio aplica a las dos.
- **Rutas**: `/rrhh/sueldos/:empresa(/:id)` y `/rrhh/nomina/:empresa(/:id)`; las rutas viejas
  (`/rrhh/sueldos`, `/rrhh/nomina`) redirigen a `/naka`. El guard de permisos matchea por prefijo,
  así que `canRead('rrhh','sueldos')` cubre ambas empresas.
- **Drive** (`drive.service.ts`): NAKA mantiene carpetas legacy ("Sueldos"/"Legajos") para no
  orfanar las existentes; EV usa sufijo ("Sueldos EV"/"Legajos EV"). Cache key de legajos por empresa.
- **DDL aplicado** (jun 2026): columna `empresa` + backfill + **drop de 3 índices UNIQUE secundarios**
  (`idx_rrhh_periodo_mes`, `idx_rrhh_colab_doc`, `idx_rrhh_sueldo_uniq`) que trababan `ps_crud` con 23505
  apenas dos empresas comparten mes/año o DNI. Ver "DDL RRHH multiempresa — APLICADO" más arriba.

### Lógica de re-upload (crítico)

Al subir un PDF para un período que ya existe (`getPeriodoByMes` devuelve resultado), el sistema:
1. **Actualiza** `total_neto`, `cantidad_colaboradores`, `pdf_nombre`, `fecha_pago` en el período
2. **Borra todos los `rrhh_sueldos`** del período (`clearSueldosByPeriodo`)
3. Re-inserta los sueldos del PDF nuevo
4. Borra el archivo anterior de Drive y sube el nuevo

Esto garantiza que re-subir un PDF (ej. borrador → definitivo) reemplaza todo correctamente.

### Sistema de lectura de PDFs

#### Infraestructura (`pdf-reader.service.ts`)

Usa **`pdfjs-dist`** (build legacy: `pdfjs-dist/legacy/build/pdf.mjs`) via `await import()` dinámico con `// @ts-ignore`. Devuelve para cada página:
- `pageNum`: número de página (= número de recibo, 1 recibo por página)
- `width`, `height`: dimensiones en puntos (A4 landscape = 842×595)
- `items`: array de `PdfTextItem` — cada ítem tiene `str` (texto), `x`, `y` (coordenadas desde la esquina inferior izquierda)

**Importante:** `pdfjs-dist` no se puede importar con `import` estático en el main process de Electron — usar siempre `await import('pdfjs-dist/legacy/build/pdf.mjs')` con `// @ts-ignore`.

#### Extractor de recibos (`payroll-pdf.extractor.ts`)

Dos estrategias de extracción para el formato de recibo de Naka Outdoors (A4 landscape, 1 recibo = 1 página):

**1. Coordenadas hardcodeadas** (para campos con posición fija en el recibo):

```typescript
const COORDS = {
  apellido:  { y: 499, x: 28  },   // Apellido y Nombres
  documento: { y: 499, x: 163 },   // Número de documento
  cuil:      { y: 527, x: 333 },   // CUIL
  fecha:     { y: 450, x: 205 },   // Fecha de pago
  tarea:     { y: 450, x: 256 },   // Tarea desempeñada
  periodo:   { y: 436, x: 77  },   // Período abonado
  totalNeto: { y: 60,  x: 283 },   // Total neto (label)
}
```

Solo se procesa la **mitad izquierda** de cada página (`x < pageWidth / 2`) porque los recibos de esta empresa tienen el contenido informativo a la izquierda.

El `Y_TOL = 5` permite agrupar ítems en la misma fila aunque no estén en exactamente el mismo y. `X_TOL = 15` para matching de columna.

**2. Búsqueda por etiqueta** (para campos con posición variable):

```typescript
const LEGAJO_LABELS  = ['LEGAJO', 'LEG.', 'NRO.LEG', ...]
const INGRESO_LABELS = ['F.INGRESO', 'FEC.ING', 'FECHA ING', 'INGRESO', ...]
```

`findValueByLabel()` recorre **toda la página** (no solo mitad izquierda), busca la etiqueta y devuelve el primer token no-vacío a su derecha en la misma fila. Usado para `legajo` y `fecha_ingreso` porque su posición varía por modelo de recibo.

**Para ajustar la extracción a un nuevo modelo de recibo:** imprimir todas las coordenadas con un script de debug (`console.log(items)` del `pdf-reader`) y ajustar `COORDS`. Si el campo tiene posición variable, agregar su etiqueta a `LEGAJO_LABELS`/`INGRESO_LABELS` o crear una nueva lista.

#### Parseo del período abonado

Los recibos contienen texto como `"5 - 2026 Haberes normales"`. El regex `/(\d{1,2})\s*[-–]\s*(\d{4})/` extrae `mes=5, anio=2026`. Fallback: parsear desde el campo `fecha` (DD/MM/YYYY).

### Carpetas de Drive

```
Summit RRHH/
  Sueldos/
    05-2026/
      sueldos_05-2026.pdf   ← PDF original subido
    06-2026/
      sueldos_06-2026.pdf
```

La carpeta raíz `Summit RRHH` se cachea en `electron-store` como `rrhhRootFolderId` para evitar buscarla en cada upload.

### Alertas inteligentes (post-upload)

Generadas automáticamente al cargar un período:
- `nuevo`: colaborador que no existía en el período anterior
- `ausente`: colaborador del período anterior que no aparece en el actual
- `aumento`: variación ≥ +5% vs mes anterior
- `baja`: variación ≤ -5% vs mes anterior

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main/services/pdf-reader.service.ts` | Wrapper de pdfjs-dist — extrae ítems de texto con coordenadas |
| `src/main/services/payroll-pdf.extractor.ts` | Extractor específico de recibos — coordenadas + búsqueda por etiqueta |
| `src/main/services/rrhh.service.ts` | Orquestador: PDF → extracción → DB → Drive → alertas |
| `src/main/database/queries/rrhh.ts` | CRUD: colaboradores, períodos, sueldos, historial, ausentes |
| `src/main/ipc/rrhh.ipc.ts` | Handlers IPC (`rrhh:*`) incluyendo export XLS |
| `src/renderer/src/hooks/useRrhh.ts` | Hooks React Query para todo el módulo |
| `src/renderer/src/routes/rrhh/SueldosDashboard.tsx` | Dashboard: upload PDF, KPIs, gráfico evolución, cards por período |
| `src/renderer/src/routes/rrhh/PeriodoDetail.tsx` | Detalle: tabla completa con legajo/doc/cuil/tarea/antigüedad/notas, buscador, filtro por tarea, export XLS, historial por colaborador (slide-over) |

### Fix: drag-and-drop de PDFs en Electron

`(file as File & { path?: string }).path` no funciona en Electron con contextIsolation. El fix correcto es exponer `webUtils.getPathForFile` desde el preload:

```typescript
// preload/index.ts
utils: {
  getFilePath: (file: File): string => webUtils.getPathForFile(file),
}
```

Y en el renderer usar `window.api.utils.getFilePath(file)` en el handler `onDrop`. Aplicado en `SueldosDashboard.tsx`. **Este patrón debe replicarse en cualquier otro componente que reciba archivos via drag-drop.**

El selector de archivo (clic) usa `dialog.showOpenDialog` via IPC (`rrhh:selectPdf`), igual que el módulo Knowledge. No usar `<input type="file">` para selección de archivos nativos en Electron.

### Export XLS

El export usa la librería **`xlsx`** (SheetJS, ya en `package.json`). Arquitectura:

1. El **renderer** prepara el array de filas (con los datos ya filtrados/ordenados tal como se ven en pantalla)
2. Lo envía al **main process** via IPC `rrhh:exportXls` junto con `periodoLabel` y `defaultFileName`
3. El main process corre `XLSX.utils.json_to_sheet(rows)` y abre el diálogo `dialog.showSaveDialog`
4. Guarda el `.xlsx` en la ruta elegida

**Crítico:** el renderer siempre manda las filas ya procesadas — el main process no refetch data. Esto garantiza que el XLS refleja exactamente la vista (con filtros aplicados). Usar `require('xlsx')` en el main (no `await import()`).

---

## Módulo Cortex — Graphify (grafo de código)

### Qué es

Cortex es el módulo de Summit que expone el grafo de dependencias del código fuente generado por **Graphify** (`graphifyy` v0.8.44). Permite:
- Consultas en lenguaje natural sobre la arquitectura (`graphify query`)
- Rutas entre componentes (`graphify path`)
- Descripción de nodos (`graphify explain`)
- Visualización interactiva animada del grafo completo

### Stats del grafo (actualizado junio 2026)

| Métrica | Valor |
|---------|-------|
| Nodos | 3 228 |
| Aristas | 6 782 |
| Comunidades | 128 |

### Archivos

```
C:\Projects\flowtask\graphify-out\
  graph.json         ← datos del grafo (fuente de verdad)
  graph.html         ← visualización D3 interactiva (animada, arrastrable)
  GRAPH_REPORT.md    ← reporte de texto con resumen de comunidades
  manifest.json      ← metadata del último extract
```

`graphify-out/` versiona en git **solo los outputs legibles** (`graph.html`, `GRAPH_REPORT.md`, `manifest.json`) para poder verlos desde la laptop con `git pull`; los archivos pesados/derivados (`graph.json`, `cache/`, backups `20*/`, dotfiles `.graphify_*`) quedan en `.gitignore`.

### Binario y entorno

```
Binario (shim):  C:\Users\Diego\.local\bin\graphify.exe
Venv (pipx):     C:\Users\Diego\pipx\venvs\graphifyy\
Python del venv: C:\Users\Diego\pipx\venvs\graphifyy\Scripts\python.exe
Exe del venv:    C:\Users\Diego\pipx\venvs\graphifyy\Scripts\graphify.exe
```

**OJO:** `graphify` **no siempre resuelve en el PATH del shell** (en PowerShell no-interactivo falla con "no se reconoce como cmdlet"). Invocarlo por ruta completa con el exe del venv: `& "C:\Users\Diego\pipx\venvs\graphifyy\Scripts\graphify.exe" <cmd>`. Solo la extracción semántica de archivos no-código necesita `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`; `update`, `cluster-only`, `query`, `path`, `explain` NO requieren API key.

**Regenerar el grafo (sin LLM):**
```powershell
cd C:\Projects\flowtask
$env:PYTHONHASHSEED = 0   # clustering determinístico (igual que el hook)
$gfy = "C:\Users\Diego\pipx\venvs\graphifyy\Scripts\graphify.exe"
& $gfy update .                  # RE-ESCANEA el código → incorpora archivos nuevos/modificados (lo correcto tras editar)
& $gfy cluster-only --no-label   # SOLO recalcula clusters sobre el grafo existente (NO ve archivos nuevos)
```
**Diferencia clave:** tras crear o borrar archivos hay que correr **`update .`** (re-extrae el AST); `cluster-only` solo re-clusteriza lo ya extraído. Usar `--force` en `update` si el rebuild quedó con menos nodos (tras refactors que borran código).

### Git hooks instalados

Los hooks en `C:\Projects\flowtask\.git\hooks\` actualizan el grafo automáticamente:

| Hook | Qué hace |
|------|----------|
| `post-commit` | Re-extrae los archivos cambiados (`_rebuild_code`, equivalente a `update`) en **background** tras cada commit. Usa el python del venv pipx pinneado en el propio hook. |
| `post-checkout` | Ídem tras cada checkout de rama |

Esto mantiene `graph.json` y `graph.html` sincronizados con el estado del código **sin requerir LLM**.

### IPC handlers (`src/main/ipc/cortex.ipc.ts`)

| Canal | Acción |
|-------|--------|
| `cortex:openGraph` | Abre `graph.html` en el navegador del sistema (`shell.openPath`) |
| `cortex:openGraphWindow` | Abre `graph.html` en una ventana Electron dedicada (1440×900, D3 interactivo) |
| `cortex:getReport` | Lee y devuelve `GRAPH_REPORT.md` como string |
| `cortex:query` | Corre `graphify query <pregunta>` y devuelve texto |
| `cortex:path` | Corre `graphify path <from> <to>` y devuelve texto |
| `cortex:explain` | Corre `graphify explain <nodo>` y devuelve texto |

### Archivos del módulo

| Archivo | Rol |
|---------|-----|
| `src/main/ipc/cortex.ipc.ts` | Handlers IPC — llama al binario graphify via `child_process.exec` |
| `src/renderer/src/routes/cortex/CortexDashboard.tsx` | UI con hero animado (SVG SMIL), stats, botones prominentes, 4 tabs |
| `src/preload/index.ts` | Namespace `window.api.cortex` con 6 métodos |

### ¿Claude usa el grafo automáticamente antes de programar?

**No automáticamente.** El grafo existe y se mantiene actualizado via git hooks, pero Claude Code no lo consulta por defecto antes de escribir código.

**Para usarlo:** Diego puede pedir explícitamente "consultá el grafo antes de empezar" o ejecutar `graphify query` desde Cortex para obtener contexto previo a una sesión de programación.

**Para automatizarlo (opcional):** se pueden crear hooks de Claude Code en `.claude/hooks/` que lean `graphify-out/GRAPH_REPORT.md` e inyecten contexto antes de ciertas herramientas. No está configurado aún.

---

### IPC: drag-drop de archivos enviaba `number[]` (lento/crasheable para archivos grandes)

**Problema:** El renderer hacía `Array.from(new Uint8Array(buf))` antes de enviar por IPC, creando un array de millones de enteros para PDFs de > ~5MB. La serialización JSON podía bloquear el hilo main o crashear.

**Fix:** El renderer ahora envía el `ArrayBuffer` directamente (structured clone nativo de Electron). Tipos actualizados en `useComex.ts`, `preload/index.ts` y `comex.ipc.ts`.
