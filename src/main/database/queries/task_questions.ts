import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { TaskQuestion, QuestionOption, QuestionStatus, CreateTaskQuestionInput } from '@shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRefCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)]
  }
  return code
}

function hydrateQuestion(row: Record<string, unknown>): TaskQuestion {
  return {
    ...(row as unknown as TaskQuestion),
    options: JSON.parse(row.options as string ?? '[]') as QuestionOption[]
  }
}

// ─── Expire stale questions in-place ──────────────────────────────────────────

function expireStale(): void {
  getDb()
    .prepare(`UPDATE task_questions SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?`)
    .run(Date.now())
}

// ─── Public queries ───────────────────────────────────────────────────────────

export function createQuestion(input: CreateTaskQuestionInput): TaskQuestion {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  const expiresAt = now + (input.expires_in_hours ?? 48) * 3_600_000
  const refCode = generateRefCode()

  db.prepare(`
    INSERT INTO task_questions
      (id, task_id, task_type, phone, question, options, ref_code, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id,
    input.task_id,
    input.task_type ?? 'personal',
    input.phone.replace(/\D/g, ''),
    input.question,
    JSON.stringify(input.options),
    refCode,
    expiresAt,
    now
  )

  return hydrateQuestion(db.prepare('SELECT * FROM task_questions WHERE id = ?').get(id) as Record<string, unknown>)
}

export function listQuestionsByTask(taskId: string): TaskQuestion[] {
  expireStale()
  const rows = getDb()
    .prepare('SELECT * FROM task_questions WHERE task_id = ? ORDER BY created_at DESC')
    .all(taskId) as Record<string, unknown>[]
  return rows.map(hydrateQuestion)
}

/** Returns pending (non-expired) questions for a given phone number. */
export function findPendingByPhone(phone: string): TaskQuestion[] {
  const clean = phone.replace(/\D/g, '')
  const rows = getDb()
    .prepare(`SELECT * FROM task_questions WHERE phone = ? AND status = 'pending' AND expires_at > ? ORDER BY created_at ASC`)
    .all(clean, Date.now()) as Record<string, unknown>[]
  return rows.map(hydrateQuestion)
}

/** Returns a single pending question matching phone + ref_code. */
export function findPendingByCode(phone: string, refCode: string): TaskQuestion | null {
  const clean = phone.replace(/\D/g, '')
  const row = getDb()
    .prepare(`SELECT * FROM task_questions WHERE phone = ? AND ref_code = ? AND status = 'pending' AND expires_at > ?`)
    .get(clean, refCode.toUpperCase(), Date.now()) as Record<string, unknown> | undefined
  return row ? hydrateQuestion(row) : null
}

export function markAnswered(id: string, answer: string, actionTaken: string | null): void {
  getDb()
    .prepare(`UPDATE task_questions SET status = 'answered', answer = ?, action_taken = ?, answered_at = ? WHERE id = ?`)
    .run(answer, actionTaken, Date.now(), id)
}

export function deleteQuestion(id: string): void {
  getDb().prepare('DELETE FROM task_questions WHERE id = ?').run(id)
}

/** Returns ALL pending (non-expired) questions — used for diagnostics. */
export function findAllPendingQuestions(): TaskQuestion[] {
  const rows = getDb()
    .prepare(`SELECT * FROM task_questions WHERE status = 'pending' AND expires_at > ? ORDER BY created_at ASC`)
    .all(Date.now()) as Record<string, unknown>[]
  return rows.map(hydrateQuestion)
}

export function getQuestionStatus(id: string): QuestionStatus | null {
  const row = getDb().prepare('SELECT status FROM task_questions WHERE id = ?').get(id) as { status: QuestionStatus } | undefined
  return row?.status ?? null
}
