import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Contact, CreateContactInput } from '@shared/types'

const KEY = ['contacts']

export function useContacts() {
  return useQuery<Contact[]>({ queryKey: KEY, queryFn: () => window.api.contacts.list() })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateContactInput) => window.api.contacts.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contact> }) =>
      window.api.contacts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.contacts.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })
}
