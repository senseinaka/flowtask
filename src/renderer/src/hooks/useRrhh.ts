import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  SavePayrollResult, SaveVacacionesResult,
  RrhhPeriodoConStats, RrhhSueldoConColaborador, RrhhHistorialEntry,
  RrhhColaborador, RrhhColaboradorConStats, RrhhNominaConfig,
  UpsertColaboradorInput, GenerarDesdeUltimoResult, ConfirmarGenerarInput,
  RrhhLista, RrhhListaTipo, UpsertListaInput,
  ImportParseResult, ConfirmImportInput,
} from '@shared/types'
import { useRrhhEmpresa } from '../routes/rrhh/RrhhEmpresaContext'

// Todos los hooks de datos resuelven la empresa activa desde el context (ruta
// :empresa) e incluyen `empresa` en el queryKey → la caché de NAKA y EV queda
// completamente aislada. Las listas (`rrhh:listas`) son compartidas entre empresas.

export function usePeriodos() {
  const empresa = useRrhhEmpresa()
  return useQuery<RrhhPeriodoConStats[]>({
    queryKey: ['rrhh:periodos', empresa],
    queryFn: () => window.api.rrhh.periodos.list(empresa),
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
  const empresa = useRrhhEmpresa()
  return useMutation<SavePayrollResult, Error, string>({
    mutationFn: (filePath) => window.api.rrhh.savePayroll(empresa, filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rrhh:periodos', empresa] })
    },
  })
}

export function useSaveVacaciones() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<SaveVacacionesResult, Error, string>({
    mutationFn: (filePath) => window.api.rrhh.saveVacaciones(empresa, filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rrhh:periodos', empresa] })
      qc.invalidateQueries({ queryKey: ['rrhh:sueldos'] })
    },
  })
}

export function useConfirmarPeriodo() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.api.rrhh.periodos.confirmar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:periodos', empresa] }),
  })
}

export function useDeletePeriodo() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.api.rrhh.periodos.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:periodos', empresa] }),
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
  const empresa = useRrhhEmpresa()
  return useQuery<RrhhColaboradorConStats[]>({
    queryKey: ['rrhh:nomina:colaboradores', empresa],
    queryFn: () => window.api.rrhh.nomina.colaboradores.list(empresa),
    staleTime: 30_000,
  })
}

export function useNominaConfig() {
  const empresa = useRrhhEmpresa()
  return useQuery<RrhhNominaConfig | null>({
    queryKey: ['rrhh:nomina:config', empresa],
    queryFn: () => window.api.rrhh.nomina.config.get(empresa),
    staleTime: 60_000,
  })
}

export function useUpsertColaborador() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<RrhhColaborador, Error, UpsertColaboradorInput>({
    mutationFn: (data) => window.api.rrhh.nomina.colaboradores.upsert(empresa, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] })
      qc.invalidateQueries({ queryKey: ['rrhh:colaboradores', empresa] })
    },
  })
}

export function useDeleteColaborador() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.api.rrhh.nomina.colaboradores.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] }),
  })
}

export function useHardDeleteColaborador() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<void, Error, string>({
    mutationFn: (id) => window.api.rrhh.nomina.colaboradores.hardDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] }),
  })
}

export function useAsignarLegajo() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<string, Error, string>({
    mutationFn: (id) => window.api.rrhh.nomina.colaboradores.asignarLegajo(empresa, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] }),
  })
}

export function useCrearDriveColaborador() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<string, Error, string>({
    mutationFn: (id) => window.api.rrhh.nomina.colaboradores.crearDrive(empresa, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] }),
  })
}

export function useGenerarDesdeUltimo() {
  const empresa = useRrhhEmpresa()
  return useMutation<GenerarDesdeUltimoResult, Error, void>({
    mutationFn: () => window.api.rrhh.nomina.generarDesdeUltimo(empresa),
  })
}

export function useConfirmarGenerar() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<{ creados: number; actualizados: number }, Error, { input: ConfirmarGenerarInput; crearDrive: boolean }>({
    mutationFn: ({ input, crearDrive }) => window.api.rrhh.nomina.confirmarGenerar(empresa, input, crearDrive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] }),
  })
}

export function useExportNominaXls() {
  return useMutation<string | null, Error, Record<string, unknown>[]>({
    mutationFn: (rows) => window.api.rrhh.nomina.exportXls(rows),
  })
}

export function useUploadColaboradorFoto() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<string, Error, { id: string; localPath: string }>({
    mutationFn: ({ id, localPath }) => window.api.rrhh.nomina.colaboradores.uploadFoto(id, localPath),
    onSuccess: (_fileId, { id }) => {
      qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] })
      qc.invalidateQueries({ queryKey: ['rrhh:foto', id] })
    },
  })
}

export function useUploadColaboradorCv() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<string, Error, { id: string; localPath: string }>({
    mutationFn: ({ id, localPath }) => window.api.rrhh.nomina.colaboradores.uploadCv(id, localPath),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] }),
  })
}

export function useFotoDataUrl(colaboradorId: string | undefined, hasFoto: boolean) {
  return useQuery<string | null>({
    queryKey: ['rrhh:foto', colaboradorId],
    queryFn: () => window.api.rrhh.nomina.colaboradores.getFotoDataUrl(colaboradorId!),
    enabled: !!colaboradorId && hasFoto,
    staleTime: 5 * 60_000,
  })
}

// ── Listas gestionadas (compartidas entre empresas) ───────────────────────────

export function useRrhhListas(tipo?: RrhhListaTipo) {
  return useQuery<RrhhLista[]>({
    queryKey: ['rrhh:listas', tipo ?? 'all'],
    queryFn: () => window.api.rrhh.listas.list(tipo),
    staleTime: 60_000,
  })
}

export function useUpsertLista() {
  const qc = useQueryClient()
  return useMutation<RrhhLista, Error, UpsertListaInput>({
    mutationFn: (data) => window.api.rrhh.listas.upsert(data),
    onSuccess: (newItem, vars) => {
      const update = (old: RrhhLista[] = []) =>
        vars.id
          ? old.map(item => item.id === vars.id ? newItem : item)
          : [...old, newItem]
      qc.setQueryData<RrhhLista[]>(['rrhh:listas', vars.tipo], update)
      qc.setQueryData<RrhhLista[]>(['rrhh:listas', 'all'], update)
    },
  })
}

export function useDeleteLista() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; tipo: RrhhListaTipo }>({
    mutationFn: ({ id }) => window.api.rrhh.listas.delete(id),
    onSuccess: (_, { id, tipo }) => {
      const remove = (old: RrhhLista[] = []) => old.filter(item => item.id !== id)
      qc.setQueryData<RrhhLista[]>(['rrhh:listas', tipo], remove)
      qc.setQueryData<RrhhLista[]>(['rrhh:listas', 'all'], remove)
    },
  })
}

export function useExportTemplate() {
  return useMutation<string | null, Error, void>({
    mutationFn: () => window.api.rrhh.nomina.exportTemplate(),
  })
}

export function useParseImport() {
  const empresa = useRrhhEmpresa()
  return useMutation<ImportParseResult, Error, string>({
    mutationFn: (filePath) => window.api.rrhh.nomina.parseImport(empresa, filePath),
  })
}

export function useConfirmImport() {
  const qc = useQueryClient()
  const empresa = useRrhhEmpresa()
  return useMutation<{ created: number; updated: number }, Error, ConfirmImportInput>({
    mutationFn: (input) => window.api.rrhh.nomina.confirmImport(empresa, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rrhh:nomina:colaboradores', empresa] })
    },
  })
}
