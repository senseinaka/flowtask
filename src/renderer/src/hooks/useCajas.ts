import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type {
  CashCompany, Cashbox, CashboxWithBalance,
  CashCurrency, CashMovement, CashCount,
  CashAttachmentOwnerType,
} from '@shared/types'

// ─── Query keys ──────────────────────────────────────────────────────────────

const KEYS = {
  companies:  ['cajas', 'companies']  as const,
  cashboxes:  ['cajas', 'cashboxes']  as const,
  balances:   ['cajas', 'balances']   as const,
  lastCounts: ['cajas', 'lastCounts'] as const,
  categories: (type?: string) => ['cajas', 'categories', type ?? 'all'] as const,
  movements:  (id: string)    => ['cajas', 'movements', id]  as const,
  movementsDetailed: (id: string) => ['cajas', 'movementsDetailed', id] as const,
  counts:     (id: string)    => ['cajas', 'counts', id]     as const,
  differences:(id: string)    => ['cajas', 'differences', id] as const,
  differencesPending:           ['cajas', 'differences', 'pending'] as const,
  attachments:(ownerType: string, ownerId: string) => ['cajas', 'attachments', ownerType, ownerId] as const,
}

// ─── Base queries ─────────────────────────────────────────────────────────────

export function useCashCompanies() {
  return useQuery({
    queryKey: KEYS.companies,
    queryFn:  () => window.api.cajas.companies(),
  })
}

export function useCashboxes() {
  return useQuery({
    queryKey: KEYS.cashboxes,
    queryFn:  () => window.api.cajas.cashboxes(),
  })
}

export function useCashboxBalances() {
  return useQuery({
    queryKey: KEYS.balances,
    queryFn:  () => window.api.cajas.balances(),
  })
}

export function useCashboxLastCounts() {
  return useQuery({
    queryKey: KEYS.lastCounts,
    queryFn:  () => window.api.cajas.lastCounts(),
  })
}

export function useCashCategories(type?: 'income' | 'expense') {
  return useQuery({
    queryKey: KEYS.categories(type),
    queryFn:  () => window.api.cajas.categories(type),
  })
}

export function useCashMovements(cashboxId: string) {
  return useQuery({
    queryKey: KEYS.movements(cashboxId),
    queryFn:  () => window.api.cajas.movements.list(cashboxId),
    enabled:  !!cashboxId,
  })
}

export function useCashMovementsDetailed(cashboxId: string) {
  return useQuery({
    queryKey: KEYS.movementsDetailed(cashboxId),
    queryFn:  () => window.api.cajas.movements.listDetailed(cashboxId),
    enabled:  !!cashboxId,
  })
}

export function useCashCounts(cashboxId: string) {
  return useQuery({
    queryKey: KEYS.counts(cashboxId),
    queryFn:  () => window.api.cajas.counts.list(cashboxId),
    enabled:  !!cashboxId,
  })
}

export function useCashDifferences(cashboxId: string) {
  return useQuery({
    queryKey: KEYS.differences(cashboxId),
    queryFn:  () => window.api.cajas.differences.list(cashboxId),
    enabled:  !!cashboxId,
  })
}

// Todas las diferencias sin resolver del workspace (banner de alertas de descuadre).
// queryKey ['cajas','differences','pending'] cae bajo el prefijo que invalida
// useUpdateCashDifference, así que al resolver una se refresca solo.
export function usePendingDifferences() {
  return useQuery({
    queryKey: KEYS.differencesPending,
    queryFn:  () => window.api.cajas.differences.pending(),
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCashMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof window.api.cajas.movements.create>[0]) =>
      window.api.cajas.movements.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'balances'] })
      qc.invalidateQueries({ queryKey: ['cajas', 'movements'] })
    },
  })
}

export function useCreateCashCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof window.api.cajas.counts.create>[0]) =>
      window.api.cajas.counts.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'lastCounts'] })
      qc.invalidateQueries({ queryKey: ['cajas', 'counts'] })
      qc.invalidateQueries({ queryKey: ['cajas', 'differences'] })
    },
  })
}

export function useCreateTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof window.api.cajas.movements.transfer>[0]) =>
      window.api.cajas.movements.transfer(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'balances'] })
      qc.invalidateQueries({ queryKey: ['cajas', 'movements'] })
    },
  })
}

export function useUpdateCashDifference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, resolution_notes }: {
      id: string
      status: 'resolved' | 'written_off'
      resolution_notes: string
    }) => window.api.cajas.differences.update(id, { status, resolution_notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'differences'] })
      qc.invalidateQueries({ queryKey: ['cajas', 'cashboxes'] })
    },
  })
}

export function useCreateCashDifference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof window.api.cajas.differences.create>[0]) =>
      window.api.cajas.differences.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'differences'] })
    },
  })
}

export function useSetCashboxStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: import('@shared/types').CashboxStatus }) =>
      window.api.cajas.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'cashboxes'] })
    },
  })
}

export function useUpdateCashboxInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description: string }) =>
      window.api.cajas.update(id, name, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'cashboxes'] })
    },
  })
}

export function useMoveCashbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      window.api.cajas.move(id, direction),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cajas', 'cashboxes'] })
    },
  })
}

// ─── Resumen diario ───────────────────────────────────────────────────────────

export function useDailyMovementsSummary(cashboxId: string, date: string) {
  return useQuery({
    queryKey: ['cajas', 'daily', cashboxId, date],
    queryFn:  () => window.api.cajas.daily.summary(cashboxId, date),
    enabled:  !!cashboxId && !!date,
  })
}

// ─── Serie temporal para gráficos ─────────────────────────────────────────────

export function useCashFlowSeries(
  dateFrom: string,
  dateTo: string,
  cashboxIds: string[],
  currency: string = 'ARS'
) {
  return useQuery({
    queryKey: ['cajas', 'flowSeries', dateFrom, dateTo, currency, [...cashboxIds].sort().join(',')],
    queryFn:  () => window.api.cajas.charts.flowSeries(dateFrom, dateTo, cashboxIds, currency),
    enabled:  !!dateFrom && !!dateTo,
  })
}

// ─── Permisos ─────────────────────────────────────────────────────────────────

export function useCashboxPermissions(cashboxId: string) {
  return useQuery({
    queryKey: ['cajas', 'permissions', cashboxId],
    queryFn:  () => window.api.cajas.permissions.list(cashboxId),
    enabled:  !!cashboxId,
  })
}

export function useGrantCashboxPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { cashbox_id: string; user_id: string; permission_key: string }) =>
      window.api.cajas.permissions.grant(input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cajas', 'permissions', v.cashbox_id] })
    },
  })
}

export function useRevokeCashboxPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; cashbox_id: string }) =>
      window.api.cajas.permissions.revoke(id),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cajas', 'permissions', v.cashbox_id] })
    },
  })
}

// ─── Comprobantes (adjuntos en Drive) ─────────────────────────────────────────

export function useCashAttachments(ownerType: CashAttachmentOwnerType, ownerId: string) {
  return useQuery({
    queryKey: KEYS.attachments(ownerType, ownerId),
    queryFn:  () => window.api.cajas.attachments.list(ownerType, ownerId),
    enabled:  !!ownerId,
  })
}

export function useAddCashAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ownerType, ownerId }: { ownerType: CashAttachmentOwnerType; ownerId: string }) =>
      window.api.cajas.attachments.add(ownerType, ownerId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEYS.attachments(v.ownerType, v.ownerId) })
      qc.invalidateQueries({ queryKey: ['cajas', 'movementsDetailed'] })
    },
  })
}

export function useDeleteCashAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; ownerType: CashAttachmentOwnerType; ownerId: string }) =>
      window.api.cajas.attachments.delete(id),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEYS.attachments(v.ownerType, v.ownerId) })
      qc.invalidateQueries({ queryKey: ['cajas', 'movementsDetailed'] })
    },
  })
}

// ─── Combined: cajas enriquecidas con saldos y empresa ───────────────────────

export function useCashboxesWithBalances() {
  const { data: companies = [], isLoading: lc }   = useCashCompanies()
  const { data: cashboxes = [], isLoading: lb }   = useCashboxes()
  const { data: balanceRows = [], isLoading: lbr } = useCashboxBalances()
  const { data: lastCounts  = [], isLoading: llc } = useCashboxLastCounts()

  const companyMap = useMemo(
    () => Object.fromEntries(companies.map(c => [c.id, c])),
    [companies]
  )

  const balanceMap = useMemo(() => {
    const map: Record<string, Partial<Record<CashCurrency, number>>> = {}
    for (const row of balanceRows) {
      if (!map[row.cashbox_id]) map[row.cashbox_id] = {}
      map[row.cashbox_id][row.currency as CashCurrency] = row.balance
    }
    return map
  }, [balanceRows])

  const lastCountMap = useMemo(
    () => Object.fromEntries(lastCounts.map(r => [r.cashbox_id, r.last_count_at])),
    [lastCounts]
  )

  const enriched: CashboxWithBalance[] = useMemo(
    () => cashboxes.map(box => ({
      ...box,
      balances:      balanceMap[box.id] ?? {},
      last_count_at: lastCountMap[box.id],
      company:       companyMap[box.company_id],
    })),
    [cashboxes, balanceMap, lastCountMap, companyMap]
  )

  return {
    companies,
    cashboxes: enriched,
    isLoading: lc || lb || lbr || llc,
  }
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

export function parseCurrencies(json: string): CashCurrency[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : ['ARS']
  } catch {
    return ['ARS']
  }
}

// Montos siempre como enteros (sin centavos), para todas las monedas:
// las cajas manejan efectivo en valores enteros (ARS, USD y EUR).
export function fmtAmount(amount: number, _currency: CashCurrency): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}
