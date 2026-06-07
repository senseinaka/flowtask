import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PersonalContactInfo } from '@shared/types'

// ── Datos personales de contacto ─────────────────────────────────────────────

export function usePersonalContact() {
  return useQuery({
    queryKey: ['personal-contact'],
    queryFn:  (): Promise<PersonalContactInfo> => window.api.settings.getPersonalContact(),
    staleTime: 30_000
  })
}

export function useSavePersonalContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<PersonalContactInfo>) => window.api.settings.savePersonalContact(data),
    onSuccess:  (data) => qc.setQueryData(['personal-contact'], data)
  })
}
