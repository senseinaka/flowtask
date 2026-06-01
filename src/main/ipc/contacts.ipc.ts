import { ipcMain } from 'electron'
import { listContacts, getContact, createContact, updateContact, deleteContact } from '../database/queries/contacts'
import type { Contact, CreateContactInput } from '@shared/types'

export function registerContactsIpc(): void {
  ipcMain.handle('contacts:list', () => listContacts())
  ipcMain.handle('contacts:get', (_e, id: string) => getContact(id))
  ipcMain.handle('contacts:create', (_e, input: CreateContactInput) => createContact(input))
  ipcMain.handle('contacts:update', (_e, id: string, data: Partial<Contact>) => updateContact(id, data))
  ipcMain.handle('contacts:delete', (_e, id: string) => deleteContact(id))
}
