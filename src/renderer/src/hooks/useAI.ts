import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AIOperation, ClaudeModelId, AIAnalysisResult } from '@shared/types'

// ── Configuración ─────────────────────────────────────────────────────────────

export function useAIConfigured() {
  return useQuery({
    queryKey: ['ai-configured'],
    queryFn:  () => window.api.ai.isConfigured(),
    staleTime: 30_000
  })
}

export function useAIModels() {
  return useQuery({
    queryKey: ['ai-models'],
    queryFn:  () => window.api.ai.getModels()
  })
}

export function useSaveAIApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (apiKey: string) => window.api.ai.saveApiKey(apiKey),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['ai-configured'] })
      qc.invalidateQueries({ queryKey: ['ai-models'] })
    }
  })
}

export function useSaveAIModels() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (models: Record<AIOperation, ClaudeModelId>) =>
      window.api.ai.saveModels(models),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ai-models'] })
  })
}

// ── Análisis de documentos ────────────────────────────────────────────────────

export function useAnalyzeDocument() {
  return useMutation({
    mutationFn: (params: {
      filePath:     string
      operation:    AIOperation
      extraContext?: string
    }): Promise<AIAnalysisResult> => window.api.ai.analyzeDocument(params)
  })
}

export function useAnalyzeComexDocument() {
  return useMutation({
    mutationFn: (params: {
      docId:             string
      operationOverride?: AIOperation
    }): Promise<AIAnalysisResult> => window.api.ai.analyzeComexDocument(params)
  })
}

export function useAnalyzeExtraCost() {
  return useMutation({
    mutationFn: (costId: string): Promise<AIAnalysisResult> =>
      window.api.ai.analyzeExtraCost(costId)
  })
}

export function useAnalyzeProforma() {
  return useMutation({
    mutationFn: (proformaId: string): Promise<AIAnalysisResult> =>
      window.api.ai.analyzeProforma(proformaId)
  })
}

export function useAnalyzeDespacho() {
  return useMutation({
    mutationFn: ({ importId, page = 1 }: { importId: string; page?: number }): Promise<AIAnalysisResult> =>
      window.api.ai.analyzeDespacho(importId, page)
  })
}

export function useAnalyzeBL() {
  return useMutation({
    mutationFn: (importId: string): Promise<AIAnalysisResult> =>
      window.api.ai.analyzeBL(importId)
  })
}

// ── Chat del dashboard ────────────────────────────────────────────────────────

export function useDashboardChat() {
  return useMutation({
    mutationFn: (params: {
      contextData: unknown
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }) => window.api.ai.dashboardChat(params)
  })
}
