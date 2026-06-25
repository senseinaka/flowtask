import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type CatalogType = 'category' | 'area' | 'payment_method'

export interface CatalogEntry {
  id: string
  value: string
  label: string
  sort_order: number
}

export function useCatalog(type: CatalogType) {
  return useQuery<CatalogEntry[]>({
    queryKey: ['service-catalog', type],
    queryFn: () => window.api.catalog.list(type),
    staleTime: 30_000,
  })
}

export function useUpsertCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id?: string
      config_type: CatalogType
      value: string
      label: string
      sort_order?: number
    }) => window.api.catalog.upsert(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['service-catalog', vars.config_type] })
    },
  })
}

export function useDeleteCatalogEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: CatalogType }) =>
      window.api.catalog.delete(id).then(() => type),
    onSuccess: (type) => {
      qc.invalidateQueries({ queryKey: ['service-catalog', type] })
    },
  })
}
