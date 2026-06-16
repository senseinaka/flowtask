import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  FinanceAccount, FinanceCategory, FinancePaymentMethodEntity, FinanceConcept, FinanceMovement, FinanceMonthSummary,
  FinanceMonthInsight,
  FinanceMovementEntry,
  CreateFinanceAccountInput, CreateFinanceCategoryInput, CreateFinancePaymentMethodInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  CreateFinanceMovementEntryInput, UpdateFinanceMovementEntryInput,
  FinanceMovementStatus,
  FinanceCategoryBreakdownItem, FinanceHistoryEntry, FinanceRankingConcept, FinanceRankingIncrease,
  FinanceImportPreviewResult, FinanceImportConfirmItem, FinanceImportResult, FinanceSecurityStatus
} from '@shared/types'
import { FINANCE_HISTORY_MONTHS } from './useFinance'

// ── Accounts ──────────────────────────────────────────────────────────────────

export function useCompanyFinanceAccounts() {
  return useQuery({
    queryKey: ['company-finance-accounts'],
    queryFn:  (): Promise<FinanceAccount[]> => window.api.companyFinance.accounts.list(),
    staleTime: 60_000
  })
}

export function useCreateCompanyFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceAccountInput) => window.api.companyFinance.accounts.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['company-finance-accounts'] })
  })
}

export function useUpdateCompanyFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceAccountInput> }) =>
      window.api.companyFinance.accounts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-finance-accounts'] })
  })
}

export function useDeleteCompanyFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.companyFinance.accounts.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['company-finance-accounts'] })
  })
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useCompanyFinanceCategories() {
  return useQuery({
    queryKey: ['company-finance-categories'],
    queryFn:  (): Promise<FinanceCategory[]> => window.api.companyFinance.categories.list(),
    staleTime: 60_000
  })
}

export function useCreateCompanyFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceCategoryInput) => window.api.companyFinance.categories.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['company-finance-categories'] })
  })
}

export function useUpdateCompanyFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceCategoryInput> }) =>
      window.api.companyFinance.categories.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-finance-categories'] })
      qc.invalidateQueries({ queryKey: ['company-finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['company-finance-movements'] })
    }
  })
}

export function useDeleteCompanyFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.companyFinance.categories.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-finance-categories'] })
      qc.invalidateQueries({ queryKey: ['company-finance-concepts'] })
    }
  })
}

// ── Payment methods ───────────────────────────────────────────────────────────

export function useCompanyFinancePaymentMethods() {
  return useQuery({
    queryKey: ['company-finance-payment-methods'],
    queryFn:  (): Promise<FinancePaymentMethodEntity[]> => window.api.companyFinance.paymentMethods.list(),
    staleTime: 60_000
  })
}

export function useCreateCompanyFinancePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinancePaymentMethodInput) => window.api.companyFinance.paymentMethods.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['company-finance-payment-methods'] })
  })
}

export function useUpdateCompanyFinancePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinancePaymentMethodInput> }) =>
      window.api.companyFinance.paymentMethods.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-finance-payment-methods'] })
      qc.invalidateQueries({ queryKey: ['company-finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['company-finance-movements'] })
    }
  })
}

export function useDeleteCompanyFinancePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.companyFinance.paymentMethods.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-finance-payment-methods'] })
      qc.invalidateQueries({ queryKey: ['company-finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['company-finance-movements'] })
    }
  })
}

// ── Concepts ──────────────────────────────────────────────────────────────────

export function useCompanyFinanceConcepts(opts?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: ['company-finance-concepts', opts?.activeOnly ?? false],
    queryFn:  (): Promise<FinanceConcept[]> => window.api.companyFinance.concepts.list(opts),
    staleTime: 60_000
  })
}

export function useCreateCompanyFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceConceptInput) => window.api.companyFinance.concepts.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['company-finance-concepts'] })
  })
}

export function useUpdateCompanyFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceConceptInput> & { is_active?: number } }) =>
      window.api.companyFinance.concepts.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['company-finance-movements'] })
    }
  })
}

export function useDeleteCompanyFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.companyFinance.concepts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['company-finance-movements'] })
    }
  })
}

// ── Movements ─────────────────────────────────────────────────────────────────

export function useCompanyFinanceMovements(month: number, year: number) {
  return useQuery({
    queryKey: ['company-finance-movements', month, year],
    queryFn:  (): Promise<FinanceMovement[]> => window.api.companyFinance.movements.list(month, year),
    staleTime: 30_000
  })
}

/** Movimientos pendientes/vencidos de TODOS los períodos, para "Próximos pagos" y alertas. */
export function useUpcomingCompanyFinanceMovements() {
  return useQuery({
    queryKey: ['company-finance-movements-upcoming'],
    queryFn:  (): Promise<FinanceMovement[]> => window.api.companyFinance.movements.listUpcoming(),
    staleTime: 30_000
  })
}

/** Helper para invalidar todas las queries de movimientos (mes actual + próximos pagos + resumen). */
function invalidateCompanyFinanceMovements(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['company-finance-movements'] })
  qc.invalidateQueries({ queryKey: ['company-finance-movements-upcoming'] })
  qc.invalidateQueries({ queryKey: ['company-finance-summary'] })
}

export function useCreateCompanyFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceMovementInput) => window.api.companyFinance.movements.create(data),
    onSuccess:  () => invalidateCompanyFinanceMovements(qc)
  })
}

export function useUpdateCompanyFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceMovementInput> }) =>
      window.api.companyFinance.movements.update(id, data),
    onSuccess: () => invalidateCompanyFinanceMovements(qc)
  })
}

/** Edición rápida en línea desde la tabla principal (optimista). */
export function useQuickUpdateCompanyFinanceMovement() {
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
    }) => window.api.companyFinance.movements.quickUpdate(id, data),
    onSuccess: () => invalidateCompanyFinanceMovements(qc)
  })
}

export function useDeleteCompanyFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.companyFinance.movements.delete(id),
    onSuccess: () => invalidateCompanyFinanceMovements(qc)
  })
}

export function useGenerateCompanyFinanceMovementsForMonth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      window.api.companyFinance.movements.generateForMonth(month, year),
    onSuccess: () => invalidateCompanyFinanceMovements(qc)
  })
}

/**
 * "Crear nuevo mes desde mes anterior" (Fase 4): genera los movimientos del
 * período usando como estimación inicial el monto real (o estimado) del mismo
 * concepto en el mes inmediatamente anterior, en vez del monto fijo del
 * concepto — más útil para proyectar gastos variables con cifras realistas.
 */
export function useGenerateCompanyFinanceMovementsFromPreviousMonth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      window.api.companyFinance.movements.generateFromPreviousMonth(month, year),
    onSuccess: () => invalidateCompanyFinanceMovements(qc)
  })
}

// ── Registro de cargas — conceptos multi-carga (Opción C) ────────────────────

export function useCompanyMovementEntries(movementId: string | null | undefined) {
  return useQuery({
    queryKey: ['company-finance-movement-entries', movementId],
    queryFn:  (): Promise<FinanceMovementEntry[]> =>
      window.api.companyFinance.movementEntries.list(movementId as string),
    enabled:   !!movementId,
    staleTime: 10_000
  })
}

/** Invalida las entradas de un movimiento puntual + listas de movimientos/resumen (porque cambian montos/estado derivados). */
function invalidateCompanyMovementEntries(qc: ReturnType<typeof useQueryClient>, movementId: string) {
  qc.invalidateQueries({ queryKey: ['company-finance-movement-entries', movementId] })
  invalidateCompanyFinanceMovements(qc)
}

export function useAddCompanyMovementEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceMovementEntryInput) => window.api.companyFinance.movementEntries.add(data),
    onSuccess: (newEntry, variables) => {
      // Patch the cache directly instead of invalidating — avoids a stale refetch that
      // would race with any concurrent update mutations still in flight (e.g. amount/note
      // commits triggered by blur when the user clicks "+ Agregar").
      if (newEntry?.id) {
        qc.setQueryData<FinanceMovementEntry[]>(
          ['company-finance-movement-entries', variables.movement_id],
          (old = []) => old.some(e => e.id === newEntry.id) ? old : [...old, newEntry]
        )
      }
      invalidateCompanyFinanceMovements(qc)
    }
  })
}

export function useUpdateCompanyMovementEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; movementId: string; data: UpdateFinanceMovementEntryInput }) =>
      window.api.companyFinance.movementEntries.update(vars.id, vars.data),
    onSuccess:  (_entry, variables) => invalidateCompanyMovementEntries(qc, variables.movementId)
  })
}

export function useRemoveCompanyMovementEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; movementId: string }) => window.api.companyFinance.movementEntries.remove(id),
    onSuccess:  (_void, variables) => invalidateCompanyMovementEntries(qc, variables.movementId)
  })
}

// ── Resumen / dashboard ───────────────────────────────────────────────────────

export function useCompanyFinanceMonthSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['company-finance-summary', month, year],
    queryFn:  (): Promise<FinanceMonthSummary> => window.api.companyFinance.summary.get(month, year),
    staleTime: 30_000
  })
}

// ── Notas y comparador con IA del mes (Dashboard) ─────────────────────────────

export function useCompanyFinanceMonthInsight(month: number, year: number) {
  return useQuery({
    queryKey: ['company-finance-month-insight', month, year],
    queryFn:  (): Promise<FinanceMonthInsight | null> => window.api.companyFinance.insights.get(month, year),
    staleTime: 30_000
  })
}

export function useSaveCompanyFinanceMonthNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year, notes }: { month: number; year: number; notes: string }): Promise<FinanceMonthInsight> =>
      window.api.companyFinance.insights.saveNotes(month, year, notes),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['company-finance-month-insight', vars.month, vars.year] })
  })
}

export function useGenerateCompanyFinanceMonthAnalysis() {
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }): Promise<string> =>
      window.api.companyFinance.insights.generateAnalysis(month, year)
  })
}

export function useSaveCompanyFinanceMonthAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year, analysis }: { month: number; year: number; analysis: string }): Promise<FinanceMonthInsight> =>
      window.api.companyFinance.insights.saveAnalysis(month, year, analysis),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['company-finance-month-insight', vars.month, vars.year] })
  })
}

// ── Visualización / análisis (Fase 3) ─────────────────────────────────────────

export function useCompanyFinanceCategoryBreakdown(month: number, year: number) {
  return useQuery({
    queryKey: ['company-finance-analytics-category-breakdown', month, year],
    queryFn:  (): Promise<FinanceCategoryBreakdownItem[]> => window.api.companyFinance.analytics.categoryBreakdown(month, year),
    staleTime: 30_000
  })
}

export function useCompanyFinanceHistory(month: number, year: number, monthsBack: number = FINANCE_HISTORY_MONTHS) {
  return useQuery({
    queryKey: ['company-finance-analytics-history', month, year, monthsBack],
    queryFn:  (): Promise<FinanceHistoryEntry[]> => window.api.companyFinance.analytics.history(month, year, monthsBack),
    staleTime: 30_000
  })
}

export function useCompanyFinanceTopConcepts(month: number, year: number, limit?: number) {
  return useQuery({
    queryKey: ['company-finance-analytics-top-concepts', month, year, limit],
    queryFn:  (): Promise<FinanceRankingConcept[]> => window.api.companyFinance.analytics.topConcepts(month, year, limit),
    staleTime: 30_000
  })
}

export function useCompanyFinanceTopIncreases(month: number, year: number, limit?: number) {
  return useQuery({
    queryKey: ['company-finance-analytics-top-increases', month, year, limit],
    queryFn:  (): Promise<FinanceRankingIncrease[]> => window.api.companyFinance.analytics.topIncreases(month, year, limit),
    staleTime: 30_000
  })
}

// ── Importación con preview (Fase 5) ─────────────────────────────────────────

/** Abre el selector de archivo, parsea Excel/CSV y devuelve la previsualización (o null si se canceló). */
export function useCompanyFinanceImportSelectFile() {
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }): Promise<FinanceImportPreviewResult | null> =>
      window.api.companyFinance.import.selectFile(month, year)
  })
}

/**
 * Modo "pegar datos": le pasa texto libre a la IA (tabla de Excel pegada, lista
 * de WhatsApp, notas sueltas) para que lo interprete y devuelva la MISMA forma
 * de previsualización que `useCompanyFinanceImportSelectFile`.
 */
export function useCompanyFinanceImportParseText() {
  return useMutation({
    mutationFn: ({ rawText, month, year }: { rawText: string; month: number; year: number }): Promise<FinanceImportPreviewResult> =>
      window.api.companyFinance.import.parseText(rawText, month, year)
  })
}

export function useConfirmCompanyFinanceImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ items, month, year }: { items: FinanceImportConfirmItem[]; month: number; year: number }): Promise<FinanceImportResult> =>
      window.api.companyFinance.import.confirm(items, month, year),
    onSuccess: () => invalidateCompanyFinanceMovements(qc)
  })
}

// ── Exportación: Excel / CSV / PDF resumen (Fase 5) ──────────────────────────

export function useExportCompanyFinanceMovements() {
  return useMutation({
    mutationFn: ({ month, year, format }: { month: number; year: number; format: 'xlsx' | 'csv' }): Promise<{ filePath: string } | null> =>
      window.api.companyFinance.export.movements(month, year, format)
  })
}

/** Exporta solo los movimientos seleccionados a mano en la tabla (acciones en lote). */
export function useExportCompanyFinanceMovementsSelection() {
  return useMutation({
    mutationFn: ({ movements, format }: { movements: FinanceMovement[]; format: 'xlsx' | 'csv' }): Promise<{ filePath: string } | null> =>
      window.api.companyFinance.export.selection(movements, format)
  })
}

export function useExportCompanyFinanceSummaryPdf() {
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }): Promise<{ filePath: string } | null> =>
      window.api.companyFinance.export.summaryPdf(month, year)
  })
}

// ── Bloqueo por PIN (Fase 5) ─────────────────────────────────────────────────

export function useCompanyFinanceSecurityStatus() {
  return useQuery({
    queryKey: ['company-finance-security-status'],
    queryFn:  (): Promise<FinanceSecurityStatus> => window.api.companyFinance.security.status(),
    staleTime: 0
  })
}

export function useSetupCompanyFinancePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pin: string): Promise<FinanceSecurityStatus> => window.api.companyFinance.security.setup(pin),
    onSuccess: (status) => qc.setQueryData(['company-finance-security-status'], status)
  })
}

export function useVerifyCompanyFinancePin() {
  return useMutation({
    mutationFn: (pin: string): Promise<boolean> => window.api.companyFinance.security.verify(pin)
  })
}

export function useDisableCompanyFinancePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (currentPin: string): Promise<boolean> => window.api.companyFinance.security.disable(currentPin),
    onSuccess: (ok) => { if (ok) qc.invalidateQueries({ queryKey: ['company-finance-security-status'] }) }
  })
}

export function useChangeCompanyFinancePin() {
  return useMutation({
    mutationFn: ({ currentPin, newPin }: { currentPin: string; newPin: string }): Promise<boolean> =>
      window.api.companyFinance.security.change(currentPin, newPin)
  })
}
