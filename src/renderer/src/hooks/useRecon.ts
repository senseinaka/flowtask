import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ReconPeriod, ReconImport, ReconInvoice, ReconMLOp, ReconResult, ReconKPIs,
  CreateReconPeriodInput, ReconEstado, ReconPeriodStatus
} from '@shared/types'

function invalidatePeriod(qc: ReturnType<typeof useQueryClient>, periodId: string): void {
  qc.invalidateQueries({ queryKey: ['recon-periods'] })
  qc.invalidateQueries({ queryKey: ['recon-period', periodId] })
  qc.invalidateQueries({ queryKey: ['recon-imports', periodId] })
  qc.invalidateQueries({ queryKey: ['recon-invoices', periodId] })
  qc.invalidateQueries({ queryKey: ['recon-mlops', periodId] })
  qc.invalidateQueries({ queryKey: ['recon-results', periodId] })
  qc.invalidateQueries({ queryKey: ['recon-kpis', periodId] })
}

export function useReconPeriods() {
  return useQuery({
    queryKey: ['recon-periods'],
    queryFn: (): Promise<ReconPeriod[]> => window.api.recon.periods.list(),
    staleTime: 30_000,
  })
}

export function useReconPeriod(id: string) {
  return useQuery({
    queryKey: ['recon-period', id],
    queryFn: (): Promise<ReconPeriod | null> => window.api.recon.periods.get(id),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCreateReconPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ data, userId }: { data: CreateReconPeriodInput; userId: string }): Promise<ReconPeriod> =>
      window.api.recon.periods.create(data, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recon-periods'] }),
  })
}

export function useSetReconPeriodStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, closedBy }: { id: string; status: ReconPeriodStatus; closedBy?: string }): Promise<void> =>
      window.api.recon.periods.setStatus(id, status, closedBy),
    onSuccess: (_, { id }) => invalidatePeriod(qc, id),
  })
}

export function useDeleteReconPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<void> => window.api.recon.periods.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recon-periods'] }),
  })
}

export function useReconImports(periodId: string) {
  return useQuery({
    queryKey: ['recon-imports', periodId],
    queryFn: (): Promise<ReconImport[]> => window.api.recon.imports.list(periodId),
    enabled: !!periodId,
    staleTime: 10_000,
  })
}

export function useReconInvoices(periodId: string) {
  return useQuery({
    queryKey: ['recon-invoices', periodId],
    queryFn: (): Promise<ReconInvoice[]> => window.api.recon.data.invoices(periodId),
    enabled: !!periodId,
    staleTime: 60_000,
  })
}

export function useReconMLOps(periodId: string) {
  return useQuery({
    queryKey: ['recon-mlops', periodId],
    queryFn: (): Promise<ReconMLOp[]> => window.api.recon.data.mlops(periodId),
    enabled: !!periodId,
    staleTime: 60_000,
  })
}

export function useReconResults(periodId: string, estado?: ReconEstado) {
  return useQuery({
    queryKey: ['recon-results', periodId, estado ?? 'all'],
    queryFn: (): Promise<ReconResult[]> => window.api.recon.results.list(periodId, estado),
    enabled: !!periodId,
    staleTime: 10_000,
  })
}

export function useRunRecon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (periodId: string): Promise<{ ok: boolean; inserted?: number; error?: string }> =>
      window.api.recon.run(periodId),
    onSuccess: (_, periodId) => invalidatePeriod(qc, periodId),
  })
}

export function useUpdateReconResult() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, data
    }: {
      id: string
      periodId: string
      data: { estado?: ReconEstado; notes?: string; override_by?: string }
    }): Promise<void> => window.api.recon.results.update(id, data),
    onSuccess: (_, { periodId }) => {
      qc.invalidateQueries({ queryKey: ['recon-results', periodId] })
      qc.invalidateQueries({ queryKey: ['recon-kpis', periodId] })
    },
  })
}

export function useReconKPIs(periodId: string) {
  return useQuery({
    queryKey: ['recon-kpis', periodId],
    queryFn: (): Promise<ReconKPIs> => window.api.recon.kpis.get(periodId),
    enabled: !!periodId,
    staleTime: 30_000,
  })
}
