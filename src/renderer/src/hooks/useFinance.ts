import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  FinanceAccount, FinanceCategory, FinanceConcept, FinanceMovement, FinanceMonthSummary,
  CreateFinanceAccountInput, CreateFinanceCategoryInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  FinanceMovementStatus
} from '@shared/types'
import dayjs from 'dayjs'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Color según el % de variación mes a mes (umbrales acordados con el usuario). */
export function getDiffColor(percent: number | null): string {
  if (percent === null) return '#64748b'   // slate — sin datos del mes anterior
  if (percent <= 0)   return '#10b981'     // verde   — bajó o igual
  if (percent <= 20)  return '#f59e0b'     // amarillo — subió 10–20%
  if (percent <= 50)  return '#f97316'     // naranja  — subió 20–50%
  return '#ef4444'                         // rojo     — subió más de 50%
}

export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function formatFinanceDate(ts: number | null): string {
  if (!ts) return '—'
  return dayjs(ts).format('DD/MM/YYYY')
}

export function getMonthLabel(month: number, year: number): string {
  return dayjs(new Date(year, month - 1, 1)).format('MMMM YYYY')
}

export function getEffectiveAmount(m: FinanceMovement): number {
  return m.amount_actual ?? m.amount_estimated
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function useFinanceAccounts() {
  return useQuery({
    queryKey: ['finance-accounts'],
    queryFn:  (): Promise<FinanceAccount[]> => window.api.finance.accounts.list(),
    staleTime: 60_000
  })
}

export function useCreateFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceAccountInput) => window.api.finance.accounts.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-accounts'] })
  })
}

export function useUpdateFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceAccountInput> }) =>
      window.api.finance.accounts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance-accounts'] })
  })
}

export function useDeleteFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.accounts.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-accounts'] })
  })
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useFinanceCategories() {
  return useQuery({
    queryKey: ['finance-categories'],
    queryFn:  (): Promise<FinanceCategory[]> => window.api.finance.categories.list(),
    staleTime: 60_000
  })
}

export function useCreateFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceCategoryInput) => window.api.finance.categories.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-categories'] })
  })
}

export function useUpdateFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceCategoryInput> }) =>
      window.api.finance.categories.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-categories'] })
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

export function useDeleteFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.categories.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-categories'] })
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
    }
  })
}

// ── Concepts ──────────────────────────────────────────────────────────────────

export function useFinanceConcepts(opts?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: ['finance-concepts', opts?.activeOnly ?? false],
    queryFn:  (): Promise<FinanceConcept[]> => window.api.finance.concepts.list(opts),
    staleTime: 60_000
  })
}

export function useCreateFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceConceptInput) => window.api.finance.concepts.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-concepts'] })
  })
}

export function useUpdateFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceConceptInput> & { is_active?: number } }) =>
      window.api.finance.concepts.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

export function useDeleteFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.concepts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

// ── Movements ─────────────────────────────────────────────────────────────────

export function useFinanceMovements(month: number, year: number) {
  return useQuery({
    queryKey: ['finance-movements', month, year],
    queryFn:  (): Promise<FinanceMovement[]> => window.api.finance.movements.list(month, year),
    staleTime: 30_000
  })
}

export function useCreateFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceMovementInput) => window.api.finance.movements.create(data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    }
  })
}

export function useUpdateFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceMovementInput> }) =>
      window.api.finance.movements.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    }
  })
}

/** Edición rápida en línea desde la tabla principal (optimista). */
export function useQuickUpdateFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string
      data: {
        amount_actual?: number | null
        status?:        FinanceMovementStatus
        payment_date?:  number | null
        due_date?:      number | null
        notes?:         string
      }
    }) => window.api.finance.movements.quickUpdate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    }
  })
}

export function useDeleteFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.movements.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    }
  })
}

export function useGenerateMovementsForMonth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      window.api.finance.movements.generateForMonth(month, year),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
      qc.invalidateQueries({ queryKey: ['finance-summary'] })
    }
  })
}

// ── Resumen / dashboard ───────────────────────────────────────────────────────

export function useFinanceMonthSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['finance-summary', month, year],
    queryFn:  (): Promise<FinanceMonthSummary> => window.api.finance.summary.get(month, year),
    staleTime: 30_000
  })
}
