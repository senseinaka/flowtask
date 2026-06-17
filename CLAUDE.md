# Summit — Contexto del proyecto para Claude Code

**Nombre del producto:** Summit (el paquete npm se llama `flowtask`, el repo en GitHub es `senseinaka/flowtask`)
**Stack:** Electron + React + TypeScript + Vite + React Query + PowerSync + better-sqlite3 + Supabase
**Versión actual:** 1.0.3

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

## Qué tablas sincronizan y cuáles no

### ✅ Sincronización completa (PowerSync ↔ Supabase ↔ todos los dispositivos)

Estas tablas tienen sync-rules en el servidor PowerSync. Se leen y escriben exclusivamente via `getPowerSyncDb()`:

- `projects`, `tasks`, `task_dependencies`
- `user_permissions`
- `finance_accounts`, `finance_categories`, `finance_payment_methods`
- `finance_concepts`, `finance_movements`, `finance_month_insights`
- `calendar_event_links`
- `quote_companies`, `quote_contacts`, `quotes`, `quote_activities`

### ⚠️ Sincronización parcial (suben a Supabase pero NO bajan a otros dispositivos)

El servidor PowerSync no tiene sync-rules para estas tablas. Los datos se suben vía `ps_crud` → Supabase cuando hay conexión, pero el servidor no los envía de vuelta a ningún cliente. Al iniciar la app, se restauran desde `flowtask.db` directamente a `ps_data__<tabla>` (bypass del sync):

- `company_finance_accounts`, `company_finance_categories`, `company_finance_payment_methods`
- `company_finance_concepts`, `company_finance_movements`, `company_finance_month_insights`
- `company_finance_movement_entries` ← **solo local, no sincroniza**
- Todas las tablas `comex_*` e `import_order_*`

**Función responsable:** `restoreCompanyFinanceLocalCache()` y `restoreComexLocalCache()` en `powersync.ts`.

### ❌ Solo local (NO sincroniza en absoluto)

Estas tablas viven únicamente en `flowtask.db` y no tienen representación en PowerSync:

- **`finance_movement_entries`** — Las "cargas" de conceptos con múltiples pagos en el mes.
  - **Por qué:** el servidor PowerSync borra `ps_data__finance_movement_entries` en cada ciclo de sync (la tabla no tiene sync-rules adecuadas, o las tiene pero devuelve 0 filas). Mover las entradas a `flowtask.db` fue el fix para que no se pierdan en cada arranque.
  - **Consecuencia:** en otra computadora, los movimientos muestran el `amount_actual` correcto (ese sí sincroniza) pero no las cargas individuales.
  - **Fix pendiente:** agregar `finance_movement_entries` a los sync-rules del servidor PowerSync con el filtro `workspace_id` correcto, y escribirlas también via `getPowerSyncDb()` además de `flowtask.db`.
- `attachments` (archivos adjuntos de tareas)
- `email_*` (módulo de correo, usa `email-db.ts`)
- Tablas de caché y configuración local

---

## Patrón de migraciones (flowtask.db)

Las migraciones de `flowtask.db` están en `src/main/database/migrations.ts`.

```typescript
// Cada migración es un objeto { version: number, up: (db) => void }
// Se aplican en orden ascendente; la versión actual se guarda en PRAGMA user_version
// Versión actual de la DB: 72
```

**Reglas:**
- Siempre incrementar `version` en 1.
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
- **Entrada/Carga** (`finance_movement_entries` en `flowtask.db`): cada pago individual dentro de un movimiento multi-carga.

### Función `recalcMovementFromEntries`

En ambos archivos de queries. Lee `SUM(amount)` de las cargas en `flowtask.db`, y actualiza `amount_actual`, `status`, y `payment_date` en el movimiento via `getPowerSyncDb()` (así el total sincroniza aunque las cargas individuales no).

### `entries_count` en movimientos

El campo `entries_count` que se muestra en el badge de la tabla NO viene del subquery de PowerSync (que siempre devuelve 0 porque la tabla PowerSync está vacía). Se calcula con `attachEntriesCounts()` que consulta `flowtask.db` después de traer los movimientos. Ver función en `finance.ts` y `company-finance.ts`.

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

El JWT para autenticarse en PowerSync se firma localmente con la clave privada RSA en cada conexión (no hay token hardcodeado que expire).

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
| `src/main/database/migrations.ts` | Migraciones de `flowtask.db` (versión actual: 72) |
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

### Patrón: nodos compuestos en el timeline de importación (ProveedorNode / ForwarderNode)

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
