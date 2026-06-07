import { ipcMain } from 'electron'
import {
  listFinanceAccounts, createFinanceAccount, updateFinanceAccount, deleteFinanceAccount,
  listFinanceCategories, createFinanceCategory, updateFinanceCategory, deleteFinanceCategory,
  listFinanceConcepts, getFinanceConcept, createFinanceConcept, updateFinanceConcept, deleteFinanceConcept,
  listFinanceMovements, getFinanceMovement, createFinanceMovement, updateFinanceMovement,
  quickUpdateFinanceMovement, deleteFinanceMovement, generateMovementsForMonth,
  getFinanceMonthSummary
} from '../database/queries/finance'
import type {
  CreateFinanceAccountInput, CreateFinanceCategoryInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  FinanceMovementStatus
} from '@shared/types'

export function registerFinanceIpc(): void {

  // ── Accounts ────────────────────────────────────────────────────────────────
  ipcMain.handle('finance:accounts:list', () => listFinanceAccounts())

  ipcMain.handle('finance:accounts:create', (_e, data: CreateFinanceAccountInput) =>
    createFinanceAccount(data)
  )

  ipcMain.handle('finance:accounts:update', (_e, id: string, data: Partial<CreateFinanceAccountInput>) =>
    updateFinanceAccount(id, data)
  )

  ipcMain.handle('finance:accounts:delete', (_e, id: string) =>
    deleteFinanceAccount(id)
  )

  // ── Categories ──────────────────────────────────────────────────────────────
  ipcMain.handle('finance:categories:list', () => listFinanceCategories())

  ipcMain.handle('finance:categories:create', (_e, data: CreateFinanceCategoryInput) =>
    createFinanceCategory(data)
  )

  ipcMain.handle('finance:categories:update', (_e, id: string, data: Partial<CreateFinanceCategoryInput>) =>
    updateFinanceCategory(id, data)
  )

  ipcMain.handle('finance:categories:delete', (_e, id: string) =>
    deleteFinanceCategory(id)
  )

  // ── Concepts ────────────────────────────────────────────────────────────────
  ipcMain.handle('finance:concepts:list', (_e, opts?: { activeOnly?: boolean }) =>
    listFinanceConcepts(opts)
  )

  ipcMain.handle('finance:concepts:get', (_e, id: string) => getFinanceConcept(id))

  ipcMain.handle('finance:concepts:create', (_e, data: CreateFinanceConceptInput) =>
    createFinanceConcept(data)
  )

  ipcMain.handle('finance:concepts:update', (_e, id: string, data: Partial<CreateFinanceConceptInput> & { is_active?: number }) =>
    updateFinanceConcept(id, data)
  )

  ipcMain.handle('finance:concepts:delete', (_e, id: string) =>
    deleteFinanceConcept(id)
  )

  // ── Movements ───────────────────────────────────────────────────────────────
  ipcMain.handle('finance:movements:list', (_e, month: number, year: number) =>
    listFinanceMovements(month, year)
  )

  ipcMain.handle('finance:movements:get', (_e, id: string) => getFinanceMovement(id))

  ipcMain.handle('finance:movements:create', (_e, data: CreateFinanceMovementInput) =>
    createFinanceMovement(data)
  )

  ipcMain.handle('finance:movements:update', (_e, id: string, data: Partial<CreateFinanceMovementInput>) =>
    updateFinanceMovement(id, data)
  )

  ipcMain.handle('finance:movements:quickUpdate', (_e, id: string, data: {
    amount_actual?: number | null
    status?:        FinanceMovementStatus
    payment_date?:  number | null
    due_date?:      number | null
    notes?:         string
  }) => quickUpdateFinanceMovement(id, data))

  ipcMain.handle('finance:movements:delete', (_e, id: string) =>
    deleteFinanceMovement(id)
  )

  ipcMain.handle('finance:movements:generateForMonth', (_e, month: number, year: number) =>
    generateMovementsForMonth(month, year)
  )

  // ── Resumen / dashboard ─────────────────────────────────────────────────────
  ipcMain.handle('finance:summary:get', (_e, month: number, year: number) =>
    getFinanceMonthSummary(month, year)
  )
}
