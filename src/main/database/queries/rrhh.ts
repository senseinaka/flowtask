import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  RrhhColaborador, RrhhPeriodo, RrhhSueldo,
  RrhhSueldoConColaborador, RrhhPeriodoConStats, RrhhHistorialEntry,
  RrhhColaboradorConStats, RrhhNominaConfig, UpsertColaboradorInput
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

// ── Colaboradores con stats (Nómina) ──────────────────────────────────────────

export async function listColaboradoresConStats(): Promise<RrhhColaboradorConStats[]> {
  const db = getPowerSyncDb()
  const colaboradores = await db.getAll<RrhhColaborador>(
    `SELECT * FROM rrhh_colaboradores WHERE workspace_id = ? ORDER BY nombre ASC`,
    [WORKSPACE_ID]
  )
  if (colaboradores.length === 0) return []

  const ids = colaboradores.map(c => c.id)
  const sueldos = await db.getAll<RrhhSueldo>(
    `SELECT rs.*, rp.label AS __label, rp.anio AS __anio, rp.mes AS __mes
     FROM rrhh_sueldos rs
     JOIN rrhh_periodos rp ON rp.id = rs.periodo_id
     WHERE rs.colaborador_id IN (${ids.map(() => '?').join(',')})
     ORDER BY rp.anio DESC, rp.mes DESC`,
    ids
  )

  const byColaborador = new Map<string, typeof sueldos>()
  for (const s of sueldos) {
    if (!byColaborador.has(s.colaborador_id)) byColaborador.set(s.colaborador_id, [])
    byColaborador.get(s.colaborador_id)!.push(s)
  }

  return colaboradores.map(c => {
    const hist = byColaborador.get(c.id) ?? []
    const last = hist[0] ?? null
    return {
      ...c,
      total_periodos: hist.length,
      ultimo_total_neto:      last ? last.total_neto : null,
      ultimo_vacaciones_neto: last ? (last.vacaciones_neto ?? null) : null,
      ultimo_periodo_label:   last ? (last as unknown as Record<string, unknown>).__label as string : null,
    }
  })
}

export async function getColaboradorById(id: string): Promise<RrhhColaborador | null> {
  return getPowerSyncDb().getOptional<RrhhColaborador>(
    `SELECT * FROM rrhh_colaboradores WHERE id = ?`, [id]
  )
}

export async function upsertColaboradorCompleto(data: UpsertColaboradorInput): Promise<RrhhColaborador> {
  const db = getPowerSyncDb()
  const now = Date.now()

  if (data.id) {
    const existing = await getColaboradorById(data.id)
    if (existing) {
      await db.execute(
        `UPDATE rrhh_colaboradores SET
          documento = ?, cuil = ?, nombre = ?, tarea_habitual = ?,
          legajo = ?, fecha_ingreso = ?, estado_laboral = ?,
          fecha_egreso = ?, motivo_egreso = ?, sector = ?, puesto = ?,
          categoria_laboral = ?, tipo_contratacion = ?, jornada = ?, modalidad = ?,
          email_personal = ?, email_laboral = ?, telefono = ?, fecha_nacimiento = ?,
          direccion = ?, localidad = ?, provincia = ?, banco = ?, cbu = ?,
          sueldo_neto_actual = ?, sueldo_bruto_actual = ?,
          observaciones = ?, legajo_estado = ?, updated_at = ?
         WHERE id = ?`,
        [
          data.documento, data.cuil ?? existing.cuil, data.nombre,
          data.tarea_habitual ?? existing.tarea_habitual,
          data.legajo ?? existing.legajo, data.fecha_ingreso ?? existing.fecha_ingreso,
          data.estado_laboral ?? existing.estado_laboral ?? 'activo',
          data.fecha_egreso ?? existing.fecha_egreso,
          data.motivo_egreso ?? existing.motivo_egreso,
          data.sector ?? existing.sector, data.puesto ?? existing.puesto,
          data.categoria_laboral ?? existing.categoria_laboral,
          data.tipo_contratacion ?? existing.tipo_contratacion,
          data.jornada ?? existing.jornada, data.modalidad ?? existing.modalidad,
          data.email_personal ?? existing.email_personal,
          data.email_laboral ?? existing.email_laboral,
          data.telefono ?? existing.telefono,
          data.fecha_nacimiento ?? existing.fecha_nacimiento,
          data.direccion ?? existing.direccion, data.localidad ?? existing.localidad,
          data.provincia ?? existing.provincia, data.banco ?? existing.banco,
          data.cbu ?? existing.cbu,
          data.sueldo_neto_actual ?? existing.sueldo_neto_actual,
          data.sueldo_bruto_actual ?? existing.sueldo_bruto_actual,
          data.observaciones ?? existing.observaciones,
          data.legajo_estado ?? existing.legajo_estado ?? 'pendiente',
          now, data.id,
        ]
      )
      return (await getColaboradorById(data.id))!
    }
  }

  // Create new
  const id = data.id ?? randomUUID()
  await db.execute(
    `INSERT INTO rrhh_colaboradores
      (id, workspace_id, documento, cuil, nombre, tarea_habitual,
       legajo, fecha_ingreso, activo, estado_laboral,
       fecha_egreso, motivo_egreso, sector, puesto, categoria_laboral,
       tipo_contratacion, jornada, modalidad,
       email_personal, email_laboral, telefono, fecha_nacimiento,
       direccion, localidad, provincia, banco, cbu,
       sueldo_neto_actual, sueldo_bruto_actual,
       observaciones, legajo_estado, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, WORKSPACE_ID, data.documento, data.cuil ?? '', data.nombre,
      data.tarea_habitual ?? '', data.legajo ?? null, data.fecha_ingreso ?? null,
      data.estado_laboral ?? 'activo', data.fecha_egreso ?? null,
      data.motivo_egreso ?? null, data.sector ?? null, data.puesto ?? null,
      data.categoria_laboral ?? null, data.tipo_contratacion ?? null,
      data.jornada ?? null, data.modalidad ?? null,
      data.email_personal ?? null, data.email_laboral ?? null,
      data.telefono ?? null, data.fecha_nacimiento ?? null,
      data.direccion ?? null, data.localidad ?? null, data.provincia ?? null,
      data.banco ?? null, data.cbu ?? null,
      data.sueldo_neto_actual ?? null, data.sueldo_bruto_actual ?? null,
      data.observaciones ?? null, data.legajo_estado ?? 'pendiente',
      now, now,
    ]
  )
  return (await getColaboradorById(id))!
}

export async function updateColaboradorDrive(id: string, folderId: string): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_colaboradores SET drive_legajo_folder_id = ?, updated_at = ? WHERE id = ?`,
    [folderId, Date.now(), id]
  )
}

export async function updateColaboradorMediaIds(
  id: string,
  fields: { foto_drive_file_id?: string | null; cv_drive_file_id?: string | null }
): Promise<void> {
  const sets: string[] = []
  const vals: unknown[] = []
  if ('foto_drive_file_id' in fields) { sets.push('foto_drive_file_id = ?'); vals.push(fields.foto_drive_file_id ?? null) }
  if ('cv_drive_file_id' in fields)   { sets.push('cv_drive_file_id = ?');   vals.push(fields.cv_drive_file_id ?? null) }
  if (!sets.length) return
  vals.push(Date.now(), id)
  await getPowerSyncDb().execute(
    `UPDATE rrhh_colaboradores SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
    vals
  )
}

export async function softDeleteColaborador(id: string): Promise<void> {
  await getPowerSyncDb().execute(
    `UPDATE rrhh_colaboradores SET activo = 0, estado_laboral = 'inactivo', updated_at = ? WHERE id = ?`,
    [Date.now(), id]
  )
}

export async function getNextLegajoNumber(): Promise<number> {
  const db = getPowerSyncDb()
  // Max legajo numérico ya asignado
  const row = await db.getOptional<{ max_leg: string | null }>(
    `SELECT MAX(CAST(legajo AS INTEGER)) AS max_leg FROM rrhh_colaboradores WHERE workspace_id = ? AND legajo IS NOT NULL`,
    [WORKSPACE_ID]
  )
  return (Number(row?.max_leg ?? 0)) + 1
}

export async function asignarLegajo(colaboradorId: string): Promise<string> {
  const next = await getNextLegajoNumber()
  const legajo = String(next).padStart(4, '0')
  await getPowerSyncDb().execute(
    `UPDATE rrhh_colaboradores SET legajo = ?, updated_at = ? WHERE id = ?`,
    [legajo, Date.now(), colaboradorId]
  )
  return legajo
}

// ── Nómina Config ─────────────────────────────────────────────────────────────

export async function getNominaConfig(): Promise<RrhhNominaConfig | null> {
  return getPowerSyncDb().getOptional<RrhhNominaConfig>(
    `SELECT * FROM rrhh_nomina_config WHERE workspace_id = ?`, [WORKSPACE_ID]
  )
}

export async function upsertNominaConfig(data: Partial<Omit<RrhhNominaConfig, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>): Promise<RrhhNominaConfig> {
  const db = getPowerSyncDb()
  const now = Date.now()
  const existing = await getNominaConfig()

  if (existing) {
    const sets: string[] = []
    const vals: unknown[] = []
    if ('drive_legajos_folder_id' in data) { sets.push('drive_legajos_folder_id = ?'); vals.push(data.drive_legajos_folder_id ?? null) }
    if ('ultimo_legajo_numero' in data) { sets.push('ultimo_legajo_numero = ?'); vals.push(data.ultimo_legajo_numero) }
    sets.push('updated_at = ?'); vals.push(now)
    vals.push(existing.id)
    await db.execute(`UPDATE rrhh_nomina_config SET ${sets.join(', ')} WHERE id = ?`, vals)
    return (await getNominaConfig())!
  }

  const id = randomUUID()
  await db.execute(
    `INSERT INTO rrhh_nomina_config (id, workspace_id, drive_legajos_folder_id, ultimo_legajo_numero, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, WORKSPACE_ID, data.drive_legajos_folder_id ?? null, data.ultimo_legajo_numero ?? 0, now, now]
  )
  return (await getNominaConfig())!
}

// ── Ausentes ──────────────────────────────────────────────────────────────────

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
