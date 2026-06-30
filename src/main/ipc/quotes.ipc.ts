import { ipcMain } from 'electron'
import {
  listQuoteCompanies,
  createQuoteCompany,
  updateQuoteCompany,
  deleteQuoteCompany,
  listQuoteContacts,
  createQuoteContact,
  updateQuoteContact,
  deleteQuoteContact,
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  listQuoteActivities,
  addQuoteActivity,
  getQuoteKPIs
} from '../database/queries/quotes'
import type {
  CreateQuoteCompanyInput,
  CreateQuoteContactInput,
  CreateQuoteInput,
  UpdateQuoteInput,
  AddQuoteActivityInput
} from '@shared/types'
import type { QuoteFilters } from '../database/queries/quotes'
import { requireActorId } from '../services/auth.service'

export function registerQuotesIpc(): void {
  // ── Companies ────────────────────────────────────────────────────────────────
  ipcMain.handle('quotes:companies:list', async () =>
    listQuoteCompanies()
  )
  ipcMain.handle('quotes:companies:create', async (_e, data: CreateQuoteCompanyInput) =>
    createQuoteCompany(data)
  )
  ipcMain.handle('quotes:companies:update', async (_e, id: string, data: Partial<CreateQuoteCompanyInput>) =>
    updateQuoteCompany(id, data)
  )
  ipcMain.handle('quotes:companies:delete', async (_e, id: string) =>
    deleteQuoteCompany(id)
  )

  // ── Contacts ─────────────────────────────────────────────────────────────────
  ipcMain.handle('quotes:contacts:list', async (_e, companyId?: string) =>
    listQuoteContacts(companyId)
  )
  ipcMain.handle('quotes:contacts:create', async (_e, data: CreateQuoteContactInput) =>
    createQuoteContact(data)
  )
  ipcMain.handle('quotes:contacts:update', async (_e, id: string, data: Partial<Omit<CreateQuoteContactInput, 'company_id'>>) =>
    updateQuoteContact(id, data)
  )
  ipcMain.handle('quotes:contacts:delete', async (_e, id: string) =>
    deleteQuoteContact(id)
  )

  // ── Quotes ───────────────────────────────────────────────────────────────────
  ipcMain.handle('quotes:list', async (_e, filters?: QuoteFilters) =>
    listQuotes(filters)
  )
  ipcMain.handle('quotes:get', async (_e, id: string) =>
    getQuote(id)
  )
  ipcMain.handle('quotes:create', async (_e, data: CreateQuoteInput) =>
    createQuote(data, await requireActorId())
  )
  ipcMain.handle('quotes:update', async (_e, id: string, data: UpdateQuoteInput) =>
    updateQuote(id, data, await requireActorId())
  )
  ipcMain.handle('quotes:delete', async (_e, id: string) =>
    deleteQuote(id)
  )

  // ── Activities ───────────────────────────────────────────────────────────────
  ipcMain.handle('quotes:activities:list', async (_e, quoteId: string) =>
    listQuoteActivities(quoteId)
  )
  ipcMain.handle('quotes:activities:add', async (_e, data: AddQuoteActivityInput) =>
    addQuoteActivity(data)
  )

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('quotes:kpis:get', async () =>
    getQuoteKPIs()
  )
}
