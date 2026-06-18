# Summit — Contexto del proyecto para Claude Code

> **Para Claude:** Al finalizar una sesión con cambios arquitecturales o fixes significativos, proponer al usuario actualizar este archivo con lo que cambió. Este archivo es el único contexto que persiste entre sesiones.

## Qué es Summit

Summit es el sistema operativo central de **Naka Outdoors** y de su CEO, **Diego Nakamura**. Centraliza en una sola aplicación de escritorio todo lo necesario para gestionar la empresa y la productividad personal:

### Módulos actuales

- **Comex (Comercio Exterior):** gestión completa de importaciones de Naka Outdoors. Seguimiento de embarques, documentos para despachante y personal, presupuestos logísticos de operadores de flete, pagos, costos, arancel, proformas, y planificación de pedidos con IA.
- **Tareas / Kanban:** sistema de gestión de tareas con tablero kanban, dependencias, recordatorios y delegación.
- **Agenda / Calendario:** integración con Google Calendar. Sistema para programar envíos de mensajes por WhatsApp con recordatorios automáticos.
- **Contactos:** agenda de contactos de la empresa.
- **Presupuestos / CRM:** generación de presupuestos y seguimiento comercial tipo CRM.
- **Finanzas personales:** módulo para llevar todas las cuentas mensuales personales de Diego (movimientos, conceptos recurrentes, cargas múltiples).
- **Finanzas empresa:** módulo equivalente para las cuentas mensuales de Naka Outdoors.
- **Email:** recepción y envío de correos electrónicos desde la app.
- **Backup:** backup automático de código (GitHub) y datos (Google Drive) en la nube.
- **Configuración:** módulo robusto de ajustes para todos los menús y preferencias del sistema.

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
**Versión actual:** 1.0.3

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
- `user_permissions`
- `finance_accounts`, `finance_categories`, `finance_payment_methods`
- `finance_concepts`, `finance_movements`, `finance_month_insights`, `finance_movement_entries`
- `calendar_event_links`
- `quote_companies`, `quote_contacts`, `quotes`, `quote_activities`
- `company_finance_accounts`, `company_finance_categories`, `company_finance_payment_methods`
- `company_finance_concepts`, `company_finance_movements`, `company_finance_month_insights`
- `company_finance_movement_entries`
- Todas las tablas `comex_*` e `import_order_*` (incluidas `comex_logistics_quotes`, `comex_quote_files`)

**Si un dato de negocio desaparece al reiniciar:** el problema está en las sync-rules (workspace_id incorrecto, tabla faltante) o en el schema de Supabase (columna faltante). No mover a `flowtask.db`.

### ❌ Solo local (NO sincroniza — por diseño)

Estas tablas viven únicamente en `flowtask.db` porque representan estado local del dispositivo que no tiene sentido sincronizar:

- `attachments` — archivos adjuntos de tareas (binarios locales)
- `email_*` — módulo de correo (usa `email-db.ts`, caché local de IMAP)
- Tablas de caché y configuración de UI local

### Función `restoreComexLocalCache` / `restoreCompanyFinanceLocalCache`

Estas funciones copian `flowtask.db → psDb` en el primer arranque (cuando `psDb count = 0`) para hacer el bootstrap inicial de datos históricos. **No son la fuente de verdad** — son un mecanismo de seeding único para que PowerSync pueda subir los datos existentes a Supabase en la primera sincronización.

---

## Patrón de migraciones (flowtask.db)

Las migraciones de `flowtask.db` están en `src/main/database/migrations.ts`.

```typescript
// Cada migración es un objeto { version: number, up: (db) => void }
// Se aplican en orden ascendente; la versión actual se guarda en PRAGMA user_version
// Versión actual de la DB: 73
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
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

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
| `src/main/database/migrations.ts` | Migraciones de `flowtask.db` (versión actual: 73) |
| `src/main/database/queries/finance.ts` | CRUD finanzas personales |
| `src/main/database/queries/company-finance.ts` | CRUD finanzas empresa |
| `src/main/index.ts` | Punto de entrada main, registra handlers IPC |
| `src/preload/index.ts` | Expone API al renderer via contextBridge |
| `src/renderer/src/routes/finance/FinanceDashboard.tsx` | UI finanzas personales (~4500 líneas) |
| `src/renderer/src/routes/company-finance/CompanyFinanceDashboard.tsx` | UI finanzas empresa (~similar tamaño) |

---

## Repo y distribución

- **GitHub:** `github.com/senseinaka/flowtask` (público)
- **Auto-update:** `electron-updater` lee los releases de GitHub. El comando `npm run release` hace build + publica.
- **AppId:** `com.flowtask.app`
- **ProductName:** `Summit`

---

## Bugs conocidos y sus fixes (historial relevante)

### Fix: cargas no guardaban valores (resuelto — junio 2025)

**Problema:** al agregar una carga en un movimiento multi-entrada, el valor se perdía.

**Causa raíz doble:**
1. `finance_movement_entries` tenía FK `REFERENCES finance_movements(id)`, pero `finance_movements` vive en PowerSync, no en `flowtask.db` → `SQLITE_CONSTRAINT_FOREIGNKEY` al insertar.
2. Flujo de dos pasos (crear con $0, editar inline): `invalidateFinanceMovements` re-renderizaba la tabla y descartaba el input en curso.

**Fix:**
- Migración 72: recreó las tablas de entradas sin la FK.
- `MovementEntriesQuickList`: refactorizado a flujo de un solo paso (el usuario tipea el monto, confirma con Enter, la entrada se crea con el valor real directamente).

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

**Supabase: SQL a ejecutar manualmente en el dashboard** (sin esto los campos nuevos no sincronizan):
```sql
ALTER TABLE comex_logistics_quotes ADD COLUMN IF NOT EXISTS quote_html TEXT NOT NULL DEFAULT '';
ALTER TABLE comex_logistics_quotes ADD COLUMN IF NOT EXISTS quote_received_at BIGINT;

CREATE TABLE IF NOT EXISTS comex_quote_files (
  id              TEXT PRIMARY KEY,
  quote_id        TEXT NOT NULL,
  import_id       TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       BIGINT,
  drive_file_id   TEXT NOT NULL DEFAULT '',
  drive_folder_id TEXT,
  mime_type       TEXT NOT NULL DEFAULT '',
  workspace_id    TEXT,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quote_files_quote  ON comex_quote_files(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_files_import ON comex_quote_files(import_id);
```

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

### IPC: drag-drop de archivos enviaba `number[]` (lento/crasheable para archivos grandes)

**Problema:** El renderer hacía `Array.from(new Uint8Array(buf))` antes de enviar por IPC, creando un array de millones de enteros para PDFs de > ~5MB. La serialización JSON podía bloquear el hilo main o crashear.

**Fix:** El renderer ahora envía el `ArrayBuffer` directamente (structured clone nativo de Electron). Tipos actualizados en `useComex.ts`, `preload/index.ts` y `comex.ipc.ts`.
