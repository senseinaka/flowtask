import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ExpiryItem, ExpiryUrgency,
  CreateExpiryItemInput, CreateExpiryAlertInput
} from '@shared/types'
import { EXPIRY_URGENCY_COLORS } from '@shared/types'
import dayjs from 'dayjs'

// ── Urgency helper ────────────────────────────────────────────────────────────

export function getExpiryUrgency(item: ExpiryItem): ExpiryUrgency {
  if (item.is_renewed) return 'renewed'
  const now  = Date.now()
  const diff = item.expiry_date - now
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 0)   return 'overdue'
  if (days <= 7)  return 'urgent'
  if (days <= 30) return 'soon'
  if (days <= 90) return 'upcoming'
  return 'ok'
}

export function getUrgencyColor(urgency: ExpiryUrgency): string {
  return EXPIRY_URGENCY_COLORS[urgency]
}

export function getDaysUntil(expiry_date: number): number {
  return Math.ceil((expiry_date - Date.now()) / (1000 * 60 * 60 * 24))
}

export function formatExpiryDate(ts: number): string {
  return dayjs(ts).format('DD/MM/YYYY')
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useExpiryCategories() {
  return useQuery({
    queryKey: ['expiry-categories'],
    queryFn:  () => window.api.expiry.categories.list(),
    staleTime: 60_000
  })
}

export function useCreateExpiryCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; icon: string; color: string }) =>
      window.api.expiry.categories.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expiry-categories'] })
  })
}

export function useUpdateExpiryCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; icon?: string; color?: string } }) =>
      window.api.expiry.categories.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expiry-categories'] })
      qc.invalidateQueries({ queryKey: ['expiry-items'] })
    }
  })
}

export function useDeleteExpiryCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.expiry.categories.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expiry-categories'] })
      qc.invalidateQueries({ queryKey: ['expiry-items'] })
    }
  })
}

// ── Items ─────────────────────────────────────────────────────────────────────

export function useExpiryItems() {
  return useQuery({
    queryKey: ['expiry-items'],
    queryFn:  () => window.api.expiry.items.list(),
    staleTime: 30_000
  })
}

export function useCreateExpiryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateExpiryItemInput) => window.api.expiry.items.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expiry-items'] })
  })
}

export function useUpdateExpiryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateExpiryItemInput> }) =>
      window.api.expiry.items.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expiry-items'] })
  })
}

export function useRenewExpiryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, renewedDate }: { id: string; renewedDate: number }) =>
      window.api.expiry.items.renew(id, renewedDate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expiry-items'] })
  })
}

export function useUnrenewExpiryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.expiry.items.unrenew(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expiry-items'] })
  })
}

export function useDeleteExpiryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.expiry.items.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expiry-items'] })
  })
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export function useExpiryAlerts(itemId: string | null) {
  return useQuery({
    queryKey: ['expiry-alerts', itemId],
    queryFn:  () => window.api.expiry.alerts.listByItem(itemId!),
    enabled:  !!itemId,
    staleTime: 30_000
  })
}

export function useSetExpiryAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, alerts }: { itemId: string; alerts: CreateExpiryAlertInput[] }) =>
      window.api.expiry.alerts.setForItem(itemId, alerts),
    onSuccess: (_r, { itemId }) =>
      qc.invalidateQueries({ queryKey: ['expiry-alerts', itemId] })
  })
}
