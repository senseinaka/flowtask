import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  Quote,
  QuoteActivity,
  QuoteCompany,
  QuoteContact,
  QuoteKPIs,
  CreateQuoteInput,
  UpdateQuoteInput,
  CreateQuoteCompanyInput,
  CreateQuoteContactInput,
  AddQuoteActivityInput
} from '@shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function invalidateQuotes(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: ['quotes'] })
  qc.invalidateQueries({ queryKey: ['quotes-kpis'] })
}

// ── Companies ─────────────────────────────────────────────────────────────────

export function useQuoteCompanies() {
  return useQuery({
    queryKey: ['quote-companies'],
    queryFn: (): Promise<QuoteCompany[]> => window.api.quotes.companies.list(),
    staleTime: 60_000
  })
}

export function useCreateQuoteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateQuoteCompanyInput): Promise<QuoteCompany> =>
      window.api.quotes.companies.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote-companies'] })
      qc.invalidateQueries({ queryKey: ['quote-contacts'] })
    }
  })
}

export function useUpdateQuoteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateQuoteCompanyInput> }): Promise<QuoteCompany> =>
      window.api.quotes.companies.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-companies'] })
  })
}

export function useDeleteQuoteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<void> => window.api.quotes.companies.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quote-companies'] })
      qc.invalidateQueries({ queryKey: ['quote-contacts'] })
    }
  })
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export function useQuoteContacts(companyId?: string) {
  return useQuery({
    queryKey: ['quote-contacts', companyId ?? 'all'],
    queryFn: (): Promise<QuoteContact[]> => window.api.quotes.contacts.list(companyId),
    staleTime: 60_000
  })
}

export function useCreateQuoteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateQuoteContactInput): Promise<QuoteContact> =>
      window.api.quotes.contacts.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-contacts'] })
  })
}

export function useUpdateQuoteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data
    }: {
      id: string
      data: Partial<Omit<CreateQuoteContactInput, 'company_id'>>
    }): Promise<QuoteContact> => window.api.quotes.contacts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-contacts'] })
  })
}

export function useDeleteQuoteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<void> => window.api.quotes.contacts.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-contacts'] })
  })
}

// ── Quotes ────────────────────────────────────────────────────────────────────

export interface QuoteListFilters {
  status?: string
  priority?: string
  assigned_to?: string
}

export function useQuotes(filters?: QuoteListFilters) {
  return useQuery({
    queryKey: ['quotes', filters ?? {}],
    queryFn: (): Promise<Quote[]> => window.api.quotes.list(filters),
    staleTime: 30_000
  })
}

export function useQuote(id: string | null | undefined) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: (): Promise<Quote | null> => window.api.quotes.get(id as string),
    enabled: !!id,
    staleTime: 15_000
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ data, userId }: { data: CreateQuoteInput; userId: string }): Promise<Quote> =>
      window.api.quotes.create(data, userId),
    onSuccess: () => invalidateQuotes(qc)
  })
}

export function useUpdateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
      userId
    }: {
      id: string
      data: UpdateQuoteInput
      userId: string
    }): Promise<Quote> => window.api.quotes.update(id, data, userId),
    onSuccess: (_, { id }) => {
      invalidateQuotes(qc)
      qc.invalidateQueries({ queryKey: ['quote', id] })
      qc.invalidateQueries({ queryKey: ['quote-activities', id] })
    }
  })
}

export function useDeleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<void> => window.api.quotes.delete(id),
    onSuccess: () => invalidateQuotes(qc)
  })
}

// ── Activities ────────────────────────────────────────────────────────────────

export function useQuoteActivities(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: ['quote-activities', quoteId],
    queryFn: (): Promise<QuoteActivity[]> => window.api.quotes.activities.list(quoteId as string),
    enabled: !!quoteId,
    staleTime: 10_000
  })
}

export function useAddQuoteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddQuoteActivityInput): Promise<QuoteActivity> =>
      window.api.quotes.activities.add(data),
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: ['quote-activities', data.quote_id] })
    }
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export function useQuoteKPIs() {
  return useQuery({
    queryKey: ['quotes-kpis'],
    queryFn: (): Promise<QuoteKPIs> => window.api.quotes.kpis.get(),
    staleTime: 60_000
  })
}
