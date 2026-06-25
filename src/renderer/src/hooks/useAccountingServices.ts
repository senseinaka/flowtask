import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AccountingServiceFilters,
  CreateAccountingServiceInput,
  RegisterServicePaymentInput,
  ServiceStatus,
} from '@shared/types'

// ─── Servicios ──────────────────────────────────────────────────────────────────

export function useServices(filters: AccountingServiceFilters = {}) {
  return useQuery({
    queryKey: ['accounting-services', filters],
    queryFn: () => window.api.services.list(filters),
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAccountingServiceInput) => window.api.services.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting-services'] }),
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateAccountingServiceInput> }) =>
      window.api.services.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting-services'] }),
  })
}

export function useSetServiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ServiceStatus }) =>
      window.api.services.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting-services'] }),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.services.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting-services'] }),
  })
}

// ─── Pagos / renovaciones ───────────────────────────────────────────────────────

export function useServicePayments(serviceId: string | null) {
  return useQuery({
    queryKey: ['service-payments', serviceId],
    queryFn: () => window.api.services.payments.list(serviceId!),
    enabled: !!serviceId,
  })
}

export function useRegisterServicePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterServicePaymentInput) => window.api.services.payments.register(input),
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: ['accounting-services'] })
      qc.invalidateQueries({ queryKey: ['service-payments', input.service_id] })
    },
  })
}

export function useDeleteServicePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; serviceId: string }) => window.api.services.payments.delete(id),
    onSuccess: (_r, { serviceId }) => {
      qc.invalidateQueries({ queryKey: ['service-payments', serviceId] })
      qc.invalidateQueries({ queryKey: ['accounting-services'] })
    },
  })
}
