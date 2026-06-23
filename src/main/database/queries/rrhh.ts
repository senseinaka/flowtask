import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  RrhhColaborador, RrhhPeriodo, RrhhSueldo,
  RrhhSueldoConColaborador, RrhhPeriodoConStats, RrhhHistorialEntry
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ── Colaboradores ─────────────────────────────────────────────────────────────

export async function listColaboradores(): Promise<RrhhColaborador[]> {
  const db = getPowerSyncDb()
  return db.getAll<RrhhColaborador>(
    `SELECT * FROM rrhh_colaboradores WHERE workspace_id = ? ORDER BY nombre ASC`,
    [WORKSPACE_ID]
  )
}

export async function getColaboradorByDocumento(documento: string): Promise<RrhhColaborador | null> {
  const db = getPowerSyncDb()
  return db.getOptional<RrhhColaborador>(
    `SELECT * FROM rrhh_colaboradores WHERE workspace_id = ? AND documento = ?`,
    [WORKSPACE_ID, documento]
  )
}

export async function upsertColaborador(data: {
  documento: string
  cuil: string
  nombre: string
  tarea_habitual: string
  legajo?: string
  fecha_ingreso?: string
}): Promise<RrhhColaborador> {
  const db = getPowerSyncDb()
  const existing = await getColaboradorByDocumento(data.documento)
  const now = Date.now()

  if (existing) {
    // Only update fecha_ingreso if it's not set yet (don't overwrite with empty)
    const fechaIngreso = data.fecha_ingreso || existing.fecha_ingreso
    const legajo = data.legajo || existing.legajo
    await db.execute(
      `UPDATE rrhh_colaboradores SET cuil = ?, nombre = ?, tarea_habitual = ?, legajo = ?, fecha_ingreso = ?, updated_at = ? WHERE id = ?`,
      [data.cuil, data.nombre, data.tarea_habitual, legajo, fechaIngreso, now, existing.id]
    )
    return { ...existing, ...data, legajo: legajo ?? null, fecha_ingreso: fechaIngreso ?? null, updated_at: now }
  }

  const id = randomUUID()
  await db.execute(
    `INSERT INTO rrhh_colaboradores (id, workspace_id, documento, cuil, nombre, tarea_habitual, legajo, fecha_ingreso, activo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, WORKSPACE_ID, data.documento, data.cuil, data.nombre, data.tarea_habitual,
     data.legajo ?? null, data.fecha_ingreso ?? null, now, now]
  )
  return db.getOptional<RrhhColaborador>(`SELECT * FROM rrhh_colaboradores WHERE id = ?`, [id]) as Promise<RrhhColaborador>
}

// ── Períodos ──────────────────────────────────────────────────────────────────

export async function listPeriodos(): Promise<RrhhPeriodoConStats[]> {
  const db = getPowerSyncDb()
  const periodos = await db.getAll<RrhhPeriodo>(
    `SELECT * FROM rrhh_periodos WHERE workspace_id = ? ORDER BY anio DESC, mes DESC`,
    [WORKSPACE_ID]
  )

  return periodos.map((p, idx) => {
    const prev = periodos[idx + 1] ?? null
    const curGrand  = p.total_neto + (p.total_vacaciones ?? 0)
    const prevGrand = prev ? prev.total_neto + (prev.total_vacaciones ?? 0) : 0
    const delta_total = prev ? curGrand - prevGrand : null
    const delta_pct = prev && prevGrand > 0
      ? Math.round(((curGrand - prevGrand) / prevGrand) * 1000) / 10
      : null
    return { ...p, delta_total, delta_pct }
  })
}

export async function getPeriodo(id: string): Promise<RrhhPeriodo | null> {
  return getPowerSyncDb().getOptional<RrhhPeriodo>(
    `SELECT * FROM rrhh_periodos WHERE id = ?`, [id]
  )
}

export async function getPeriodoByMes(anio: number, mes: number): Promise<RrhhPeriodo | null> {
  return getPowerSyncDb().getOptional<RrhhPeriodo>(
    `SELECT * FROM rrhh_periodos WHERE workspace_id = ? AND anio = ? AND mes = ?`,
    [WORKSPACE_ID, anio, mes]
  )
}

export async function createPeriodo(data: {
  anio: number; mes: number; label: string
  total_neto: number; cantidad_colaboradores: number
  pdf_nombre: string; fecha_pago: string
}): Promise<RrhhPeriodo> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(
    `INSERT INTO rrhh_periodos
       (id, workspace_id, anio, mes, label, total_neto, cantidad_colaboradores,
        pdf_nombre, pdf_drive_file_id, pdf_drive_folder_id, fecha_pago, estado, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'borrador', ?, ?)`,
    [id, WORKSPACE_ID, data.anio, data.mes, data.label, data.total_neto,
     data.cantidad_colaboradores, data.pdf_nombre, data.fecha_pago, now, now]
  )
  return (await getPowerSyncDb().getOptional<RrhhPeriodo>(`SELECT * FROM rrhh_periodos WHERE id = ?`, [id]))!
}

export async function updatePeriodoDrive(id: string, driveFileId: string, driveFolderId: string): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_periodos SET pdf_drive_file_id = ?, pdf_drive_folder_id = ?, updated_at = ? WHERE id = ?`,
    [driveFileId, driveFolderId, Date.now(), id]
  )
}

export async function updatePeriodoVacaciones(id: string, data: {
  total_vacaciones: number
  pdf_vacaciones_nombre: string
  pdf_vacaciones_drive_file_id?: string | null
}): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_periodos SET total_vacaciones = ?, pdf_vacaciones_nombre = ?, pdf_vacaciones_drive_file_id = ?, updated_at = ? WHERE id = ?`,
    [data.total_vacaciones, data.pdf_vacaciones_nombre, data.pdf_vacaciones_drive_file_id ?? null, Date.now(), id]
  )
}

export async function updatePeriodoStats(id: string, data: {
  total_neto: number
  cantidad_colaboradores: number
  pdf_nombre: string
  fecha_pago: string
}): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_periodos SET total_neto = ?, cantidad_colaboradores = ?, pdf_nombre = ?, fecha_pago = ?, updated_at = ? WHERE id = ?`,
    [data.total_neto, data.cantidad_colaboradores, data.pdf_nombre, data.fecha_pago, Date.now(), id]
  )
}

export async function clearSueldosByPeriodo(periodoId: string): Promise<void> {
  await getPowerSyncDb().execute(
    `DELETE FROM rrhh_sueldos WHERE periodo_id = ?`, [periodoId]
  )
}

export async function updateSueldoNotas(id: string, notas: string | null): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_sueldos SET notas = ?, updated_at = ? WHERE id = ?`,
    [notas, Date.now(), id]
  )
}

export async function updateSueldoVacaciones(data: {
  periodoId: string
  colaboradorId: string
  vacaciones_neto: number
  vacaciones_dias: number
}): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_sueldos SET vacaciones_neto = ?, vacaciones_dias = ?, updated_at = ? WHERE periodo_id = ? AND colaborador_id = ?`,
    [data.vacaciones_neto, data.vacaciones_dias, Date.now(), data.periodoId, data.colaboradorId]
  )
}

export async function getSueldoByPeriodoColaborador(periodoId: string, colaboradorId: string): Promise<RrhhSueldo | null> {
  return getPowerSyncDb().getOptional<RrhhSueldo>(
    `SELECT * FROM rrhh_sueldos WHERE periodo_id = ? AND colaborador_id = ?`,
    [periodoId, colaboradorId]
  )
}

export async function confirmarPeriodo(id: string): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_periodos SET estado = 'confirmado', updated_at = ? WHERE id = ?`,
    [Date.now(), id]
  )
}

export async function deletePeriodo(id: string): Promise<void> {
  const db = getPowerSyncDb()
  await db.execute(`DELETE FROM rrhh_sueldos WHERE periodo_id = ?`, [id])
  await db.execute(`DELETE FROM rrhh_periodos WHERE id = ?`, [id])
}

// ── Sueldos ───────────────────────────────────────────────────────────────────

export async function listSueldosByPeriodo(periodoId: string): Promise<RrhhSueldoConColaborador[]> {
  const db = getPowerSyncDb()
  const sueldos = await db.getAll<RrhhSueldo>(
    `SELECT * FROM rrhh_sueldos WHERE periodo_id = ? ORDER BY created_at ASC`,
    [periodoId]
  )

  // Fetch colaboradores for this period
  const periodo = await getPeriodo(periodoId)
  let prevSueldos: RrhhSueldo[] = []
  if (periodo) {
    const prev = await getPeriodoByMes(
      periodo.mes === 1 ? periodo.anio - 1 : periodo.anio,
      periodo.mes === 1 ? 12 : periodo.mes - 1
    )
    if (prev) {
      prevSueldos = await db.getAll<RrhhSueldo>(
        `SELECT * FROM rrhh_sueldos WHERE periodo_id = ?`, [prev.id]
      )
    }
  }

  const colaboradorIds = [...new Set(sueldos.map(s => s.colaborador_id))]
  const colaboradores = colaboradorIds.length > 0
    ? await db.getAll<RrhhColaborador>(
        `SELECT * FROM rrhh_colaboradores WHERE id IN (${colaboradorIds.map(() => '?').join(',')})`,
        colaboradorIds
      )
    : []
  const colaboradoresMap = new Map(colaboradores.map(c => [c.id, c]))
  const prevMap = new Map(prevSueldos.map(s => [s.colaborador_id, s]))

  return sueldos.map(s => {
    const colaborador = colaboradoresMap.get(s.colaborador_id)!
    const prev = prevMap.get(s.colaborador_id) ?? null
    // Delta compares sueldo+vacaciones total vs previous sueldo+vacaciones total
    const curTotal  = s.total_neto + (s.vacaciones_neto ?? 0)
    const prevTotal = prev ? prev.total_neto + (prev.vacaciones_neto ?? 0) : 0
    const delta_importe = prev ? curTotal - prevTotal : null
    const delta_pct = prev && prevTotal > 0
      ? Math.round(((curTotal - prevTotal) / prevTotal) * 1000) / 10
      : null
    return {
      ...s,
      colaborador,
      delta_importe,
      delta_pct,
      es_nuevo: prev === null,
    }
  })
}

export async function upsertSueldo(data: {
  periodoId: string
  colaboradorId: string
  total_neto: number
  tarea: string
  periodo_abonado: string
}): Promise<void> {
  const db = getPowerSyncDb()
  const now = Date.now()
  const existing = await db.getOptional<RrhhSueldo>(
    `SELECT * FROM rrhh_sueldos WHERE workspace_id = ? AND periodo_id = ? AND colaborador_id = ?`,
    [WORKSPACE_ID, data.periodoId, data.colaboradorId]
  )
  if (existing) {
    await db.execute(
      `UPDATE rrhh_sueldos SET total_neto = ?, tarea = ?, periodo_abonado = ?, updated_at = ? WHERE id = ?`,
      [data.total_neto, data.tarea, data.periodo_abonado, now, existing.id]
    )
  } else {
    await db.execute(
      `INSERT INTO rrhh_sueldos (id, workspace_id, periodo_id, colaborador_id, total_neto, tarea, periodo_abonado, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), WORKSPACE_ID, data.periodoId, data.colaboradorId,
       data.total_neto, data.tarea, data.periodo_abonado, now, now]
    )
  }
}

export async function getHistorialColaborador(colaboradorId: string): Promise<RrhhHistorialEntry[]> {
  const db = getPowerSyncDb()
  const sueldos = await db.getAll<RrhhSueldo>(
    `SELECT * FROM rrhh_sueldos WHERE colaborador_id = ? ORDER BY created_at ASC`,
    [colaboradorId]
  )
  const periodosIds = sueldos.map(s => s.periodo_id)
  if (periodosIds.length === 0) return []

  const periodos = await db.getAll<RrhhPeriodo>(
    `SELECT * FROM rrhh_periodos WHERE id IN (${periodosIds.map(() => '?').join(',')}) ORDER BY anio ASC, mes ASC`,
    periodosIds
  )
  const periodosMap = new Map(periodos.map(p => [p.id, p]))

  return sueldos
    .map((s, idx) => {
      const periodo = periodosMap.get(s.periodo_id)
      if (!periodo) return null
      const prev = idx > 0 ? sueldos[idx - 1] : null
      const delta_importe = prev ? s.total_neto - prev.total_neto : null
      const delta_pct = prev && prev.total_neto > 0
        ? Math.round(((s.total_neto - prev.total_neto) / prev.total_neto) * 1000) / 10
        : null
      return { periodo, sueldo: s, delta_importe, delta_pct }
    })
    .filter(Boolean) as RrhhHistorialEntry[]
}

export async function getAusentesEnPeriodo(periodoId: string): Promise<RrhhColaborador[]> {
  const db = getPowerSyncDb()
  const periodo = await getPeriodo(periodoId)
  if (!periodo) return []

  const prev = await getPeriodoByMes(
    periodo.mes === 1 ? periodo.anio - 1 : periodo.anio,
    periodo.mes === 1 ? 12 : periodo.mes - 1
  )
  if (!prev) return []

  const prevSueldos = await db.getAll<RrhhSueldo>(
    `SELECT * FROM rrhh_sueldos WHERE periodo_id = ?`, [prev.id]
  )
  const curSueldos = await db.getAll<RrhhSueldo>(
    `SELECT * FROM rrhh_sueldos WHERE periodo_id = ?`, [periodoId]
  )
  const curIds = new Set(curSueldos.map(s => s.colaborador_id))
  const ausenteIds = prevSueldos.filter(s => !curIds.has(s.colaborador_id)).map(s => s.colaborador_id)
  if (ausenteIds.length === 0) return []

  return db.getAll<RrhhColaborador>(
    `SELECT * FROM rrhh_colaboradores WHERE id IN (${ausenteIds.map(() => '?').join(',')})`,
    ausenteIds
  )
}
