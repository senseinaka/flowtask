import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  KnowledgeEntry,
  KnowledgeGlobalSummary,
  KnowledgeListFilters
} from '@shared/types'

// ── Entries ───────────────────────────────────────────────────────────────────

export function useKnowledgeEntries(filters?: KnowledgeListFilters) {
  return useQuery({
    queryKey: ['knowledge', filters ?? {}],
    queryFn: (): Promise<KnowledgeEntry[]> => window.api.knowledge.entries.list(filters),
    staleTime: 30_000
  })
}

export function useKnowledgeEntry(id: string | null) {
  return useQuery({
    queryKey: ['knowledge-entry', id],
    queryFn: (): Promise<KnowledgeEntry | null> => window.api.knowledge.entries.get(id!),
    enabled: !!id,
    staleTime: 30_000
  })
}

export function useKnowledgeTopics() {
  return useQuery({
    queryKey: ['knowledge-topics'],
    queryFn: (): Promise<string[]> => window.api.knowledge.entries.topics(),
    staleTime: 60_000
  })
}

export function useCreateKnowledgeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      data,
      userId
    }: {
      data: { title?: string; content_type: string; body?: string; topic?: string; tags?: string[]; source?: string }
      userId: string
    }): Promise<KnowledgeEntry> => window.api.knowledge.entries.create(data, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge'] })
      qc.invalidateQueries({ queryKey: ['knowledge-topics'] })
    }
  })
}

export function useUpdateKnowledgeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KnowledgeEntry> }): Promise<KnowledgeEntry> =>
      window.api.knowledge.entries.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['knowledge'] })
      qc.setQueryData(['knowledge-entry', updated.id], updated)
    }
  })
}

export function useDeleteKnowledgeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<void> => window.api.knowledge.entries.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge'] })
      qc.invalidateQueries({ queryKey: ['knowledge-topics'] })
    }
  })
}

export function useSummarizeKnowledgeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<KnowledgeEntry> =>
      window.api.knowledge.entries.summarize(id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['knowledge'] })
      qc.setQueryData(['knowledge-entry', updated.id], updated)
    }
  })
}

export function useUploadKnowledgeFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath: string }): Promise<KnowledgeEntry> =>
      window.api.knowledge.entries.uploadFile(id, filePath),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['knowledge'] })
      qc.setQueryData(['knowledge-entry', updated.id], updated)
    }
  })
}

// ── Global Summaries ──────────────────────────────────────────────────────────

export function useKnowledgeGlobalSummaries() {
  return useQuery({
    queryKey: ['knowledge-summaries'],
    queryFn: (): Promise<KnowledgeGlobalSummary[]> => window.api.knowledge.summaries.list(),
    staleTime: 30_000
  })
}

export function useGenerateKnowledgeGlobalSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      topic,
      userId
    }: {
      topic: string | null
      userId: string
    }): Promise<KnowledgeGlobalSummary> => window.api.knowledge.summaries.generate(topic, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-summaries'] })
    }
  })
}

export function useDeleteKnowledgeGlobalSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<void> => window.api.knowledge.summaries.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge-summaries'] })
    }
  })
}
