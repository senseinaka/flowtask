import fs from 'fs'
import path from 'path'
import { driveService } from './drive.service'
import { extractPayroll } from './payroll-pdf.extractor'
import {
  getPeriodoByMes, createPeriodo, updatePeriodoDrive,
  upsertColaborador, upsertSueldo, listSueldosByPeriodo, getAusentesEnPeriodo
} from '../database/queries/rrhh'
import type { SavePayrollResult, RrhhSmartAlert } from '@shared/types'

const MONTH_NAMES = [
  '', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function parsePeriodoAbonado(str: string): { mes: number; anio: number } | null {
  // "5 - 2026 Haberes normales" → { mes: 5, anio: 2026 }
  const m = str.match(/(\d{1,2})\s*[-–]\s*(\d{4})/)
  if (m) return { mes: parseInt(m[1]), anio: parseInt(m[2]) }
  return null
}

function parseFecha(str: string): { mes: number; anio: number } | null {
  // "13/5/2026" or "13-5-2026"
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m) return { mes: parseInt(m[2]), anio: parseInt(m[3]) }
  return null
}

export async function savePayroll(filePath: string): Promise<SavePayrollResult> {
  const extraction = await extractPayroll(filePath)
  const { employees } = extraction

  if (employees.length === 0) throw new Error('No se encontraron empleados en el PDF')

  // Detect period from first employee
  const first = employees[0]
  const parsed = parsePeriodoAbonado(first.periodoAbonado) ?? parseFecha(first.fecha)
  if (!parsed) throw new Error(`No se pudo detectar el período del PDF: "${first.periodoAbonado}"`)

  const { mes, anio } = parsed
  const label = `${MONTH_NAMES[mes]} ${anio}`

  // Get or create period
  let periodo = await getPeriodoByMes(anio, mes)
  const totalNeto = employees.reduce((s, e) => s + e.totalNetoRaw, 0)
  const pdfNombre = path.basename(filePath)

  if (!periodo) {
    periodo = await createPeriodo({
      anio, mes, label, total_neto: totalNeto,
      cantidad_colaboradores: employees.length,
      pdf_nombre: pdfNombre,
      fecha_pago: first.fecha,
    })
  }

  // Upsert colaboradores + sueldos
  let colaboradoresNuevos = 0
  let colaboradoresActualizados = 0

  for (const emp of employees) {
    const isNew = !(await getPeriodoByMes(anio, mes - 1 < 1 ? anio - 1 : anio, mes - 1 < 1 ? 12 : mes - 1))
    const colaborador = await upsertColaborador({
      documento: emp.documento,
      cuil: emp.cuil,
      nombre: emp.apellidoYNombres,
      tarea_habitual: emp.tareaDesempenada,
    })
    // Track if was new (no id means fresh insert — but upsertColaborador always returns existing or new)
    // We detect "nuevo" by checking if we inserted vs updated: count both
    colaboradoresNuevos++ // will refine with alerts below
    colaboradoresActualizados++

    await upsertSueldo({
      periodoId: periodo.id,
      colaboradorId: colaborador.id,
      total_neto: emp.totalNetoRaw,
      tarea: emp.tareaDesempenada,
      periodo_abonado: emp.periodoAbonado,
    })
  }

  // Upload PDF to Drive
  if (driveService.isAuthenticated()) {
    try {
      const folderName = `${String(mes).padStart(2, '0')}-${anio}`
      const folderId = await driveService.getOrCreateRrhhSueldosMesFolder(mes, anio)
      const fileName = `sueldos_${folderName}.pdf`
      const driveFileId = await driveService.uploadFileToFolder(filePath, folderId, fileName, 'application/pdf')
      await updatePeriodoDrive(periodo.id, driveFileId, folderId)
      periodo = { ...periodo, pdf_drive_file_id: driveFileId, pdf_drive_folder_id: folderId }
    } catch (err) {
      console.error('[RRHH] Error subiendo PDF a Drive:', err)
    }
  }

  // Build smart alerts
  const sueldos = await listSueldosByPeriodo(periodo.id)
  const ausentes = await getAusentesEnPeriodo(periodo.id)
  const alerts: RrhhSmartAlert[] = []

  for (const s of sueldos) {
    if (s.es_nuevo) {
      alerts.push({ type: 'nuevo', nombre: s.colaborador.nombre })
    } else if (s.delta_pct !== null && s.delta_importe !== null) {
      if (s.delta_pct >= 5) {
        alerts.push({
          type: 'aumento',
          nombre: s.colaborador.nombre,
          importe: s.total_neto,
          delta: s.delta_importe,
          delta_pct: s.delta_pct,
        })
      } else if (s.delta_pct <= -5) {
        alerts.push({
          type: 'baja',
          nombre: s.colaborador.nombre,
          importe: s.total_neto,
          delta: s.delta_importe,
          delta_pct: s.delta_pct,
        })
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
