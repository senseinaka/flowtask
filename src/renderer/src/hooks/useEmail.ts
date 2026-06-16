import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateEmailAccountInput, EmailListFilters, SendEmailInput } from '@shared/types'

function invalidateEmail(qc: ReturnType<typeof useQueryClient>, accountId?: string): void {
  qc.invalidateQueries({ queryKey: ['email-messages'] })
  if (accountId) qc.invalidateQueries({ queryKey: ['email-unread', accountId] })
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function useEmailAccounts() {
  return useQuery({
    queryKey: ['email-accounts'],
    queryFn: () => window.api.email.accounts.list()
  })
}

export function useCreateEmailAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEmailAccountInput) => window.api.email.accounts.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-accounts'] })
  })
}

export function useUpdateEmailAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEmailAccountInput> }) =>
      window.api.email.accounts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-accounts'] })
  })
}

export function useDeleteEmailAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.email.accounts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-accounts'] })
      qc.invalidateQueries({ queryKey: ['email-messages'] })
    }
  })
}

// ── Test connection ───────────────────────────────────────────────────────────

export function useTestImapConnection() {
  return useMutation({
    mutationFn: ({
      host, port, secure, user, pass
    }: { host: string; port: number; secure: boolean; user: string; pass: string }) =>
      window.api.email.test.imap(host, port, secure, user, pass)
  })
}

export function useTestSmtpConnection() {
  return useMutation({
    mutationFn: ({
      host, port, secure, user, pass
    }: { host: string; port: number; secure: boolean; user: string; pass: string }) =>
      window.api.email.test.smtp(host, port, secure, user, pass)
  })
}

// ── Sync ─────────────────────────────────────────────────────────────────────

export function useSyncEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, folder }: { accountId: string; folder?: string }) =>
      window.api.email.sync(accountId, folder),
    onSuccess: (_data, { accountId }) => invalidateEmail(qc, accountId)
  })
}

export function useResetEmailSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) => window.api.email.resetSync(accountId),
    onSuccess: (_data, accountId) => invalidateEmail(qc, accountId)
  })
}

// ── Messages ─────────────────────────────────────────────────────────────────

export function useEmailMessages(filters: EmailListFilters) {
  return useQuery({
    queryKey: ['email-messages', filters],
    queryFn: () => window.api.email.messages.list(filters),
    enabled: !!(filters.account_id || filters.folder)
  })
}

export function useEmailMessage(id: string) {
  return useQuery({
    queryKey: ['email-message', id],
    queryFn: () => window.api.email.messages.get(id),
    enabled: !!id
  })
}

export function useUnreadCount(accountId: string) {
  return useQuery({
    queryKey: ['email-unread', accountId],
    queryFn: () => window.api.email.messages.unreadCount(accountId),
    enabled: !!accountId,
    refetchInterval: 60_000
  })
}

export function useMarkEmailRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      window.api.email.messages.markRead(id, isRead),
    onSuccess: () => invalidateEmail(qc)
  })
}

export function useMarkEmailStarred() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) =>
      window.api.email.messages.markStarred(id, isStarred),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-messages'] })
  })
}

export function useDeleteEmailMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.email.messages.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-messages'] })
  })
}

// ── Attachments ───────────────────────────────────────────────────────────────

export function useEmailAttachments(messageId: string) {
  return useQuery({
    queryKey: ['email-attachments', messageId],
    queryFn: () => window.api.email.attachments.list(messageId),
    enabled: !!messageId
  })
}

// ── Send ─────────────────────────────────────────────────────────────────────

export function useSendEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendEmailInput) => window.api.email.send(input),
    onSuccess: (_data, input) => invalidateEmail(qc, input.account_id)
  })
}
