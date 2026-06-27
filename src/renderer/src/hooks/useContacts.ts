import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Contact, CreateContactInput, AgendaGrupo, CreateAgendaGrupoInput } from '@shared/types'

const KEY        = ['contacts']
const GRUPOS_KEY = ['agenda-grupos']

// ── Contactos ─────────────────────────────────────────────────────────────────

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: GRUPOS_KEY }) }
  })
}

// ── Grupos ────────────────────────────────────────────────────────────────────

export function useAgendaGrupos() {
  return useQuery<AgendaGrupo[]>({ queryKey: GRUPOS_KEY, queryFn: () => window.api.agenda.grupos.list() })
}

export function useCreateGrupo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAgendaGrupoInput) => window.api.agenda.grupos.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: GRUPOS_KEY })
  })
}

export function useUpdateGrupo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AgendaGrupo> }) =>
      window.api.agenda.grupos.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: GRUPOS_KEY })
  })
}

export function useDeleteGrupo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.agenda.grupos.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: GRUPOS_KEY })
  })
}

export function useGrupoMembers(grupoId: string | null) {
  return useQuery<Contact[]>({
    queryKey: ['agenda-grupo-members', grupoId],
    queryFn: () => window.api.agenda.grupos.members(grupoId!),
    enabled: !!grupoId
  })
}

export function useAddGrupoMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ grupoId, contactId }: { grupoId: string; contactId: string }) =>
      window.api.agenda.grupos.addMember(grupoId, contactId),
    onSuccess: (_r, { grupoId }) => {
      qc.invalidateQueries({ queryKey: ['agenda-grupo-members', grupoId] })
      qc.invalidateQueries({ queryKey: GRUPOS_KEY })
    }
  })
}

export function useRemoveGrupoMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ grupoId, contactId }: { grupoId: string; contactId: string }) =>
      window.api.agenda.grupos.removeMember(grupoId, contactId),
    onSuccess: (_r, { grupoId }) => {
      qc.invalidateQueries({ queryKey: ['agenda-grupo-members', grupoId] })
      qc.invalidateQueries({ queryKey: GRUPOS_KEY })
    }
  })
}

export function useContactGrupos(contactId: string | null) {
  return useQuery<AgendaGrupo[]>({
    queryKey: ['contact-grupos', contactId],
    queryFn: () => window.api.agenda.contactos.grupos(contactId!),
    enabled: !!contactId
  })
}
