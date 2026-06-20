import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  KnowledgeEntry,
  KnowledgeGlobalSummary,
  KnowledgeListFilters,
  KnowledgeSource
} from '@shared/types'

// ── Sources ───────────────────────────────────────────────────────────────────

export function useKnowledgeSources() {
  return useQuery({
    queryKey: ['knowledge-sources'],
    queryFn: (): Promise<KnowledgeSource[]> => window.api.knowledge.sources.list(),
    staleTime: 60_000
  })
}

export function useCreateKnowledgeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; icon: string; color: string }): Promise<KnowledgeSource> =>
      window.api.knowledge.sources.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-sources'] }) }
  })
}

export function useUpdateKnowledgeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, data
    }: {
      id: string
      data: { name?: string; icon?: string; color?: string }
    }): Promise<void> => window.api.knowledge.sources.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-sources'] }) }
  })
}

export function useDeleteKnowledgeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string): Promise<void> => window.api.knowledge.sources.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-sources'] }) }
  })
}

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
      data: { title?: string; content_type: string; body?: string; topic?: string; tags?: string[]; source?: string; entry_date?: number }
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
    mutationFn: ({
      id, data
    }: {
      id: string
      data: Omit<Partial<KnowledgeEntry>, 'tags'> & { tags?: string[]; entry_date?: number | null }
    }): Promise<KnowledgeEntry> =>
      window.api.knowledge.entries.update(id, data as Partial<KnowledgeEntry>),
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

export function useKnowledgeSearch(query: string) {
  return useQuery({
    queryKey: ['knowledge-search', query],
    queryFn: (): Promise<KnowledgeEntry[]> => window.api.knowledge.search(query),
    enabled: query.trim().length >= 2,
    staleTime: 15_000
  })
}

// ── Topic AI analysis ─────────────────────────────────────────────────────────

export function useTopicLatestSummary(topic: string | null) {
  return useQuery({
    queryKey: ['knowledge-topic-summary', topic],
    queryFn: (): Promise<KnowledgeGlobalSummary | null> =>
      window.api.knowledge.topic.latestSummary(topic!),
    enabled: !!topic,
    staleTime: 60_000
  })
}

export function useAnalyzeTopic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      topic,
      userId
    }: {
      topic: string
      userId: string
    }): Promise<KnowledgeGlobalSummary> => window.api.knowledge.topic.analyze(topic, userId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['knowledge-topic-summary', vars.topic] })
      qc.invalidateQueries({ queryKey: ['knowledge-summaries'] })
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
