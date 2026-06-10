import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CreateComexImportInput, CreateComexSupplierInput,
  CreateComexDocumentInput,
  ComexImport, ComexSupplier, ComexCostItem, ComexDocument, ComexInalCert,
  UpsertComexCustomsInput, CreateComexCostInput,
  ComexSupplierContact, CreateComexSupplierContactInput,
  ComexSupplierBankAccount, CreateComexSupplierBankAccountInput,
  ComexFreightOperator, CreateComexFreightOperatorInput,
  ComexFreightOperatorContact, CreateComexFreightOperatorContactInput,
  ComexImportTributo, CreateComexImportTributoInput,
  ComexImportExtraCost, CreateComexImportExtraCostInput,
  ComexProforma, CreateComexProformaInput,
  ComexBrand, CreateComexBrandInput,
  ImportOrderPlanning, CreateImportOrderPlanningInput, ImportOrderPlanningMilestone
} from '@shared/types'

// ── Suppliers ─────────────────────────────────────────────────────────────────

export function useComexSuppliers() {
  return useQuery({
    queryKey: ['comex-suppliers'],
    queryFn: () => window.api.comex.suppliers.list()
  })
}

export function useCreateComexSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexSupplierInput) => window.api.comex.suppliers.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-suppliers'] }) }
  })
}

export function useUpdateComexSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ComexSupplier> }) =>
      window.api.comex.suppliers.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ['comex-suppliers'] })
      qc.invalidateQueries({ queryKey: ['comex-supplier', id] })
    }
  })
}

export function useDeleteComexSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.suppliers.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-suppliers'] }) }
  })
}

export function useComexSupplier(id: string | null) {
  return useQuery({
    queryKey: ['comex-supplier', id],
    queryFn: () => window.api.comex.suppliers.get(id!),
    enabled: !!id
  })
}

// ── Brands (Programación Pedidos) ──────────────────────────────────────────────

export function useComexBrands() {
  return useQuery({
    queryKey: ['comex-brands'],
    queryFn: () => window.api.comex.brands.list()
  })
}

export function useComexBrand(id: string | null) {
  return useQuery({
    queryKey: ['comex-brand', id],
    queryFn: () => window.api.comex.brands.get(id!),
    enabled: !!id
  })
}

export function useCreateComexBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexBrandInput) => window.api.comex.brands.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-brands'] }) }
  })
}

export function useUpdateComexBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ComexBrand> }) =>
      window.api.comex.brands.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ['comex-brands'] })
      qc.invalidateQueries({ queryKey: ['comex-brand', id] })
    }
  })
}

export function useDeleteComexBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.brands.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-brands'] }) }
  })
}

// ── Programaciones de pedido (Programación Pedidos) ─────────────────────────────

export function useComexPlannings(filters?: { brandId?: string; status?: string }) {
  return useQuery({
    queryKey: ['comex-plannings', filters],
    queryFn: () => window.api.comex.plannings.list(filters)
  })
}

export function useComexPlanning(id: string | null) {
  return useQuery({
    queryKey: ['comex-planning', id],
    queryFn: () => window.api.comex.plannings.get(id!),
    enabled: !!id
  })
}

export function useCreateComexPlanning() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateImportOrderPlanningInput) => window.api.comex.plannings.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-plannings'] }) }
  })
}

export function useUpdateComexPlanning() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ImportOrderPlanning> }) =>
      window.api.comex.plannings.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ['comex-plannings'] })
      qc.invalidateQueries({ queryKey: ['comex-planning', id] })
    }
  })
}

export function useDeleteComexPlanning() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.plannings.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-plannings'] }) }
  })
}

export function useRecalculateComexPlanning() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.plannings.recalculate(id),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ['comex-plannings'] })
      qc.invalidateQueries({ queryKey: ['comex-planning', id] })
    }
  })
}

export function useUpdatePlanningMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; planningId: string; data: Partial<ImportOrderPlanningMilestone> }) =>
      window.api.comex.planningMilestones.update(id, data),
    onSuccess: (_r, { planningId }) => {
      qc.invalidateQueries({ queryKey: ['comex-planning', planningId] })
      qc.invalidateQueries({ queryKey: ['comex-plannings'] })
    }
  })
}

// ── Supplier Contacts ─────────────────────────────────────────────────────────

export function useComexSupplierContacts(supplierId: string | null) {
  return useQuery({
    queryKey: ['comex-supplier-contacts', supplierId],
    queryFn: () => window.api.comex.supplierContacts.list(supplierId!),
    enabled: !!supplierId
  })
}

export function useCreateComexSupplierContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexSupplierContactInput) =>
      window.api.comex.supplierContacts.create(input),
    onSuccess: (_r, { supplier_id }) => {
      qc.invalidateQueries({ queryKey: ['comex-supplier-contacts', supplier_id] })
    }
  })
}

export function useUpdateComexSupplierContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, supplierId, data }: { id: string; supplierId: string; data: Partial<ComexSupplierContact> }) =>
      window.api.comex.supplierContacts.update(id, data),
    onSuccess: (_r, { supplierId }) => {
      qc.invalidateQueries({ queryKey: ['comex-supplier-contacts', supplierId] })
    }
  })
}

export function useDeleteComexSupplierContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, supplierId }: { id: string; supplierId: string }) =>
      window.api.comex.supplierContacts.delete(id),
    onSuccess: (_r, { supplierId }) => {
      qc.invalidateQueries({ queryKey: ['comex-supplier-contacts', supplierId] })
    }
  })
}

// ── Supplier Bank Accounts ────────────────────────────────────────────────────

export function useComexSupplierBanks(supplierId: string | null) {
  return useQuery({
    queryKey: ['comex-supplier-banks', supplierId],
    queryFn: () => window.api.comex.supplierBanks.list(supplierId!),
    enabled: !!supplierId
  })
}

export function useCreateComexSupplierBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexSupplierBankAccountInput) =>
      window.api.comex.supplierBanks.create(input),
    onSuccess: (_r, { supplier_id }) => {
      qc.invalidateQueries({ queryKey: ['comex-supplier-banks', supplier_id] })
    }
  })
}

export function useUpdateComexSupplierBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, supplierId, data }: { id: string; supplierId: string; data: Partial<ComexSupplierBankAccount> }) =>
      window.api.comex.supplierBanks.update(id, data),
    onSuccess: (_r, { supplierId }) => {
      qc.invalidateQueries({ queryKey: ['comex-supplier-banks', supplierId] })
    }
  })
}

export function useDeleteComexSupplierBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, supplierId }: { id: string; supplierId: string }) =>
      window.api.comex.supplierBanks.delete(id),
    onSuccess: (_r, { supplierId }) => {
      qc.invalidateQueries({ queryKey: ['comex-supplier-banks', supplierId] })
    }
  })
}

// ── Imports ───────────────────────────────────────────────────────────────────

export function useComexImports(status?: string) {
  return useQuery({
    queryKey: ['comex-imports', status ?? 'all'],
    queryFn: () => window.api.comex.imports.list(status)
  })
}

export function useComexImport(id: string | null) {
  return useQuery({
    queryKey: ['comex-import', id],
    queryFn: () => window.api.comex.imports.get(id!),
    enabled: !!id
  })
}

export function useCreateComexImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexImportInput) => window.api.comex.imports.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-imports'] }) }
  })
}

export function useUpdateComexImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ComexImport> }) =>
      window.api.comex.imports.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ['comex-imports'] })
      qc.invalidateQueries({ queryKey: ['comex-import', id] })
    }
  })
}

export function useDeleteComexImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.imports.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-imports'] }) }
  })
}

// ── Sub-entities (items, documents, quotes, payments) ─────────────────────────

export function useComexItems(importId: string | null) {
  return useQuery({
    queryKey: ['comex-items', importId],
    queryFn: () => window.api.comex.items.list(importId!),
    enabled: !!importId
  })
}

export function useComexDocuments(importId: string | null) {
  return useQuery({
    queryKey: ['comex-documents', importId],
    queryFn: () => window.api.comex.documents.list(importId!),
    enabled: !!importId
  })
}

export function useCreateComexDocument(importId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexDocumentInput) => window.api.comex.documents.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-documents', importId] }) }
  })
}

export function useUpdateComexDocument(importId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ComexDocument> }) =>
      window.api.comex.documents.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-documents', importId] }) }
  })
}

export function useDeleteComexDocument(importId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.documents.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-documents', importId] }) }
  })
}

export function useUploadComexDocument(importId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ docId, filePath, folderId, importTitle }: {
      docId: string; filePath: string; folderId: string | null; importTitle: string
    }) => window.api.comex.documents.upload(docId, filePath, importId, folderId, importTitle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comex-documents', importId] })
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
    }
  })
}

export function useUploadNewComexDocument(importId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ filePath, folderId, importTitle }: {
      filePath: string; folderId: string | null; importTitle: string
    }) => window.api.comex.documents.uploadNew(filePath, importId, folderId, importTitle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comex-documents', importId] })
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
    }
  })
}

export function useComexQuotes(importId: string | null) {
  return useQuery({
    queryKey: ['comex-quotes', importId],
    queryFn: () => window.api.comex.quotes.list(importId!),
    enabled: !!importId
  })
}

export function useComexPayments(importId: string | null) {
  return useQuery({
    queryKey: ['comex-payments', importId],
    queryFn: () => window.api.comex.payments.list(importId!),
    enabled: !!importId
  })
}

// ── Customs (despacho / aduana) ───────────────────────────────────────────────

export function useComexCustoms(importId: string | null) {
  return useQuery({
    queryKey: ['comex-customs', importId],
    queryFn: () => window.api.comex.customs.get(importId!),
    enabled: !!importId
  })
}

export function useUpsertComexCustoms() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ importId, data }: { importId: string; data: Partial<UpsertComexCustomsInput> }) =>
      window.api.comex.customs.upsert(importId, data),
    onSuccess: (_r, { importId }) => {
      qc.invalidateQueries({ queryKey: ['comex-customs', importId] })
    }
  })
}

// ── Cost Items ────────────────────────────────────────────────────────────────

export function useComexCosts(importId: string | null) {
  return useQuery({
    queryKey: ['comex-costs', importId],
    queryFn: () => window.api.comex.costs.list(importId!),
    enabled: !!importId
  })
}

export function useCreateComexCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexCostInput) => window.api.comex.costs.create(input),
    onSuccess: (_r, { import_id }) => {
      qc.invalidateQueries({ queryKey: ['comex-costs', import_id] })
    }
  })
}

export function useUpdateComexCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId, data }: { id: string; importId: string; data: Partial<ComexCostItem> }) =>
      window.api.comex.costs.update(id, data),
    onSuccess: (_r, { importId }) => {
      qc.invalidateQueries({ queryKey: ['comex-costs', importId] })
    }
  })
}

export function useDeleteComexCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId }: { id: string; importId: string }) =>
      window.api.comex.costs.delete(id),
    onSuccess: (_r, { importId }) => {
      qc.invalidateQueries({ queryKey: ['comex-costs', importId] })
    }
  })
}

// ── Proformas ─────────────────────────────────────────────────────────────────

export function useComexProformas(importId: string | null) {
  return useQuery({
    queryKey: ['comex-proformas', importId, 'proforma'],
    queryFn:  () => window.api.comex.proformas.list(importId!, 'proforma'),
    enabled:  !!importId
  })
}

export function useComexFacturasComerciales(importId: string | null) {
  return useQuery({
    queryKey: ['comex-proformas', importId, 'factura'],
    queryFn:  () => window.api.comex.proformas.list(importId!, 'factura'),
    enabled:  !!importId
  })
}

export function useCreateComexProforma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexProformaInput) => window.api.comex.proformas.create(input),
    onSuccess: (_r, { import_id, tipo }) => {
      qc.invalidateQueries({ queryKey: ['comex-proformas', import_id, tipo ?? 'proforma'] })
    }
  })
}

export function useUpdateComexProforma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId, tipo, data }: { id: string; importId: string; tipo?: 'proforma' | 'factura'; data: Partial<ComexProforma> }) =>
      window.api.comex.proformas.update(id, data),
    onSuccess: (_r, { importId, tipo }) => {
      qc.invalidateQueries({ queryKey: ['comex-proformas', importId, tipo ?? 'proforma'] })
    }
  })
}

export function useDeleteComexProforma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId, tipo }: { id: string; importId: string; tipo?: 'proforma' | 'factura' }) =>
      window.api.comex.proformas.delete(id),
    onSuccess: (_r, { importId, tipo }) => {
      qc.invalidateQueries({ queryKey: ['comex-proformas', importId, tipo ?? 'proforma'] })
    }
  })
}

export function useUploadProforma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ proformaId, filePath, importId, tipo }: { proformaId: string; filePath: string; importId: string; tipo?: 'proforma' | 'factura' }) =>
      window.api.comex.proformas.upload(proformaId, filePath),
    onSuccess: (_r, { importId, tipo }) => {
      qc.invalidateQueries({ queryKey: ['comex-proformas', importId, tipo ?? 'proforma'] })
    }
  })
}

// ── Extra costs ───────────────────────────────────────────────────────────────

export function useComexExtraCosts(importId: string | null) {
  return useQuery({
    queryKey: ['comex-extra-costs', importId],
    queryFn:  () => window.api.comex.extraCosts.list(importId!),
    enabled:  !!importId
  })
}

export function useCreateComexExtraCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexImportExtraCostInput) => window.api.comex.extraCosts.create(input),
    onSuccess: (_r, { import_id }) => qc.invalidateQueries({ queryKey: ['comex-extra-costs', import_id] })
  })
}

export function useUpdateComexExtraCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId, data }: { id: string; importId: string; data: Partial<ComexImportExtraCost> }) =>
      window.api.comex.extraCosts.update(id, data),
    onSuccess: (_r, { importId }) => qc.invalidateQueries({ queryKey: ['comex-extra-costs', importId] })
  })
}

export function useDeleteComexExtraCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId }: { id: string; importId: string }) =>
      window.api.comex.extraCosts.delete(id),
    onSuccess: (_r, { importId }) => qc.invalidateQueries({ queryKey: ['comex-extra-costs', importId] })
  })
}

export function useUploadExtraCostInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ costId, filePath, importId }: { costId: string; filePath: string; importId: string }) =>
      window.api.comex.extraCosts.uploadInvoice(costId, filePath),
    onSuccess: (_r, { importId }) => qc.invalidateQueries({ queryKey: ['comex-extra-costs', importId] })
  })
}

// ── Tributos ──────────────────────────────────────────────────────────────────

export function useComexTributos(importId: string | null) {
  return useQuery({
    queryKey: ['comex-tributos', importId],
    queryFn:  () => window.api.comex.tributos.list(importId!),
    enabled:  !!importId
  })
}

export function useCreateComexTributo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexImportTributoInput) => window.api.comex.tributos.create(input),
    onSuccess: (_r, { import_id }) => qc.invalidateQueries({ queryKey: ['comex-tributos', import_id] })
  })
}

export function useUpdateComexTributo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId, data }: { id: string; importId: string; data: Partial<ComexImportTributo> }) =>
      window.api.comex.tributos.update(id, data),
    onSuccess: (_r, { importId }) => qc.invalidateQueries({ queryKey: ['comex-tributos', importId] })
  })
}

export function useDeleteComexTributo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId }: { id: string; importId: string }) =>
      window.api.comex.tributos.delete(id),
    onSuccess: (_r, { importId }) => qc.invalidateQueries({ queryKey: ['comex-tributos', importId] })
  })
}

export function useUpsertComexTributos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ importId, tributos }: {
      importId:  string
      tributos:  Omit<CreateComexImportTributoInput, 'import_id'>[]
    }) => window.api.comex.tributos.upsert(importId, tributos),
    onSuccess: (_r, { importId }) => qc.invalidateQueries({ queryKey: ['comex-tributos', importId] })
  })
}

// ── Despacho ──────────────────────────────────────────────────────────────────

export function useUploadDespacho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ importId, filePath }: { importId: string; filePath: string }) =>
      window.api.comex.despacho.upload(importId, filePath),
    onSuccess: (_r, { importId }) => {
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
    }
  })
}

export function useDeleteDespacho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (importId: string) => window.api.comex.despacho.delete(importId),
    onSuccess: (_r, importId) => {
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
    }
  })
}

// ── Freight Operators ─────────────────────────────────────────────────────────

export function useComexFreightOperators() {
  return useQuery({
    queryKey: ['comex-operators'],
    queryFn: () => window.api.comex.operators.list()
  })
}

export function useCreateComexFreightOperator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexFreightOperatorInput) => window.api.comex.operators.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-operators'] }) }
  })
}

export function useUpdateComexFreightOperator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ComexFreightOperator> }) =>
      window.api.comex.operators.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-operators'] }) }
  })
}

export function useDeleteComexFreightOperator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.operators.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-operators'] }) }
  })
}

// ── Logo mutations ────────────────────────────────────────────────────────────

export function useUploadSupplierLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath: string }) =>
      window.api.comex.suppliers.uploadLogo(id, filePath),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: ['comex-suppliers'] })
      qc.invalidateQueries({ queryKey: ['comex-supplier', id] })
    }
  })
}

export function useDeleteSupplierLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.suppliers.deleteLogo(id),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ['comex-suppliers'] })
      qc.invalidateQueries({ queryKey: ['comex-supplier', id] })
    }
  })
}

export function useUploadOperatorLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath: string }) =>
      window.api.comex.operators.uploadLogo(id, filePath),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-operators'] }) }
  })
}

export function useDeleteOperatorLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.operators.deleteLogo(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comex-operators'] }) }
  })
}

// ── Operator Contacts ─────────────────────────────────────────────────────────

export function useComexOperatorContacts(operatorId: string | null) {
  return useQuery({
    queryKey: ['comex-operator-contacts', operatorId],
    queryFn: () => window.api.comex.operatorContacts.list(operatorId!),
    enabled: !!operatorId
  })
}

export function useCreateComexOperatorContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateComexFreightOperatorContactInput) =>
      window.api.comex.operatorContacts.create(input),
    onSuccess: (_r, { operator_id }) => {
      qc.invalidateQueries({ queryKey: ['comex-operator-contacts', operator_id] })
    }
  })
}

export function useUpdateComexOperatorContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, operatorId, data }: { id: string; operatorId: string; data: Partial<ComexFreightOperatorContact> }) =>
      window.api.comex.operatorContacts.update(id, data),
    onSuccess: (_r, { operatorId }) => {
      qc.invalidateQueries({ queryKey: ['comex-operator-contacts', operatorId] })
    }
  })
}

export function useDeleteComexOperatorContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, operatorId }: { id: string; operatorId: string }) =>
      window.api.comex.operatorContacts.delete(id),
    onSuccess: (_r, { operatorId }) => {
      qc.invalidateQueries({ queryKey: ['comex-operator-contacts', operatorId] })
    }
  })
}

// ── Quotes (with RFQ invalidation) ────────────────────────────────────────────

export function useComexQuotesByImport(importId: string | null) {
  return useQuery({
    queryKey: ['comex-quotes', importId],
    queryFn: () => window.api.comex.quotes.list(importId!),
    enabled: !!importId
  })
}

export function useUpdateComexQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId, data }: { id: string; importId: string; data: Parameters<typeof window.api.comex.quotes.update>[1] }) =>
      window.api.comex.quotes.update(id, data),
    onSuccess: (_r, { importId }) => {
      qc.invalidateQueries({ queryKey: ['comex-quotes', importId] })
    }
  })
}

export function useCreateComexQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof window.api.comex.quotes.create>[0]) =>
      window.api.comex.quotes.create(input),
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: ['comex-quotes', input.import_id] })
    }
  })
}

export function useDeleteComexQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importId }: { id: string; importId: string }) =>
      window.api.comex.quotes.delete(id),
    onSuccess: (_r, { importId }) => {
      qc.invalidateQueries({ queryKey: ['comex-quotes', importId] })
    }
  })
}

// ── INAL Certificates ─────────────────────────────────────────────────────────

export function useComexInalCerts(importId: string | null) {
  return useQuery({
    queryKey: ['comex-inal-certs', importId],
    queryFn: () => window.api.comex.inal.certs.list(importId!),
    enabled: !!importId
  })
}

export function useUploadInalCert(importId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      filePath, importTitle, importFolderId, certFolderId
    }: {
      filePath: string; importTitle: string
      importFolderId: string | null; certFolderId: string | null
    }) => window.api.comex.inal.certs.upload(filePath, importId, importTitle, importFolderId, certFolderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comex-inal-certs', importId] })
      qc.invalidateQueries({ queryKey: ['comex-import', importId] })
    }
  })
}

export function useDeleteInalCert(importId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.inal.certs.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comex-inal-certs', importId] })
    }
  })
}

// ── Gestores ──────────────────────────────────────────────────────────────────

export function useComexGestores() {
  return useQuery({ queryKey: ['comex-gestores'], queryFn: () => window.api.comex.gestores.list() })
}

export function useCreateComexGestor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: import('@shared/types').CreateComexGestorInput) => window.api.comex.gestores.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

export function useUpdateComexGestor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<import('@shared/types').ComexGestor> }) =>
      window.api.comex.gestores.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

export function useDeleteComexGestor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.gestores.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

export function useCreateComexGestorContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: import('@shared/types').CreateComexGestorContactInput) => window.api.comex.gestores.contacts.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

export function useUpdateComexGestorContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<import('@shared/types').ComexGestorContact> }) =>
      window.api.comex.gestores.contacts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

export function useDeleteComexGestorContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.gestores.contacts.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

// ── Despachantes ──────────────────────────────────────────────────────────────

export function useComexDespachantes() {
  return useQuery({ queryKey: ['comex-despachantes'], queryFn: () => window.api.comex.despachantes.list() })
}

export function useCreateComexDespachante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: import('@shared/types').CreateComexDespachanteInput) => window.api.comex.despachantes.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}

export function useUpdateComexDespachante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<import('@shared/types').ComexDespachante> }) =>
      window.api.comex.despachantes.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}

export function useDeleteComexDespachante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.despachantes.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}

// ── Logos ─────────────────────────────────────────────────────────────────────

export function useUploadGestorLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath: string }) => window.api.comex.gestores.uploadLogo(id, filePath),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

export function useDeleteGestorLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.gestores.deleteLogo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-gestores'] })
  })
}

export function useUploadDespachantelogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath: string }) => window.api.comex.despachantes.uploadLogo(id, filePath),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}

export function useDeleteDespachantelogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.despachantes.deleteLogo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}

export function useCreateComexDespachanteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: import('@shared/types').CreateComexDespachanteContactInput) => window.api.comex.despachantes.contacts.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}

export function useUpdateComexDespachanteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<import('@shared/types').ComexDespachanteContact> }) =>
      window.api.comex.despachantes.contacts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}

export function useDeleteComexDespachanteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.comex.despachantes.contacts.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comex-despachantes'] })
  })
}
