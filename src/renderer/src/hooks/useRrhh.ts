import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SavePayrollResult, RrhhPeriodoConStats, RrhhSueldoConColaborador, RrhhHistorialEntry } from '@shared/types'

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
