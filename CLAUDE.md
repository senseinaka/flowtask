# Summit — Contexto del proyecto para Claude Code

> **Para Claude:** Al finalizar una sesión con cambios arquitecturales o fixes significativos, proponer al usuario actualizar este archivo con lo que cambió. Este archivo es el único contexto que persiste entre sesiones.

> **Para Claude — antes de programar tareas grandes:** Para tareas estructurales, de riesgo medio/alto, o que toquen múltiples módulos, consultar Graphify o leer `graphify-out/GRAPH_REPORT.md` antes de editar código. Esto aplica especialmente a: módulos nuevos, cambios en Supabase/sync, autenticación, rutas, arquitectura, integraciones, dashboards de Finanzas/Empresa, Calendario, CRM y refactors. Antes de empezar, explicar: (1) archivos involucrados, (2) dependencias, (3) riesgos, (4) patrones existentes a reutilizar, (5) plan de implementación.

## Qué es Summit

Summit es el sistema operativo central de **Naka Outdoors** y de su CEO, **Diego Nakamura**. Centraliza en una sola aplicación de escritorio todo lo necesario para gestionar la empresa y la productividad personal:

### Módulos actuales

- **Comex (Comercio Exterior):** gestión completa de importaciones de Naka Outdoors. Seguimiento de embarques, documentos para despachante y personal, presupuestos logísticos de operadores de flete, pagos, costos, arancel, proformas, planificación de pedidos con IA, y **cotizaciones USD/EUR** propias vs. la Divisa Venta del BCRA (`/comex/cotizaciones`).
- **Tareas / Kanban:** sistema de gestión de tareas con tablero kanban, dependencias, recordatorios y delegación.
- **Agenda / Calendario:** integración con Google Calendar. Sistema para programar envíos de mensajes por WhatsApp con recordatorios automáticos.
- **Agenda / Contactos:** agenda completa de contactos. Multi-teléfono, multi-email, empresa, cargo, etiquetas, favoritos, grupos y notas. Rutas `/agenda/contactos` (detalle) y `/agenda/grupos` (gestión de grupos). Tabla `contacts` en `flowtask.db` — local, no sincroniza. Grupos en `agenda_grupos` y `agenda_grupo_miembros` (local).
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
- **Contable → Cajas Internas:** gestión de las cajas de efectivo de la empresa (caja chica, cajas por área, multi-moneda ARS/USD/EUR). Ingresos, egresos, transferencias entre cajas, conteos/arqueos, diferencias, permisos por usuario/caja y cierre diario, con export a Excel. Rutas `/contable/cajas`. 13 tablas PowerSync `cash_*` (incl. `cash_attachments` para comprobantes en Drive, `cash_movement_breakdowns` para el desglose de billetes por movimiento y `cash_operators` para los operadores de caja con PIN de 4 dígitos).
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

## Entender el código rápido — graphify

`graphify` es una herramienta CLI (Python, instalada con pipx) que genera un **grafo
semántico del repo**: nodos = funciones/componentes/tablas/etc., aristas = quién llama o
depende de quién. Sirve para entender flujos, dependencias e impacto en este codebase grande
**sin leer todos los archivos**.

- **Binario:** `C:\Users\Diego\.local\bin\graphify.exe` (NO está en el PATH de bash/PowerShell;
  invocar siempre con la ruta completa).
- **Salida:** carpeta `graphify-out/` en el repo → `graph.json` (el grafo), `graph.html`
  (visor interactivo), `GRAPH_REPORT.md` (resumen). Hay backups con fecha dentro.

**Cuándo usarlo:**
- Antes de tocar algo desconocido: ver qué consume/produce una función o tabla.
- Análisis de impacto: qué se rompe si cambio X (`affected`).
- Trazar un flujo punta a punta (IPC → main → query → UI).

**Comandos útiles** (siempre con ruta completa al `.exe`):
```bash
# Re-extraer el grafo después de cambiar código (NO usa LLM, es rápido)
"C:\Users\Diego\.local\bin\graphify.exe" update C:/Projects/flowtask

# Preguntar en lenguaje natural (BFS sobre graph.json)
"C:\Users\Diego\.local\bin\graphify.exe" query "cómo se sincroniza finance_concepts"

# Explicar un nodo en lenguaje llano
"C:\Users\Diego\.local\bin\graphify.exe" explain "hydrateMovement"

# Camino más corto entre dos nodos
"C:\Users\Diego\.local\bin\graphify.exe" path "ComexImports" "useComexImports"

# Qué depende de un nodo (impacto inverso)
"C:\Users\Diego\.local\bin\graphify.exe" affected "powersync.ts"
```

**Regla práctica:** correr `update` después de cambios de código para refrescar el grafo
antes de consultarlo. `graphify label` (renombra comunidades vía LLM) necesita API key y es
opcional — no hace falta para navegar.

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
- `cash_companies`, `cashboxes`, `cashbox_permissions`, `cash_categories`, `cash_movements`, `cash_movement_amounts`, `cash_movement_breakdowns`, `cash_operators`, `cash_counts`, `cash_count_details`, `cash_differences`, `cash_audit_logs`, `cash_attachments` (Cajas Internas; `cash_movement_breakdowns` y `cash_operators` con DDL pendiente — desglose de billetes y operadores con PIN)

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

3. **El rol de replicación `powersync_repl` necesita `SELECT` sobre la tabla nueva.** La publication `powersync` es `FOR ALL TABLES`, así que la tabla nueva entra sola a la replicación lógica — *pero* el `GRANT ... ON ALL TABLES IN SCHEMA public` que se corrió al configurar PowerSync es un snapshot puntual y **NO cubre las tablas creadas después**. Sin ese grant, la replicación falla con `permission denied for table <tabla>` (error de validación al desplegar las sync-rules) y la tabla **nunca sincroniza**, aunque el resto del schema funcione. Fix puntual: `GRANT SELECT ON <tabla> TO powersync_repl` (o copiar grants de una tabla que ya replica, ej. `comex_suppliers`). **Fix permanente — YA APLICADO (confirmado 28-jun-2026):** existe `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO powersync_repl`, así que toda tabla nueva creada por `postgres` (ej. desde el SQL Editor de Supabase) hereda el `SELECT` sola — el paso (b) ya no hace falta para esas. Solo se necesita el grant manual si la tabla se crea con otro rol (ej. `supabase_admin`), cuyo default ACL no incluye a `powersync_repl`. Ver "Fix: tablas PowerSync nuevas no sincronizaban".

4. **Agregar la tabla a las sync-rules del servidor PowerSync** (una línea `SELECT * FROM <tabla> WHERE workspace_id = 'd61a4071-...'` por tabla). Las sync-rules se editan y despliegan en el dashboard de PowerSync, **aparte** del schema de Supabase. Si falta, la tabla no baja a ningún dispositivo (síntoma: "Sin registros" aunque Supabase tenga datos).

**Resumen:** crear una tabla sincronizada son TRES pasos que van juntos — (a) DDL con RLS+policy+GRANT a `authenticated`, (b) `SELECT` para `powersync_repl` — **ya automático** vía el `ALTER DEFAULT PRIVILEGES` puesto para `postgres` (regla #3; solo manual si creás la tabla con otro rol), (c) línea en las sync-rules. La publication es `FOR ALL TABLES`, así que NO hay que tocarla. Si falta (a) o (c), no sincroniza y el síntoma varía (`42501`, "sin registros", o nada).

### ❌ Solo local (NO sincroniza — por diseño)

Estas tablas viven únicamente en `flowtask.db` porque representan estado local del dispositivo que no tiene sentido sincronizar:

- `attachments` — archivos adjuntos de tareas (binarios locales)
- `email_*` — módulo de correo (usa `email-db.ts`, caché local de IMAP)
- `recon_*` — Conciliador Contable: `recon_periods`, `recon_imports`, `recon_invoices`, `recon_cupones`, `recon_ml_ops`, `recon_results`, `recon_audit` (solo el contador opera este módulo en su PC)
- `bcra_rates_cache` — caché local de cotizaciones diarias del BCRA (migración v95). Se baja de la API pública del BCRA y de argentinadatos.com (BNA); no tiene sentido sincronizar.
- `agenda_grupos`, `agenda_grupo_miembros` — grupos de contactos (migración v97). Local-only porque `contacts` también es local.
- `comex_alarmas_cotizacion` — alarmas de cotización USD/EUR (migración v96). Local porque disparan WA desde este dispositivo.
- Tablas de caché y configuración de UI local

### Función `restoreComexLocalCache` / `restoreCompanyFinanceLocalCache`

Estas funciones copian `flowtask.db → psDb` en el primer arranque (cuando `psDb count = 0`) para hacer el bootstrap inicial de datos históricos. **No son la fuente de verdad** — son un mecanismo de seeding único para que PowerSync pueda subir los datos existentes a Supabase en la primera sincronización.

---

## Patrón de migraciones (flowtask.db)

Las migraciones de `flowtask.db` están en `src/main/database/migrations.ts`.

```typescript
// Cada migración es un objeto { version: number, up: (db) => void }
// Se aplican en orden ascendente; la versión actual se guarda en PRAGMA user_version
// Versión actual: v101
// v80: knowledge_entries + knowledge_global_summaries
// v81: user_profiles
// v82–v94: mercadopago_*, accounting_services / service_catalog, RRHH multiempresa + SAC
// v95: bcra_rates_cache (caché BCRA — local)
// v96: comex_alarmas_cotizacion (alarmas USD/EUR — local)
// v97: contacts extendida (company, role, phones JSON, emails JSON, tags JSON, favorito);
//      agenda_grupos + agenda_grupo_miembros — local, NO sincroniza
// v98–v101: Conciliador — recon_invoices.fecha + índices UNIQUE de dedup (period+comprobante/cupón/
//      operación), recon_imports.skipped_count, columna import_id en recon_*, y tablas nuevas
//      recon_nave_ops + recon_extracto (cobros NAVE + extracto bancario). Todas local (flowtask.db).
//
// NOTA: las tablas de Cajas Internas (cash_*) NO usan migración de flowtask.db — nacen en PowerSync
//       (ver AppSchema en powersync.ts). Solo necesitan DDL en Supabase + grant de replicación + sync-rules.
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
- **Pago por horas / personal doméstico** (jun 2026): el concepto personal admite `hourly_rate` (jornal por hora) y `viatic_amount` (viático fijo por jornada). Cuando `hourly_rate > 0`, al registrar una carga en `MovementEntriesQuickList` aparece el botón **"Por horas"**: en vez de tipear el monto se ingresan las horas y el sistema calcula `monto = horas × hourly_rate + viático`, autocompletando la nota (`"8 h × $9.000 + $3.000 viático — limpieza general"`). Caso de uso: Sandra (se le paga semanal por hora + viático). **Sólo la tabla personal `finance_concepts` declara estas 2 columnas** — `company_finance_concepts` queda intacta: en `powersync.ts` se hizo `financeConceptColumnsWithHours = {...financeConceptColumns, hourly_rate, viatic_amount}` usado sólo por `finance_concepts`, y el `concept` embebido de `company-finance.ts hydrateMovement` los expone hardcodeados en 0. DDL = `supabase_finance_concepts_horas.sql` (ALTER ADD COLUMN, no toca sync-rules porque la regla usa `SELECT *`). `finance.ts hydrateMovement` trae `c_hourly_rate`/`c_viatic_amount` (vía `SELECT c.*` aliased) para que el botón también aparezca en la vista de movimientos. Config por concepto: inputs "Valor hora (jornal)" / "Viático por jornada" en el form de Nuevo concepto y en el de edición.
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
| `src/main/database/migrations.ts` | Migraciones de `flowtask.db` (versión actual: v101) |
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

### Tablas del Conciliador en `flowtask.db` (migración v78, ampliada hasta v101)

| Tabla | Contenido |
|-------|-----------|
| `recon_periods` | Períodos de conciliación (mes/año + estado) |
| `recon_imports` | Log de cada archivo importado por período (`skipped_count` desde v99) |
| `recon_invoices` | Facturas parseadas de Flexxus (`fecha` desde v98; dedup UNIQUE `period_id, comprobante`; `import_id` desde v100) |
| `recon_cupones` | Cupones parseados de la procesadora de tarjetas (dedup UNIQUE `period_id, cupon`) |
| `recon_ml_ops` | Operaciones parseadas de Mercado Pago (dedup UNIQUE `period_id, operation_id`) |
| `recon_nave_ops` | Operaciones de cobro NAVE (migración v101) |
| `recon_extracto` | Movimientos del extracto bancario — crédito por leyenda (migración v101) |
| `recon_results` | Resultados del motor de matching (uno por factura/operación) |
| `recon_audit` | Historial de cambios manuales de estado |

Estos índices `UNIQUE` de dedup **son válidos acá** porque el Conciliador es local-only (`flowtask.db`); la regla de "sin UNIQUE además de la PK" aplica solo a las tablas PowerSync ↔ Supabase.

### Fuentes de importación (`ReconImportSource`)

```typescript
type ReconImportSource =
  | 'flexxus_ventas'   // XLSX Flexxus — sección "Ingresos Ventas"
  | 'cupones_csv'      // CSV de procesadora de tarjetas (Latin-1, separador `;`)
  | 'cupones_xlsx'     // XLSX de cupones con sección "TARJETAS DE CREDITO"
  | 'ml_principal'     // XLS Mercado Pago cuenta principal
  | 'ml_secundaria'    // XLS Mercado Pago cuenta secundaria
  | 'nave'             // operaciones de cobro NAVE
  | 'extracto'         // extracto bancario (crédito por leyenda)
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

**`cash_attachments`** (comprobantes de Cajas Internas, Etapa 2): DDL completo en `supabase_cash_attachments.sql` + sync-rule. Ver "Módulo Contable → Cajas Internas → Comprobantes".

---

## Módulo Knowledge — estado actual (junio 2026)

**Tablas (migración v80):** `knowledge_entries` + `knowledge_global_summaries` (PowerSync ↔ Supabase). Tipos en `src/shared/types.ts` (`KnowledgeEntry`, `KnowledgeGlobalSummary`, etc.).

**Implementado (jun 2026) — módulo completo y en uso:**
- `src/main/database/queries/knowledge.ts` — CRUD
- `src/main/services/knowledge-ai.service.ts` — resúmenes IA con claude-haiku-4-5
- `src/main/ipc/knowledge.ipc.ts` — handlers IPC
- `src/renderer/src/hooks/useKnowledge.ts` — hooks React Query
- `src/renderer/src/routes/knowledge/` — UI: `KnowledgeDashboard.tsx` + QuickCapture, EntryEditor/Card, RichTextEditor, AIPanel, SourcesModal, ThreadDocModal, AttachmentStrip, Helpers. Ruta `/knowledge`.

**Setup Supabase (verificado 27-jun-2026):** las 2 tablas existen en Supabase y replican OK — `knowledge_entries` con datos en uso (13 filas), `knowledge_global_summaries` lista (0 filas, aún sin resúmenes globales generados). Publication `powersync` FOR ALL TABLES + grant `SELECT` a `powersync_repl` confirmados. No queda setup pendiente.

---

## Módulo Comex → Cotizaciones USD/EUR (junio 2026)

Seguimiento de las cotizaciones propias de USD y EUR (precios Naka al público en ARS) vs. las cotizaciones oficiales del BCRA (divisa) y BNA (billete), con gráfico de 6 meses, alarmas por WhatsApp y chip de desvío porcentual. Ruta `/comex/cotizaciones`.

### Cotizaciones propias (PowerSync)

Tabla `comex_cotizaciones` (`moneda`, `valor_ars`, `nota`, `created_at`). Se cargan a mano; la **fecha es editable** (default hoy) → `created_at` = mediodía de la fecha elegida (evita saltos de TZ). Cada moneda es una `MonedaCard` con estado local propio — **no compartir un solo estado entre USD y EUR** (ese fue un bug: editar una borraba el valor de la otra).

**DDL Supabase** (ya aplicado jun 2026): tabla `comex_cotizaciones` con RLS + GRANT para `authenticated` + sync-rule `SELECT * FROM comex_cotizaciones WHERE workspace_id = '...'`.

### Cotizaciones BCRA + BNA (local, NO sincroniza)

- **BCRA Divisa:** `src/main/services/bcra.service.ts`. **Endpoint con moneda en path:** `/estadisticascambiarias/v1.0/Cotizaciones/{moneda}?fechadesde=&fechahasta=` (el endpoint genérico `/Cotizaciones` sin moneda no acepta rango de fechas). `results` es array de días; valor en ARS en `detalle[].tipoCotizacion` (número). **Fechas en hora LOCAL** (`getFullYear/Month/Date`, no `toISOString()`): en UTC-3 el ISO salta de día de noche. Cache en `bcra_rates_cache` (flowtask.db, migración v95) con fetch incremental.
- **BNA Billete:** `src/main/services/bna.service.ts`. Fuente: `https://api.argentinadatos.com/v1/cotizaciones/` (devuelve `{ moneda, casa, compra, venta, fecha }`). `getBnaBilleteHoy()` filtra el más reciente por moneda. IPC `comex:bcra:hoy` mergea BCRA divisa + BNA billete en un solo response: `{ moneda, fecha, divisa_venta, billete_venta }`. Si es fin de semana/feriado, el servicio BCRA devuelve el último valor conocido de la cache con la fecha real del registro (no la fecha de hoy).
- **Cache fallback:** si BCRA no devuelve datos para hoy (fines de semana), se usa la última fecha disponible en `bcra_rates_cache` vía subquery correlated `WHERE fecha = (SELECT MAX(fecha) FROM bcra_rates_cache WHERE moneda = ...)`. La fecha real del dato se muestra en UI ("viernes 27/06" etc.) para que el usuario sepa que no es de hoy.

### Alarmas de cotización (local)

Tabla `comex_alarmas_cotizacion` (flowtask.db, migración v96). Campos: `moneda`, `tipo_cotizacion` (divisa/billete), `tipo_umbral` (porcentaje/absoluto), `umbral`, `direccion` (supera/baja), `activa`, `whatsapp_numero`, `cooldown_horas`, `ultima_alerta_at`. El servicio `bcra-alarmas.service.ts` evalúa las alarmas al pedir cotizaciones y envía WA via Evolution API cuando se cumple la condición. IPC: `comex:alarmas:*`.

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main/services/bcra.service.ts` | BCRA divisa: fetch, cache incremental, fallback fin de semana |
| `src/main/services/bna.service.ts` | BNA billete: argentinadatos.com, caché en memoria 30 min |
| `src/main/ipc/comex.ipc.ts` | `comex:bcra:hoy` mergea BCRA + BNA; `comex:alarmas:*` |
| `src/renderer/src/routes/comex/CotizacionesPage.tsx` | UI: BilletesDivisaWidget, MonedaCard, AlarmasInlinePanel, gráfico 6m |
| `src/renderer/src/routes/comex/CotizacionAlarmasModal.tsx` | Modal CRUD de alarmas |

---

## Módulo Agenda → Contactos y Grupos (junio 2026)

### Propósito

Agenda de contactos de la empresa con soporte multi-dispositivo (local-only). Permite registrar personas con múltiples teléfonos, correos, etiquetas, empresa, cargo, favoritos y notas. Los contactos se agrupan en **Grupos** (para usar en alertas, WhatsApp, etc.). Accesible desde el panel lateral en Agenda.

### Tablas (flowtask.db — local, NO sincronizan)

| Tabla | Contenido |
|-------|-----------|
| `contacts` | Contactos. Extendida en v97: `company`, `role`, `phones TEXT` (JSON array de `{numero, etiqueta}`), `emails TEXT` (JSON), `tags TEXT` (JSON), `favorito INTEGER`. Columnas legacy `phone`/`email` (strings) mantenidas para backward compat — se actualizan en sync con el primer elemento del array. |
| `agenda_grupos` | Grupos de contactos (`id`, `nombre`, `descripcion`, `color`, `created_at`, `updated_at`). |
| `agenda_grupo_miembros` | Membresías (`grupo_id`, `contact_id`, `added_at`, PK compuesta). ON DELETE CASCADE en ambas FKs. |

### Schema de `phones` / `emails` en DB

```typescript
// Stored as JSON string in SQLite
interface ContactPhone { numero: string; etiqueta: 'personal' | 'trabajo' | 'otro' }
interface ContactEmail { direccion: string; etiqueta: 'personal' | 'trabajo' | 'otro' }

// La migración v97 usa json_array(phone) → ["1234567890"] (string crudo, no objeto)
// parseContact() normaliza esto a [{numero, etiqueta:'personal'}] automáticamente
```

**CRÍTICO:** la migración v97 corre `json_array(phone)` que produce `["numero"]` (array de strings), no `[{numero,etiqueta}]`. `parseContact()` en `queries/contacts.ts` detecta si el elemento es `string` y lo convierte a `ContactPhone`. Nuevas escrituras siempre guardan objetos correctamente.

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main/database/queries/contacts.ts` | CRUD contactos + CRUD grupos/membresías. `parseContact()` normaliza JSON arrays desde DB. |
| `src/main/ipc/contacts.ipc.ts` | IPC contactos (`contacts:*`) + grupos (`agenda:grupos:*`, `agenda:contactos:grupos`) |
| `src/renderer/src/hooks/useContacts.ts` | Hooks: `useContacts`, `useCreateContact`, `useUpdateContact`, `useDeleteContact`, `useAgendaGrupos`, `useCreateGrupo`, `useUpdateGrupo`, `useDeleteGrupo`, `useGrupoMembers`, `useAddGrupoMember`, `useRemoveGrupoMember`, `useContactGrupos` |
| `src/renderer/src/routes/agenda/AgendaContactos.tsx` | Panel 2 columnas con resize persistido (localStorage `agenda-contacts-split`): lista alfabética + detalle inline editable. Multi-teléfono, multi-email, grupos, etiquetas (tag input), notas, favorito, quick-WA. |
| `src/renderer/src/routes/agenda/AgendaGrupos.tsx` | Gestión de grupos: lista + detalle con miembros + buscador para agregar. |

### Resize del panel izquierdo

`AgendaContactos.tsx` tiene un divider arrastrable entre la lista y el detalle. El ancho se guarda en `localStorage` bajo la clave `agenda-contacts-split` (200–480 px). El filtro de tipos usa `flex-wrap` para que todos los chips sean visibles a cualquier ancho.

### Rutas

```
/agenda/contactos   → AgendaContactos.tsx
/agenda/grupos      → AgendaGrupos.tsx
/contacts           → Contacts.tsx (legacy, mantenido pero no linkado en sidebar)
```

El sidebar Agenda incluye "Contactos" → `/agenda/contactos` y "Grupos" → `/agenda/grupos`. Desapareció del sidebar Trabajo.

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

### Fix: tablas PowerSync nuevas no sincronizaban — grants, sync-rules y recreación de powersync.db (resuelto — junio 2026)

Saga al sumar las 10 tablas `cash_*` (Cajas Internas). Varias causas **independientes**, todas reproducibles al crear cualquier tabla sincronizada nueva:

1. **Faltaba el grant de `SELECT` al rol de replicación `powersync_repl`.** Síntoma: error de validación `permission denied for table cash_companies` (y las otras 9) al desplegar las sync-rules. La publication `powersync` es `FOR ALL TABLES` (la tabla entra sola a la replicación), pero el `GRANT ... ON ALL TABLES IN SCHEMA public` de cuando se configuró PowerSync **no alcanza a tablas creadas después**. Fix: `GRANT SELECT` a `powersync_repl` (copiar de `comex_suppliers`). Esto ya quedó resuelto a futuro — hay un `ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... GRANT SELECT ... TO powersync_repl` (confirmado 28-jun-2026), así que las tablas nuevas creadas por `postgres` heredan el grant solas. Ver regla #3 de "Reglas al crear una tabla sincronizada nueva".

2. **Las tablas no estaban en las sync-rules.** Síntoma: "Sin cajas registradas" aunque Supabase tenía los datos y el resto del sync andaba. El bucket del servidor traía ~2900 ops y **cero** de cajas. Fix: una línea `SELECT * FROM <tabla> WHERE workspace_id = '...'` por tabla nueva en el dashboard de PowerSync. De paso se limpiaron 2 duplicados y un typo `}` en el YAML deployado.

3. **Recrear `powersync.db` reintroduce datos viejos en la cola.** Durante el diagnóstico se borró `powersync.db` para forzar un re-sync. Al recrearse, las migraciones legacy (`migrateLegacyTableData`, `restoreComexLocalCache`, etc.) **re-copian cientos de filas de `flowtask.db` a `ps_crud`**, inflando la cola de upload y destapando bugs latentes (ver los dos fixes de connector más abajo). **Borrar `powersync.db` NO es un fix de sync** — solo reintroduce trabajo. Si hay que recuperarse, dejar que la cola drene sola.

4. **`CORRUPT_INDEX` en la transición de iteración de sync-rules.** Al redeployar las sync-rules, PowerSync pasa de una iteración a la siguiente (ej. `11#global` → `12#global`) y reconstruye su estado interno; apareció `powersync_control: internal SQLite call returned CORRUPT_INDEX`. **Lección dura: NUNCA manipular `powersync.db` con Python** (ni `.backup()`, ni consolidar `-wal`/`-shm`). El SQLite de Python es de otra versión que la nativa de PowerSync y **corrompe los índices** que PowerSync espera. Para inspección, abrir SIEMPRE read-only (`mode=ro&immutable=1`); para escribir/recuperar, que lo haga la app. Recuperación: borrar `powersync.db` (+`-wal`/`-shm`) y dejar que la app lo reconstruya desde Supabase (con `ps_crud` ya drenado).

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

Movidos al módulo **Agenda** en junio 2026. Ver sección "Módulo Agenda → Contactos" más abajo.

- Hook: `useContacts()` en `src/renderer/src/hooks/useContacts.ts`
- IPC: `window.api.contacts.list()` / `window.api.agenda.grupos.*` / `window.api.agenda.contactos.*`
- Ruta: `/agenda/contactos`

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

## Auditoría de seguridad — fixes aplicados (junio 2026)

Revisión completa de código en busca de vulnerabilidades. Modelo de amenaza: Summit
es una app Electron multi-dispositivo con usuarios internos de distinto privilegio.
**Lo crítico:** PowerSync replica la base ENTERA a cada dispositivo → cualquier fila
de una tabla sincronizada es legible por todo usuario/dispositivo, y los datos
sincronizados (cargados por usuarios de menor privilegio) son **entrada no confiable**.
Otras fuentes no confiables: HTML de mails entrantes, salidas del LLM, red (MITM).

Base ya correcta (no se tocó): `sandbox: true`, `contextIsolation: true`,
`nodeIntegration: false`.

### 1. Permisos IPC: default-deny + identidad de actor por sesión

**Problema:** el guard de permisos (`permissions.service.ts`, que monkey-patchea
`ipcMain.handle`) sólo cubría algunos módulos; submódulos sensibles
(cajas/mercadopago/servicios/recon) y módulos propios (quotes/knowledge/calendar)
**no tenían guard** → cualquier sesión autenticada podía invocarlos sin chequeo de
permiso. Además varios IPC de escritura confiaban en un `userId` enviado por el
**renderer** como identidad del actor (spoofeable).

**Fix:**
- `permissions.service.ts` reescrito con modelo **default-deny**: `PUBLIC_CHANNELS`
  (auth/app/wallpaper/permissions) pasan; el resto se mapea por `CHANNEL_MODULE_MAP`
  a su módulo/submódulo y se exige nivel `none`/`read`/`write` según la acción
  (heurística `READ_ACTION_RE` + set exacto `READ_EXACT_ACTIONS` para no confundir
  `companies:create` con lectura). `ADMIN_USER_ID` (Diego) bypassa. `levelForSubmodule`
  chequea fila exacta del submódulo y cae a nivel de módulo.
- Identidad de actor server-side: `auth.service.ts` expone `requireActorId()` (deriva
  el `userId` de la sesión real en main). Los IPC de escritura
  (`quotes.ipc`, `recon.ipc`, `mercadopago.ipc`, `knowledge.ipc`) ahora usan
  `await requireActorId()` en lugar del `userId` del renderer. El renderer puede
  seguir mandando el arg (se ignora) — la autoridad es la sesión.

### 2. XSS / renderizado de contenido no confiable

**Problema:** varios `dangerouslySetInnerHTML` con HTML de origen no confiable (cuerpos
de Knowledge, draft Comex, mails entrantes) sin sanitizar; iframes de embed de video y
de mail sin restricción; sin Content-Security-Policy.

**Fix:**
- Helper único `src/renderer/src/lib/sanitize.ts` (`sanitizeHtml`, DOMPurify).
  Aplicado en `KnowledgeEntryCard.tsx`, `ComexImportDetail.tsx` (draft) y
  `EmailDashboard.tsx` (el iframe del mail mantiene `sandbox` SIN `allow-scripts`).
- `KnowledgeRichTextEditor.tsx`: `safeEmbedSrc()` sólo permite iframes `https` de
  `youtube.com/embed/` y `player.vimeo.com/video/`.
- **CSP** en `index.ts` (`onHeadersReceived`, sólo en prod): `script-src 'self'`,
  `object-src 'none'`, `frame-src` limitado a youtube/vimeo, etc. El `index.html` no
  tiene scripts inline, así que `script-src 'self'` no rompe nada.

### 3. Secretos en reposo: cifrado con `safeStorage`

**Problema:** tokens de sesión, apikeys y el access token de Mercado Pago quedaban en
**texto plano** en `userData` (archivos `.json`). El cifrado del token MP derivaba la
clave por scrypt de `WORKSPACE_ID` — una **constante del repo PÚBLICO** + salt en el
mismo disco = ofuscación, no cifrado.

**Fix:**
- `config-store.ts` reescrito: cifrado transparente con `safeStorage` de Electron
  (DPAPI/Keychain/libsecret, protegido por la cuenta de SO). Prefijo `ENC1:`; migración
  perezosa (lee texto plano viejo y re-escribe cifrado); si no hay keyring, cae a texto
  plano (nunca rompe). Cubre de una a todos los consumidores (auth, whatsapp, finance-security, salt MP).
- `mercadopago-crypto.service.ts`: `encryptToken` usa `safeStorage` (prefijo `ss:`);
  se conserva el esquema legacy AES-GCM **sólo** para descifrar/migrar tokens viejos.

### 4. PIN de operadores de caja (`cash_operators`)

**Problema:** el hash+salt del PIN de 4 dígitos vive en la tabla sincronizada
`cash_operators` → está en cada dispositivo → fuerza bruta **offline** de las 10 000
combinaciones es trivial.

**Fix (código, aplicado):** lockout anti-fuerza-bruta **online** en
`verifyOperatorPin` (`cash-operators.ts`): tras 5 fallos consecutivos bloquea el
operador 60 s (mapa en memoria); `PinGate.tsx` muestra el mensaje de bloqueo.

**Residual (servidor, PENDIENTE):** el lockout NO frena la fuerza bruta offline porque
el atacante ya tiene el hash. La mitigación real es **no sincronizar `pin_hash`/`pin_salt`**:
cambiar la sync-rule en Supabase para excluir esas columnas (o verificar el PIN
server-side vía RPC). Mientras tanto, tratar el PIN de operador como un identificador
de bajo nivel de seguridad ("quién operó"), no como barrera fuerte.
Nota: los PIN de Finanzas (`finance-security` / `company-finance-security`) viven en
`ConfigStore` local (NO sincronizado) → no tienen este problema.

### 5. Prompt-injection en el chat con tools de escritura

**Problema:** `chat.service.ts` arma el system prompt embebiendo datos de negocio
sincronizados (títulos, proveedores, **notas**, tracking…) — editables por otros
usuarios/dispositivos — junto a tools de **escritura de libre elección**
(`tool_choice: auto`: crear/actualizar tareas, cambiar estado de importación, delegar,
notas). Un atacante podía escribir "ignorá lo anterior y …" en una nota/título e inducir
acciones.

**Fix:**
- Todo el bloque de datos de negocio se encierra entre `<datos_negocio>…</datos_negocio>`
  y el prompt instruye tratarlo **siempre como datos, nunca como órdenes**; sólo se
  ejecutan tools por pedidos directos de Diego en el chat. Antes de embeber se quitan los
  delimitadores del propio texto (`stripDelimiters`) para evitar breakout.
- `add_import_note` pasó a modo **APPEND** (agrega con fecha, no reemplaza) → una nota
  inducida no puede borrar las notas previas.
- (Relacionado) WhatsApp `questions.service.ts`: se eliminó el fallback `pending[0]`; el
  `ref_code` es **obligatorio siempre** para aplicar una acción (autentica que el
  remitente recibió esa pregunta puntual; el `from` de Evolution es manipulable).

Los otros caminos LLM (`ai.service`, `knowledge-ai`, `proactive`, `planning-ai`) usan
`tool_choice` **forzado a una sola tool** de extracción/recomendación con salida
estructurada — no mutan datos de otros usuarios por inyección. **Residual menor:** la
extracción de mails (`ai.service.ts`) procesa HTML no confiable; una inyección sólo
degrada los campos extraídos (revisados por humano), no escala privilegios.

### Residuales que requieren infraestructura (no código)

- **Firma de código (code-signing):** los instaladores no están firmados → SmartScreen
  y riesgo de tampering del binario auto-actualizado. Requiere certificado + cambios en
  el pipeline de build/`electron-updater`. PENDIENTE (infra).
- **Sacar `pin_hash`/`pin_salt` del sync** (ver punto 4) — sync-rule en Supabase.

### Verificación

`tsc -p tsconfig.node.json` = 20 errores (idéntico al baseline pre-existente) y
`tsc -p tsconfig.web.json` = 141 (idéntico). Ningún error nuevo referencia los archivos/
símbolos tocados. El build real es esbuild transpile-only; estos errores tsc son
pre-existentes y se usan sólo como gate "sin regresiones de tipo".

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

**Aplicado en Supabase (27-jun-2026, vía conexión directa Postgres):** las 6 columnas ya existen en `comex_suppliers` (antes faltaban las 6 → el connector tenía que stripearlas con PGRST204). Como la publication es `FOR ALL TABLES`, se replican solas; ya no hace falta el strip de `category` en el connector. SQL aplicado (idempotente):
```sql
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS demand_annual DOUBLE PRECISION;
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS demand_monthly_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS current_stock DOUBLE PRECISION;
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS safety_stock DOUBLE PRECISION;
ALTER TABLE comex_suppliers ADD COLUMN IF NOT EXISTS purchase_frequency_days INTEGER;
```

### PowerSync: `migrateLegacyTableData` abortaba con "no such table" (resuelto — junio 2026)

**Problema:** `migrateLegacyTableData()` (en `powersync.ts`) recorre una lista de tablas y, para las vacías en `powersync.db`, hace `flowDb.prepare('SELECT * FROM <tabla>')` para bootstrappear datos legacy. Pero algunas tablas **nacieron en la era PowerSync y nunca existieron en `flowtask.db`** (ej. `comex_import_pl_files`, `comex_cotizaciones` y todas las `cash_*`). `prepare()` lanzaba `no such table` → la excepción **abortaba `connectPowerSync()` antes de `db.connect()`**, dejando la app entera sin sincronizar. Solo se disparaba al **recrear** `powersync.db` (recuperación de corrupción, instalación nueva), por eso pasó desapercibido tanto tiempo.

**Fix:** guarda de existencia antes del `SELECT` — `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`; si la tabla legacy no existe, `continue` (no hay datos legacy que migrar para una tabla PowerSync-native).

**Regla:** las tablas PowerSync-only (sin equivalente en `flowtask.db`) ya quedan cubiertas por esta guarda; no hace falta sacarlas de la lista de `migrateLegacyTableData`.

### PowerSync: el connector no stripeaba columnas desconocidas en `PUT` (resuelto — junio 2026)

**Problema:** el `case PATCH` del connector (`ProductionTokenConnector.uploadData`) ya tenía un `while` que, ante `400 PGRST204: Could not find the '<col>' column`, quitaba la columna y reintentaba. El `case PUT` (upsert con `Prefer: resolution=merge-duplicates`) **no tenía ese manejo**: un PUT con una columna que existe en el cliente pero no en Supabase devolvía 400 y se reintentaba para siempre, **trabando toda la cola `ps_crud`**. Lo destapó `comex_suppliers.category` — columna del cliente cuyo DDL en Supabase sigue pendiente (ver "consolidación Marcas → Proveedores/Marcas").

**Fix:** mismo `while` de strip-and-retry del PATCH, ahora también en el PUT. Si el payload queda vacío, se da el op por completado (`200`).

**Regla:** `PATCH` y `PUT` del connector deben tener el MISMO manejo de `PGRST204`/`PGRST205`. Si se toca uno, replicar en el otro.

### IPC: drag-drop de archivos enviaba `number[]` (lento/crasheable para archivos grandes) (resuelto — junio 2026)

**Problema:** El renderer hacía `Array.from(new Uint8Array(buf))` antes de enviar por IPC, creando un array de millones de enteros para PDFs de > ~5MB. La serialización JSON podía bloquear el hilo main o crashear.

**Fix:** El renderer ahora envía el `ArrayBuffer` directamente (structured clone nativo de Electron). Tipos actualizados en `useComex.ts`, `preload/index.ts` y `comex.ipc.ts`.

### Comex → Importaciones: rediseño del alta + vista "Seguimiento Importaciones" (junio 2026)

**Modal "Nueva importación" (`ComexImports.tsx` → `CreateImportModal`):**
- **Proveedor es ahora el primer campo** (antes era Título). Al elegirlo se autogenera el **Título = `Marca #N`**, donde `N` es el correlativo **por marca** (último `#N` + 1). El usuario puede editar el título a mano (badge "auto" se apaga al editar).
- Correlativo: `nextImportNumberForBrand(brand, imports)` (a nivel módulo). Parsea `/#\s*(\d+)/` de los títulos cuya **marca del proveedor** (`supplier.brand || supplier.name`) **o** el texto del título antes del `#` coincide con la marca; toma el `MAX + 1`. **Derivado en el cliente, sin cambio de schema** → compatible con las importaciones ya cargadas (ej. "Edelrid #53 — Verano 2026" → 53). El sufijo de parte `-1/-2` se ignora en el parseo.
- **Partes / splits:** checkbox "Llega en varias partes" + cantidad (2–6). Crea **una importación por parte** con títulos `Marca #N-1`, `-2`, … (ej. "Naturehike #152-1/-2/-3"). `handleSubmit` itera `create.mutateAsync` por cada título. Preview de los títulos a crear en el modal.
- **Campos quitados del alta:** Valor estimado, Fecha de pedido (`order_date`) y ETA estimada (`arrival_date`) → ahora se cargan en el detalle. Se envían `null` en el alta.

**Nuevo menú "Seguimiento Importaciones":**
- Submódulo de permisos `tracking` en `src/shared/modules.ts` (`/comex/seguimiento`). Item en `Sidebar.tsx` (`comexSubItems`, icono `PackageSearch`, label "Seguimiento Imp.", `subKey: 'tracking'`). Ruta en `main.tsx` → `ComexTracking.tsx`.
- La vista **agrupa importaciones por marca** (`supplier.brand || supplier.name || 'Sin marca'`) con 4 columnas: **Importación** (link al detalle) · **N° despacho** · **Monto despacho** · **Fecha oficialización**. Subtotal de despachos por moneda en el header de cada marca. Buscador (marca/título/despacho) + filtro "Solo despachadas".

**Backend (`queries/comex.ts`):** `IMPORT_SELECT` ahora incluye `c.fob_declared AS _despacho_amount` y `c.fob_currency AS _despacho_currency` (del JOIN con `comex_import_customs`); `hydrateImport` los hidrata. **"Monto despacho" = `fob_declared` (valor declarado en aduana)**. Tipo: `_despacho_amount?` / `_despacho_currency?` en `ComexImport` (`shared/types.ts`).

**Sin DDL ni cambios de sync-rule** — lee columnas ya existentes/sincronizadas (`fob_declared`, `fob_currency`). **Requiere reiniciar `npm run dev`** porque cambió `comex.ts` (main-process); el modal/menú/ruta entran por HMR.

**tsc:** web 141 / node 20 (= baselines, sin errores nuevos). El `TS2345` en `ComexImports.tsx` es el error **preexistente** del `handleSubmit` reubicado: `CreateComexImportInput = Omit<ComexImport, …>` exige ~80 campos que el alta nunca envió (`createImport` los rellena con defaults).

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

## Módulo Contable → Cajas Internas (junio 2026)

### Propósito

Gestión de las cajas de efectivo internas de la empresa: caja chica, cajas por área/sucursal, en múltiples monedas (ARS/USD/EUR). Registra ingresos, egresos y transferencias entre cajas, conteos/arqueos, diferencias, permisos por usuario y caja, y cierre diario. Exporta reportes a Excel. Ruta `/contable/cajas`. Ícono del sidebar: `Banknote` (lucide-react, color `#34d399`).

### Tablas (PowerSync ↔ Supabase — 13 tablas)

Todas `cash_*`, se leen/escriben vía `getPowerSyncDb()` con filtro `workspace_id`. **Nacen en la era PowerSync — NO tienen migración en `flowtask.db`** (están en el `AppSchema` de `powersync.ts`).

| Tabla | Contenido |
|-------|-----------|
| `cash_companies` | Empresas/entidades dueñas de las cajas. `sort_order` controla el orden de las empresas en el dashboard (Naka=0, EV=1) |
| `cashboxes` | Cada caja: `name` + `description` (ambos editables desde la UI con el lápiz), `currencies` (monedas habilitadas, JSON), estado (`ok` / `with_difference` / `closed`), `sort_order` (orden visual dentro de su empresa) |
| `cashbox_permissions` | Permiso por usuario y caja. Claves: `view` / `income` / `expense` / `transfer` / `count`. **ID determinístico** `${cashbox_id}.${user_id}.${perm}` (sin UNIQUE secundario; `INSERT OR IGNORE`) |
| `cash_categories` | Categorías de movimiento (ingreso / egreso) |
| `cash_movements` | Cabecera del movimiento: `type` (`income` / `expense` / `transfer`), `status` (`confirmed` / …), fecha, caja, categoría, descripción |
| `cash_movement_amounts` | Montos por moneda de cada movimiento (un movimiento puede tener varias monedas). **El saldo se calcula sumando acá** |
| `cash_movement_breakdowns` | **Desglose de billetes por movimiento** (doble chequeo). Espejo de `cash_count_details` pero por `movement_id`. Opcional: solo se llena si el operador usa el contador de billetes al cargar el importe en "Nuevo movimiento". En transferencias se guarda en ambos movimientos. **DDL pendiente** (`supabase_cash_movement_breakdowns.sql`) |
| `cash_operators` | **Operadores de caja** (lista propia, independiente del login): `name` + `pin_hash`/`pin_salt` (scrypt+salt, PIN numérico de 4 dígitos). Identifica al operador y autoriza acciones sensibles; **no es login**. El renderer nunca ve el hash (sólo `has_pin`); la verificación (`verifyOperatorPin`) corre en main. CRUD en `queries/cash-operators.ts`, IPC `cajas:operators:*`, UI `OperadoresModal` (botón "Operadores" en el header del dashboard). **DDL pendiente** (`supabase_cash_operators.sql`) |
| `cash_counts` | Conteos / arqueos de caja (cabecera) |
| `cash_count_details` | Detalle de denominaciones por conteo |
| `cash_differences` | Diferencias detectadas en arqueos: `status` (`pending` / `resolved` / `written_off`) |
| `cash_audit_logs` | Log de auditoría de acciones sobre cajas |
| `cash_attachments` | **Comprobantes (Etapa 2).** Metadata del adjunto: `owner_type` (`movement` / `count`), `owner_id`, `original_name`, `mime_type`, `size_bytes`, `drive_file_id`. **Los bytes viven en Google Drive** (carpeta "Summit Cajas"); acá solo la referencia. **DDL aplicado jun 2026** |

### Cálculo de saldo (no materializado)

El saldo de una caja por moneda **se recalcula siempre** — no hay columna `balance`. Ver `getCashboxBalances()` en `cajas.ts`:

```sql
SELECT m.cashbox_id, a.currency, COALESCE(SUM(a.amount), 0) AS balance
FROM cash_movements m
JOIN cash_movement_amounts a ON a.movement_id = m.id
-- filtrado por movimientos confirmados + workspace_id, agrupado por caja/moneda
```

### Transferencias = 2 movimientos

Una transferencia entre cajas crea **dos `cash_movements` con `type='transfer'`**: salida en la caja origen y entrada en la caja destino, cada uno con su `cash_movement_amounts`. Ver `createTransfer()` en `cajas.ts`. No existe un "movimiento de transferencia" único — así el saldo de cada caja sale del mismo `SUM` que el resto.

### Conteos, diferencias y cierre

- **ConteoRapidoModal:** grilla de denominaciones por moneda (ARS/USD/EUR); calcula en vivo la diferencia entre el conteo físico y el saldo teórico. Guarda `cash_counts` + `cash_count_details` y, si hay diferencia, crea `cash_differences` y pone la caja en `with_difference`.
- **DiferenciasModal:** lista, resuelve o condona (`write_off`) diferencias. Al resolver la última diferencia pendiente, la caja vuelve a `ok`.
- **CierreDiarioModal:** resumen del día + conteo de cierre; deja la caja en `closed` (o `with_difference` si no cuadra).
- **PermisosModal:** asigna/revoca permisos por usuario y caja (ID determinístico).

### Orden, renombrado y monedas de las cajas

- **Orden:** persiste en la columna `sort_order` (en `cashboxes` y `cash_companies`), no depende del nombre. `getCashboxes`/`getCashCompanies` ordenan por `sort_order ASC, name ASC`. El dashboard muestra Naka arriba de EV, y dentro de cada empresa el flujo cobros/ventas → caja 1 → caja 2.
- **Reordenar (UI):** flechas ◀ ▶ en cada `CashboxCard` (`moveCashbox(id, 'up'|'down')`). Mueve la caja una posición dentro de su empresa renormalizando el `sort_order` de todos los hermanos a 1..N (robusto ante empates en 0).
- **Renombrar / editar descripción (UI):** lápiz en cada card → abre DOS inputs inline (nombre + descripción "qué es la caja"); Enter guarda, Esc cancela; botón Guardar → `updateCashboxInfo(id, name, description)` (un solo `UPDATE` de `name` + `description`). El nombre no puede quedar vacío. Por eso la card es un `<div>` (no `<button>`): lápiz, flechas e inputs son controles con `stopPropagation`; el click en el cuerpo sigue seleccionando la caja.
- **Monedas por empresa:** Naka maneja ARS/USD/EUR, Estación Vertical ARS/USD. La card y el modal de movimiento leen `box.currencies`, así que la congruencia se mantiene a nivel data (columna `currencies`). Seed/fix en `supabase_cajas_orden_monedas.sql`.
- **Montos sin centavos:** `fmtAmount` formatea TODAS las monedas (ARS/USD/EUR) como enteros (`maximumFractionDigits: 0`). Es la fuente única usada por dashboard, cards, KPIs, charts y modales.

> **DDL:** la columna `sort_order` y el fix de monedas se aplican con `supabase_cajas_orden_monedas.sql` (ALTER + seed por id estable). No requiere tocar sync-rules (publicación FOR ALL TABLES + `SELECT *` + `powersync_repl` ya tiene SELECT). Aplicar el SQL **antes** de reiniciar la app (el `AppSchema` del cliente ya declara `sort_order`).

> **⚠️ RLS de escritura (bug histórico):** las 10 tablas `cash_*` originales (`supabase_cajas_tables.sql`) se crearon con el patrón VIEJO — RLS on + sólo policy de `SELECT` para `authenticated` y GRANT de escritura a `service_role`. Como el cliente sube con el JWT del usuario (rol `authenticated`, no service_role), **todo write de cajas desde la app era rechazado por RLS (42501)**: el connector saltea la fila, completa la transacción, y el siguiente checkpoint pisa el cambio local con el valor viejo → "no se guarda" (se detectó al renombrar). Fix en `supabase_cajas_rls_fix.sql`: policy `authenticated_workspace_all` (FOR ALL) + GRANT write a `authenticated` en las 10 tablas (igual que `cash_attachments`). **Lección:** toda tabla sincronizada necesita policy de escritura + GRANT para `authenticated`, no `service_role`.

### Export a Excel

`ReporteModal` exporta por rango de fechas vía IPC `cajas:report:export` (main process, librería `xlsx`, `dialog.showSaveDialog`). Tres hojas: **Movimientos / Diferencias / Conteos**. Sanitiza contra inyección de fórmulas (prefija celdas que arrancan con `/^[=+\-@]/`).

### Comprobantes / adjuntos (Etapa 2 — Google Drive + `cash_attachments`)

Permite adjuntar fotos/PDF a cada movimiento. **Arquitectura híbrida:** los **bytes** van a Google Drive (se reutiliza `driveService`, carpeta "Summit Cajas" vía `getOrCreateCajasFolder()`); la **metadata** (nombre, mime, tamaño, `drive_file_id`) va a la tabla PowerSync `cash_attachments` → la referencia sincroniza entre dispositivos y Supabase es la fuente de verdad. Drive es solo el blob store.

- **UI:** botón **"Movimientos"** en el panel de la caja (`CajasDashboard` → `MovimientosModal`). El modal lista los movimientos (query enriquecida `getCashMovementsWithMeta`: categoría + montos vía `json_group_array` + `attachment_count`); cada fila se expande y monta `<CashAttachments>` (carga lazy los adjuntos de ese movimiento, evita N queries al abrir).
- **`CashAttachments`** (componente reutilizable, recibe `ownerType` + `ownerId`): lista chips, abre en Drive (`shell.openExternal`), sube (file picker en main, multi-select) y borra. Pensado para reusar también en conteos (`owner_type='count'`).
- **Subida:** `cajas:attachments:add` abre el `dialog.showOpenDialog` en main, sube cada archivo a Drive y hace `INSERT` de la metadata. Si el `INSERT` falla, borra el archivo de Drive (no deja huérfanos). Requiere estar autenticado con Drive (si no, error claro).
- **Borrado:** `deleteCashAttachment` borra primero el archivo de Drive (best-effort) y después la fila.
- **id determinístico:** cada comprobante es una fila nueva con `randomUUID()` (sin UNIQUE secundario → sin riesgo de 23505).

> **Sincronización:** la tabla `cash_attachments` ya está en Supabase (`supabase_cash_attachments.sql` aplicado + sync-rule desplegada, jun 2026). Recordatorio del comportamiento del connector: ante tabla inexistente **omite la op (PGRST205) sin trabar la cola**, por eso aplicar el DDL tarde fue seguro.

### Alertas de descuadre (Etapa 2 — banner global)

Banner que avisa de TODAS las diferencias sin resolver del workspace, no solo de la caja seleccionada. Aparece arriba de los KPIs del dashboard y **solo si hay descuadres** (si no, no renderiza nada).

- **Query:** `listAllPendingDifferences()` en `cajas.ts` — todas las `cash_differences` con `status IN ('pending','under_review')`, con JOIN a `cashboxes` + `cash_companies` para mostrar caja y empresa. IPC `cajas:differences:pending`.
- **Hook:** `usePendingDifferences()` con queryKey `['cajas','differences','pending']` — cae bajo el prefijo `['cajas','differences']` que invalida `useUpdateCashDifference`, así que al resolver una diferencia el banner se refresca solo.
- **UI:** `AlertasDescuadre.tsx` lista cada descuadre (caja · empresa, antigüedad, monto firmado); las diferencias de > 1 semana se marcan en ámbar. Click en una fila → `setSelectedId(cashbox_id)` + abre el `DiferenciasModal` de esa caja para resolverla.
- **Alcance:** in-app únicamente. No hay notificaciones del SO (no existe infra nativa de notificaciones en main); quedó como posible mejora futura.

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/main/database/queries/cajas.ts` | CRUD: companies, cashboxes, permisos, categorías, movimientos, transferencias, conteos, diferencias, summary diario, datos de reporte, `getCashMovementsWithMeta` (historial enriquecido) |
| `src/main/database/queries/cash-attachments.ts` | Comprobantes: `list/add/delete`. Sube/borra en Drive vía `driveService` + metadata en `cash_attachments` |
| `src/main/ipc/cajas.ipc.ts` | Handlers `cajas:*` (incluye `cajas:report:export` con XLSX y `cajas:attachments:*`) |
| `src/renderer/src/hooks/useCajas.ts` | Hooks React Query del módulo |
| `src/renderer/src/routes/contable/CajasDashboard.tsx` | Panel principal: cajas, saldos por moneda, acciones |
| `src/renderer/src/routes/contable/NuevoMovimientoModal.tsx` | Alta de ingreso / egreso / transferencia |
| `src/renderer/src/routes/contable/ConteoRapidoModal.tsx` | Conteo / arqueo con grilla de denominaciones |
| `src/renderer/src/routes/contable/DiferenciasModal.tsx` | Gestión de diferencias (resolver / condonar) |
| `src/renderer/src/routes/contable/PermisosModal.tsx` | Permisos por usuario y caja |
| `src/renderer/src/routes/contable/CierreDiarioModal.tsx` | Cierre diario |
| `src/renderer/src/routes/contable/ReporteModal.tsx` | Export a Excel (rango de fechas, 3 hojas) |
| `src/renderer/src/routes/contable/MovimientosModal.tsx` | Historial de movimientos; cada fila se expande para ver/adjuntar comprobantes |
| `src/renderer/src/routes/contable/CashAttachments.tsx` | Strip de comprobantes reutilizable (lista/abre/sube/borra; Drive) |
| `src/renderer/src/routes/contable/AlertasDescuadre.tsx` | Banner global de diferencias sin resolver (workspace-wide); click → `DiferenciasModal` de la caja |

### IPC (`cajas:*`)

`companies`, `cashboxes`, `cashbox`, `balances`, `lastCounts`, `categories`, `cashbox:{setStatus,update,move}`; `movements:{list,listDetailed,create,transfer}`; `counts:{list,create}`; `differences:{list,pending,create,update}`; `permissions:{list,grant,revoke}`; `daily:summary`; `report:export`; `attachments:{list,add,delete,open}`.

### Setup en Supabase (aplicado jun 2026)

Las 10 tablas siguen el template estándar (RLS + policy `authenticated` por `workspace_id` + GRANT — ver "Reglas al crear una tabla sincronizada nueva"). Dos pasos extra fueron necesarios y son fáciles de olvidar (ver "Fix: tablas PowerSync nuevas no sincronizaban"):

1. **Grants al rol de replicación:** las tablas se crearon después de configurar PowerSync, así que el `GRANT ON ALL TABLES` original no las cubría → hubo que copiar los grants desde `comex_suppliers`.
2. **Sync-rules:** una línea por tabla en el dashboard de PowerSync:
   ```yaml
   - SELECT * FROM cash_companies        WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cashboxes             WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cashbox_permissions   WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_categories       WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_movements        WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_movement_amounts WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_movement_breakdowns WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_operators        WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_counts           WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_count_details    WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_differences      WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   - SELECT * FROM cash_audit_logs       WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
   ```

**`cash_attachments` (Etapa 2 comprobantes) — APLICADO jun 2026:** la 11.ª tabla ya está en Supabase. Se corrió `supabase_cash_attachments.sql` (CREATE TABLE + RLS policy `authenticated_workspace_all` + GRANT a `authenticated` + grant explícito a `powersync_repl` + index, patrón `authenticated`/`FOR ALL`) y se desplegó la sync-rule:
```yaml
- SELECT * FROM cash_attachments      WHERE workspace_id = 'd61a4071-1557-4f32-be5e-6443fb336bf5'
```

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

### Stats del grafo (regenerado 29/06/2026)

| Métrica | Valor |
|---------|-------|
| Nodos | 3 700 |
| Aristas | 7 924 |
| Comunidades | 144 (todas nombradas) |

Las 144 comunidades tienen nombres semánticos (no placeholders "Community N"). Los nombres viven en `graphify-out/.graphify_labels.json` (mapa `cid → nombre`). `graphify cluster-only <proyecto> --no-label` regenera `graph.json`/`graph.html`/`GRAPH_REPORT.md` leyendo ese archivo **sin** llamar a ningún LLM; sólo `graphify label` invoca al modelo (requiere API key y consume cuota).

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
