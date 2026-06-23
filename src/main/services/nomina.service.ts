import {
  listPeriodos, listSueldosByPeriodo, getColaboradorById,
  upsertColaboradorCompleto, updateColaboradorDrive
} from '../database/queries/rrhh'
import { driveService } from './drive.service'
import type {
  GenerarDesdeUltimoEntry, GenerarDesdeUltimoResult,
  ConfirmarGenerarInput, UpsertColaboradorInput
} from '@shared/types'

/**
 * Lee el período más reciente, cruza los sueldos con los colaboradores existentes
 * y devuelve una vista previa de lo que se va a crear/actualizar.
 */
export async function generarDesdeUltimoPeriodo(): Promise<GenerarDesdeUltimoResult> {
  const periodos = await listPeriodos()
  if (periodos.length === 0) throw new Error('No hay períodos liquidados aún')

  const ultimo = periodos[0]
  const sueldos = await listSueldosByPeriodo(ultimo.id)

  const entries: GenerarDesdeUltimoEntry[] = sueldos.map(s => {
    const col = s.colaborador
    const esNuevo = !col
    const esModificado = !esNuevo && (
      col.tarea_habitual !== s.tarea ||
      col.estado_laboral === 'inactivo'
    )
    return {
      colaborador_id: col?.id ?? null,
      nombre: col?.nombre ?? s.colaborador?.nombre ?? '',
      documento: col?.documento ?? '',
      cuil: col?.cuil ?? '',
      tarea: s.tarea,
      total_neto: s.total_neto,
      vacaciones_neto: s.vacaciones_neto ?? null,
      legajo: col?.legajo ?? null,
      fecha_ingreso: col?.fecha_ingreso ?? null,
      esNuevo,
      esModificado,
    }
  })

  return { periodoLabel: ultimo.label, entries }
}

/**
 * Confirma la generación: crea/actualiza colaboradores, opcionalmente crea carpetas Drive.
 */
export async function confirmarGenerarNomina(
  input: ConfirmarGenerarInput,
  crearCarpetasDrive: boolean
): Promise<{ creados: number; actualizados: number }> {
  let creados = 0
  let actualizados = 0

  for (const entry of input.entries) {
    const upsertData: UpsertColaboradorInput = {
      id: entry.colaborador_id ?? undefined,
      documento: entry.documento,
      cuil: entry.cuil,
      nombre: entry.nombre,
      tarea_habitual: entry.tarea,
      legajo: entry.legajo ?? undefined,
      fecha_ingreso: entry.fecha_ingreso ?? undefined,
      sueldo_neto_actual: entry.total_neto,
      estado_laboral: 'activo',
    }

    const col = await upsertColaboradorCompleto(upsertData)

    if (entry.esNuevo) {
      creados++
    } else {
      actualizados++
    }

    // Si solicitó Drive y el colaborador tiene legajo, crear carpeta
    if (crearCarpetasDrive && col.legajo && !col.drive_legajo_folder_id && driveService.isAuthenticated()) {
      try {
        const folderId = await driveService.getOrCreateColaboradorLegajoFolder(col.legajo, col.nombre)
        await updateColaboradorDrive(col.id, folderId)
      } catch {
        // Drive no critico — continuar
      }
    }
  }

  return { creados, actualizados }
}

/**
 * Crea la carpeta Drive para un colaborador (bajo demanda desde el perfil).
 * Devuelve el folder ID.
 */
export async function crearCarpetaDriveColaborador(colaboradorId: string): Promise<string> {
  const col = await getColaboradorById(colaboradorId)
  if (!col) throw new Error('Colaborador no encontrado')
  if (!col.legajo) throw new Error('El colaborador no tiene legajo asignado')
  if (!driveService.isAuthenticated()) throw new Error('No autenticado con Google Drive')

  const folderId = await driveService.getOrCreateColaboradorLegajoFolder(col.legajo, col.nombre)
  await updateColaboradorDrive(col.id, folderId)
  return folderId
}
