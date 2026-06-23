import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  SavePayrollResult, SaveVacacionesResult,
  RrhhPeriodoConStats, RrhhSueldoConColaborador, RrhhHistorialEntry,
  RrhhColaborador, RrhhColaboradorConStats, RrhhNominaConfig,
  UpsertColaboradorInput, GenerarDesdeUltimoResult, ConfirmarGenerarInput,
} from '@shared/types'

export function usePeriodos() {
  return useQuery<RrhhPeriodoConStats[]>({
    queryKey: ['rrhh:periodos'],
    queryFn: () => window.api.rrhh.periodos.list(),
    staleTime: 30_000,
  })
}

export function useSueldos(periodoId: string | null) {
  return useQuery<RrhhSueldoConColaborador[]>({
    queryKey: ['rrhh:sueldos', periodoId],
    queryFn: () => window.api.rrhh.sueldos.list(periodoId!),
    enabled: !!periodoId,
    staleTime: 30_000,
  })
}

export function useHistorialColaborador(colaboradorId: string | null) {
  return useQuery<RrhhHistorialEntry[]>({
    queryKey: ['rrhh:historial', colaboradorId],
    queryFn: () => window.api.rrhh.colaboradores.historial(colaboradorId!),
    enabled: !!colaboradorId,
    staleTime: 60_000,
  })
}

export function useSavePayroll() {
  const qc = useQueryClient()
  return useMutation<SavePayrollResult, Error, string>({
    mutationFn: (filePath) => window.api.rrhh.savePayroll(filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rrhh:periodos'] })
    },
  })
}

export function useSaveVacaciones() {
  const qc = useQueryClient()
  return useMutation<SaveVacacionesResult, Error, string>({
    mutationFn: (filePath) => window.api.rrhh.saveVacaciones(filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rrhh:periodos'] })
      qc.invalidateQueries({ queryKey: ['rrhh:sueldos'] })
    },
  })
}

export function useConfirmarPeriodo() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.api.rrhh.periodos.confirmar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:periodos'] }),
  })
}

export function useDeletePeriodo() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.api.rrhh.periodos.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:periodos'] }),
  })
}

export function useUpdateSueldoNotas(periodoId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; notas: string | null }>({
    mutationFn: ({ id, notas }) => window.api.rrhh.sueldos.updateNotas(id, notas),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:sueldos', periodoId] }),
  })
}

export function useExportXls() {
  return useMutation<string | null, Error, {
    periodoLabel: string
    defaultFileName: string
    rows: Record<string, unknown>[]
  }>({
    mutationFn: ({ periodoLabel, defaultFileName, rows }) =>
      window.api.rrhh.exportXls(periodoLabel, defaultFileName, rows),
  })
}

// ── Nómina de Colaboradores ───────────────────────────────────────────────────

export function useNominaColaboradores() {
  return useQuery<RrhhColaboradorConStats[]>({
    queryKey: ['rrhh:nomina:colaboradores'],
    queryFn: () => window.api.rrhh.nomina.colaboradores.list(),
    staleTime: 30_000,
  })
}

export function useNominaConfig() {
  return useQuery<RrhhNominaConfig | null>({
    queryKey: ['rrhh:nomina:config'],
    queryFn: () => window.api.rrhh.nomina.config.get(),
    staleTime: 60_000,
  })
}

export function useUpsertColaborador() {
  const qc = useQueryClient()
  return useMutation<RrhhColaborador, Error, UpsertColaboradorInput>({
    mutationFn: (data) => window.api.rrhh.nomina.colaboradores.upsert(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores'] })
      qc.invalidateQueries({ queryKey: ['rrhh:colaboradores'] })
    },
  })
}

export function useDeleteColaborador() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.api.rrhh.nomina.colaboradores.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores'] }),
  })
}

export function useAsignarLegajo() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (id) => window.api.rrhh.nomina.colaboradores.asignarLegajo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores'] }),
  })
}

export function useCrearDriveColaborador() {
  const qc = useQueryClient()
  return useMutation<string, Error, string>({
    mutationFn: (id) => window.api.rrhh.nomina.colaboradores.crearDrive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores'] }),
  })
}

export function useGenerarDesdeUltimo() {
  return useMutation<GenerarDesdeUltimoResult, Error, void>({
    mutationFn: () => window.api.rrhh.nomina.generarDesdeUltimo(),
  })
}

export function useConfirmarGenerar() {
  const qc = useQueryClient()
  return useMutation<{ creados: number; actualizados: number }, Error, { input: ConfirmarGenerarInput; crearDrive: boolean }>({
    mutationFn: ({ input, crearDrive }) => window.api.rrhh.nomina.confirmarGenerar(input, crearDrive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores'] }),
  })
}

export function useExportNominaXls() {
  return useMutation<string | null, Error, Record<string, unknown>[]>({
    mutationFn: (rows) => window.api.rrhh.nomina.exportXls(rows),
  })
}
