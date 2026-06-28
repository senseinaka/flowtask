import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type {
  CashCompany, Cashbox, CashboxWithBalance,
  CashCurrency, CashMovement, CashCount,
} from '@shared/types'

// ─── Query keys ──────────────────────────────────────────────────────────────

const KEYS = {
  companies:  ['cajas', 'companies']  as const,
  cashboxes:  ['cajas', 'cashboxes']  as const,
  balances:   ['cajas', 'balances']   as const,
  lastCounts: ['cajas', 'lastCounts'] as const,
  categories: (type?: string) => ['cajas', 'categories', type ?? 'all'] as const,
  movements:  (id: string)    => ['cajas', 'movements', id]  as const,
  counts:     (id: string)    => ['cajas', 'counts', id]     as const,
  differences:(id: string)    => ['cajas', 'differences', id] as const,
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

export function fmtAmount(amount: number, currency: CashCurrency): string {
  if (currency === 'ARS') {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount)
  }
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}
