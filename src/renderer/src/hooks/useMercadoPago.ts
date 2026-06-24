import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CreateMpConnectionInput,
  MpReportConfig,
  MpTransactionFilters,
  MpReconciliationStatus,
} from '@shared/types'

// ─── Conexiones ───────────────────────────────────────────────────────────────

export function useMpConnections() {
  return useQuery({
    queryKey: ['mp-connections'],
    queryFn: () => window.api.mercadopago.connections.list(),
  })
}

export function useCreateMpConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, userId }: { input: CreateMpConnectionInput; userId: string }) =>
      window.api.mercadopago.connections.create(input, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mp-connections'] }),
  })
}

export function useUpdateMpToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, newToken }: { connectionId: string; newToken: string }) =>
      window.api.mercadopago.connections.updateToken(connectionId, newToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mp-connections'] }),
  })
}

export function useTestMpConnection() {
  return useMutation({
    mutationFn: (connectionId: string) =>
      window.api.mercadopago.connections.test(connectionId),
  })
}

export function useDeleteMpConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (connectionId: string) =>
      window.api.mercadopago.connections.delete(connectionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mp-connections'] }),
  })
}

// ─── Configuración de reportes ─────────────────────────────────────────────────

export function useMpDefaultConfig() {
  return useQuery({
    queryKey: ['mp-config-default'],
    queryFn: () => window.api.mercadopago.config.default(),
    staleTime: Infinity,
  })
}

export function useMpReportConfig(connectionId: string | null) {
  return useQuery({
    queryKey: ['mp-config', connectionId],
    queryFn: () => window.api.mercadopago.config.get(connectionId!),
    enabled: !!connectionId,
  })
}

export function useSetMpReportConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, config }: { connectionId: string; config: Partial<MpReportConfig> }) =>
      window.api.mercadopago.config.set(connectionId, config),
    onSuccess: (_r, { connectionId }) =>
      qc.invalidateQueries({ queryKey: ['mp-config', connectionId] }),
  })
}

// ─── Jobs ──────────────────────────────────────────────────────────────────────

export function useMpJobs(connectionId: string | null, limit?: number) {
  return useQuery({
    queryKey: ['mp-jobs', connectionId, limit],
    queryFn: () => window.api.mercadopago.jobs.list(connectionId!, limit),
    enabled: !!connectionId,
    refetchInterval: (query) => {
      const data = query.state.data ?? []
      const hasPending = data.some(j =>
        j.status === 'requested' || j.status === 'ready_to_download' || j.status === 'downloading' || j.status === 'processing'
      )
      return hasPending ? 5000 : false
    },
  })
}

export function useRequestMpReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      connectionId, dateFrom, dateTo, requestedBy
    }: { connectionId: string; dateFrom: string; dateTo: string; requestedBy: string }) =>
      window.api.mercadopago.jobs.request(connectionId, dateFrom, dateTo, requestedBy),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mp-jobs'] }),
  })
}

export function usePollMpJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => window.api.mercadopago.jobs.poll(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mp-jobs'] }),
  })
}

export function useDownloadMpJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => window.api.mercadopago.jobs.download(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mp-jobs'] })
      qc.invalidateQueries({ queryKey: ['mp-transactions'] })
      qc.invalidateQueries({ queryKey: ['mp-connections'] })
    },
  })
}

export function useOpenMpJobFile() {
  return useMutation({
    mutationFn: (jobId: string) => window.api.mercadopago.jobs.openFile(jobId),
  })
}

export function useShowMpJobInFolder() {
  return useMutation({
    mutationFn: (jobId: string) => window.api.mercadopago.jobs.showInFolder(jobId),
  })
}

export function useCancelMpJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => window.api.mercadopago.jobs.cancel(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mp-jobs'] }),
  })
}

// ─── Sincronización completa ───────────────────────────────────────────────────

export function useRunMpSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      connectionId, dateFrom, dateTo, requestedBy
    }: { connectionId: string; dateFrom: string; dateTo: string; requestedBy: string }) =>
      window.api.mercadopago.sync.run(connectionId, dateFrom, dateTo, requestedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mp-jobs'] })
      qc.invalidateQueries({ queryKey: ['mp-transactions'] })
      qc.invalidateQueries({ queryKey: ['mp-connections'] })
    },
  })
}

// ─── Transacciones ─────────────────────────────────────────────────────────────

export function useMpTransactions(filters: MpTransactionFilters) {
  return useQuery({
    queryKey: ['mp-transactions', filters],
    queryFn: () => window.api.mercadopago.transactions.list(filters),
    enabled: !!filters.connection_id,
  })
}

export function useUpdateMpReconStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MpReconciliationStatus }) =>
      window.api.mercadopago.transactions.updateRecon(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mp-transactions'] }),
  })
}

export function useMpTransactionStats(connectionId: string | null) {
  return useQuery({
    queryKey: ['mp-stats', connectionId],
    queryFn: () => window.api.mercadopago.transactions.stats(connectionId!),
    enabled: !!connectionId,
  })
}
