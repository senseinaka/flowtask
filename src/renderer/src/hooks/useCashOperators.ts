import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CashOperator } from '@shared/types'

const OPERATORS_KEY = ['cajas', 'operators']

export function useCashOperators() {
  return useQuery<CashOperator[]>({
    queryKey: OPERATORS_KEY,
    queryFn: () => window.api.cajas.operators.list(),
    staleTime: 30_000,
  })
}

export function useCreateOperator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; pin: string }) => window.api.cajas.operators.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: OPERATORS_KEY }) },
  })
}

export function useUpdateOperator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; name?: string; pin?: string }) => window.api.cajas.operators.update(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: OPERATORS_KEY }) },
  })
}

export function useDeleteOperator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.cajas.operators.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: OPERATORS_KEY }) },
  })
}
