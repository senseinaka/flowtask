import fs from 'fs'
import path from 'path'
import { dialog } from 'electron'
import { driveService } from './drive.service'
import { extractPayroll } from './payroll-pdf.extractor'
import {
  getPeriodoByMes, createPeriodo, updatePeriodoDrive, updatePeriodoStats, updatePeriodoVacaciones,
  upsertColaborador, upsertSueldo, updateSueldoVacaciones, getSueldoByPeriodoColaborador,
  listSueldosByPeriodo, getAusentesEnPeriodo, getColaboradorByDocumento
} from '../database/queries/rrhh'
import type { SavePayrollResult, SaveVacacionesResult, RrhhSmartAlert, RrhhEmpresa } from '@shared/types'

const MONTH_NAMES = [
  '', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function parsePeriodoAbonado(str: string): { mes: number; anio: number } | null {
  const m = str.match(/(\d{1,2})\s*[-–]\s*(\d{4})/)
  if (m) return { mes: parseInt(m[1]), anio: parseInt(m[2]) }
  return null
}

function parseFecha(str: string): { mes: number; anio: number } | null {
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) return { mes: parseInt(m[2]), anio: parseInt(m[3]) }
  return null
}

// Show native confirm dialog (returns true = replace, false = keep)
async function askReplace(nombre: string): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Reemplazar', 'Conservar existente'],
    defaultId: 0,
    cancelId: 1,
    title: 'Colaborador duplicado',
    message: `"${nombre}" ya tiene datos en este período.`,
    detail: '¿Querés reemplazar los datos existentes o conservarlos?',
  })
  return result.response === 0
}

export async function savePayroll(empresa: RrhhEmpresa, filePath: string): Promise<SavePayrollResult> {
  const extraction = await extractPayroll(filePath)
  // Filter out vacation employees — they are handled separately
  const employees = extraction.employees.filter(e => !e.isVacaciones)

  if (employees.length === 0) {
    throw new Error('No se encontraron sueldos en el PDF (si es de vacaciones, usá el botón correspondiente)')
  }

  const first = employees[0]
  const parsed = parsePeriodoAbonado(first.periodoAbonado) ?? parseFecha(first.fecha)
  if (!parsed) throw new Error(`No se pudo detectar el período del PDF: "${first.periodoAbonado}"`)

  const { mes, anio } = parsed
  const label = `${MONTH_NAMES[mes]} ${anio}`

  let periodo = await getPeriodoByMes(empresa, anio, mes)
  const totalNeto = employees.reduce((s, e) => s + e.totalNetoRaw, 0)
  const pdfNombre = path.basename(filePath)

  if (!periodo) {
    // New period — insert all
    periodo = await createPeriodo(empresa, {
      anio, mes, label, total_neto: totalNeto,
      cantidad_colaboradores: employees.length,
      pdf_nombre: pdfNombre,
      fecha_pago: first.fecha,
    })
    for (const emp of employees) {
      const colaborador = await upsertColaborador(empresa, {
        documento: emp.documento,
        cuil: emp.cuil,
        nombre: emp.apellidoYNombres,
        tarea_habitual: emp.tareaDesempenada,
        legajo: emp.legajo || undefined,
        fecha_ingreso: emp.fechaIngreso || undefined,
      })
      await upsertSueldo(empresa, {
        periodoId: periodo.id,
        colaboradorId: colaborador.id,
        total_neto: emp.totalNetoRaw,
        tarea: emp.tareaDesempenada,
        periodo_abonado: emp.periodoAbonado,
      })
    }
  } else {
    // Existing period — check each employee for conflicts
    const colaboradoresIds: string[] = []
    for (const emp of employees) {
      const colaborador = await upsertColaborador(empresa, {
        documento: emp.documento,
        cuil: emp.cuil,
        nombre: emp.apellidoYNombres,
        tarea_habitual: emp.tareaDesempenada,
        legajo: emp.legajo || undefined,
        fecha_ingreso: emp.fechaIngreso || undefined,
      })
      const existing = await getSueldoByPeriodoColaborador(periodo.id, colaborador.id)
      if (existing) {
        const replace = await askReplace(emp.apellidoYNombres)
        if (replace) {
          await upsertSueldo(empresa, {
            periodoId: periodo.id,
            colaboradorId: colaborador.id,
            total_neto: emp.totalNetoRaw,
            tarea: emp.tareaDesempenada,
            periodo_abonado: emp.periodoAbonado,
          })
        }
        // else keep existing — do nothing
      } else {
        await upsertSueldo(empresa, {
          periodoId: periodo.id,
          colaboradorId: colaborador.id,
          total_neto: emp.totalNetoRaw,
          tarea: emp.tareaDesempenada,
          periodo_abonado: emp.periodoAbonado,
        })
      }
      colaboradoresIds.push(colaborador.id)
    }
    // Recalculate period total from all sueldos
    const allSueldos = await listSueldosByPeriodo(periodo.id)
    const newTotal = allSueldos.reduce((s, e) => s + e.total_neto, 0)
    await updatePeriodoStats(periodo.id, {
      total_neto: newTotal,
      cantidad_colaboradores: allSueldos.length,
      pdf_nombre: pdfNombre,
      fecha_pago: first.fecha,
    })
    periodo = { ...periodo, total_neto: newTotal, cantidad_colaboradores: allSueldos.length, pdf_nombre: pdfNombre, fecha_pago: first.fecha }
  }

  // Upload PDF to Drive
  if (driveService.isAuthenticated()) {
    try {
      if (periodo.pdf_drive_file_id) {
        try { await driveService.deleteFile(periodo.pdf_drive_file_id) } catch { /* ignorar */ }
      }
      const folderName = `${String(mes).padStart(2, '0')}-${anio}`
      const folderId = await driveService.getOrCreateRrhhSueldosMesFolder(empresa, mes, anio)
      const fileName = `sueldos_${folderName}.pdf`
      const driveFileId = await driveService.uploadFileToFolder(filePath, folderId, fileName, 'application/pdf')
      await updatePeriodoDrive(periodo.id, driveFileId, folderId)
      periodo = { ...periodo, pdf_drive_file_id: driveFileId, pdf_drive_folder_id: folderId }
    } catch (err) {
      console.error('[RRHH] Error subiendo PDF a Drive:', err)
    }
  }

  const sueldos = await listSueldosByPeriodo(periodo.id)
  const ausentes = await getAusentesEnPeriodo(periodo.id)
  const alerts: RrhhSmartAlert[] = []

  for (const s of sueldos) {
    if (s.es_nuevo) {
      alerts.push({ type: 'nuevo', nombre: s.colaborador.nombre })
    } else if (s.delta_pct !== null && s.delta_importe !== null) {
      if (s.delta_pct >= 5) {
        alerts.push({ type: 'aumento', nombre: s.colaborador.nombre, importe: s.total_neto, delta: s.delta_importe, delta_pct: s.delta_pct })
      } else if (s.delta_pct <= -5) {
        alerts.push({ type: 'baja', nombre: s.colaborador.nombre, importe: s.total_neto, delta: s.delta_importe, delta_pct: s.delta_pct })
      }
    }
  }
  for (const c of ausentes) {
    alerts.push({ type: 'ausente', nombre: c.nombre })
  }

  return {
    periodo,
    colaboradoresNuevos: sueldos.filter(s => s.es_nuevo).length,
    colaboradoresActualizados: sueldos.filter(s => !s.es_nuevo).length,
    alerts,
  }
}

export async function saveVacaciones(empresa: RrhhEmpresa, filePath: string): Promise<SaveVacacionesResult> {
  const extraction = await extractPayroll(filePath)
  const employees = extraction.employees.filter(e => e.isVacaciones)

  if (employees.length === 0) {
    throw new Error('No se encontraron registros de vacaciones en el PDF')
  }

  // Detect period from first employee (period string like "5 - 2026 Vacaciones")
  const first = employees[0]
  const parsed = parsePeriodoAbonado(first.periodoAbonado) ?? parseFecha(first.fecha)
  if (!parsed) throw new Error(`No se pudo detectar el período: "${first.periodoAbonado}"`)

  const { mes, anio } = parsed
  const label = `${MONTH_NAMES[mes]} ${anio}`

  // Period must exist (vacaciones are linked to an existing salary period)
  let periodo = await getPeriodoByMes(empresa, anio, mes)
  if (!periodo) {
    // Auto-create the period if it doesn't exist yet
    periodo = await createPeriodo(empresa, {
      anio, mes, label, total_neto: 0,
      cantidad_colaboradores: 0,
      pdf_nombre: path.basename(filePath),
      fecha_pago: first.fecha,
    })
  }

  const pdfNombre = path.basename(filePath)
  let colaboradoresActualizados = 0
  let colaboradoresNuevos = 0
  const colaboradoresSinMatch: string[] = []

  for (const emp of employees) {
    // Find colaborador by documento
    const colaborador = await getColaboradorByDocumento(empresa, emp.documento)
    if (!colaborador) {
      colaboradoresSinMatch.push(emp.apellidoYNombres)
      continue
    }

    const existing = await getSueldoByPeriodoColaborador(periodo.id, colaborador.id)
    if (existing) {
      // Check if already has vacaciones data
      if (existing.vacaciones_neto !== null) {
        const replace = await askReplace(`${emp.apellidoYNombres} (vacaciones)`)
        if (!replace) continue
      }
      await updateSueldoVacaciones({
        periodoId: periodo.id,
        colaboradorId: colaborador.id,
        vacaciones_neto: emp.totalNetoRaw,
        vacaciones_dias: emp.vacacionesDias,
      })
      colaboradoresActualizados++
    } else {
      // Sueldo row doesn't exist — create it (vacaciones-only row)
      await upsertSueldo(empresa, {
        periodoId: periodo.id,
        colaboradorId: colaborador.id,
        total_neto: 0,
        tarea: colaborador.tarea_habitual,
        periodo_abonado: emp.periodoAbonado,
      })
      await updateSueldoVacaciones({
        periodoId: periodo.id,
        colaboradorId: colaborador.id,
        vacaciones_neto: emp.totalNetoRaw,
        vacaciones_dias: emp.vacacionesDias,
      })
      colaboradoresNuevos++
    }
  }

  // Recalculate period total_vacaciones
  const allSueldos = await listSueldosByPeriodo(periodo.id)
  const totalVacaciones = allSueldos.reduce((s, e) => s + (e.vacaciones_neto ?? 0), 0)

  // Upload to Drive
  let vacDriveFileId: string | null = null
  if (driveService.isAuthenticated()) {
    try {
      if (periodo.pdf_vacaciones_drive_file_id) {
        try { await driveService.deleteFile(periodo.pdf_vacaciones_drive_file_id) } catch { /* ignorar */ }
      }
      const folderId = periodo.pdf_drive_folder_id
        ?? await driveService.getOrCreateRrhhSueldosMesFolder(empresa, mes, anio)
      const folderName = `${String(mes).padStart(2, '0')}-${anio}`
      const fileName = `vacaciones_${folderName}.pdf`
      vacDriveFileId = await driveService.uploadFileToFolder(filePath, folderId, fileName, 'application/pdf')
    } catch (err) {
      console.error('[RRHH] Error subiendo PDF vacaciones a Drive:', err)
    }
  }

  await updatePeriodoVacaciones(periodo.id, {
    total_vacaciones: totalVacaciones,
    pdf_vacaciones_nombre: pdfNombre,
    pdf_vacaciones_drive_file_id: vacDriveFileId,
  })

  periodo = { ...periodo, total_vacaciones: totalVacaciones, pdf_vacaciones_nombre: pdfNombre, pdf_vacaciones_drive_file_id: vacDriveFileId }

  return {
    periodo,
    colaboradoresActualizados,
    colaboradoresNuevos,
    colaboradoresSinMatch,
  }
}
