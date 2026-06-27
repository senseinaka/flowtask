import { ipcMain } from 'electron'
import {
  listContacts, getContact, createContact, updateContact, deleteContact,
  listGrupos, getGrupo, createGrupo, updateGrupo, deleteGrupo,
  getContactGrupos, getGrupoMembers, addGrupoMember, removeGrupoMember
} from '../database/queries/contacts'
import type { Contact, CreateContactInput, AgendaGrupo, CreateAgendaGrupoInput } from '@shared/types'

export function registerContactsIpc(): void {
  // ── Contactos ──────────────────────────────────────────────────────────────
  ipcMain.handle('contacts:list',   ()                                     => listContacts())
  ipcMain.handle('contacts:get',    (_e, id: string)                       => getContact(id))
  ipcMain.handle('contacts:create', (_e, input: CreateContactInput)        => createContact(input))
  ipcMain.handle('contacts:update', (_e, id: string, data: Partial<Contact>) => updateContact(id, data))
  ipcMain.handle('contacts:delete', (_e, id: string)                       => deleteContact(id))

  // ── Grupos ─────────────────────────────────────────────────────────────────
  ipcMain.handle('agenda:grupos:list',            ()                                => listGrupos())
  ipcMain.handle('agenda:grupos:get',             (_e, id: string)                  => getGrupo(id))
  ipcMain.handle('agenda:grupos:create',          (_e, input: CreateAgendaGrupoInput) => createGrupo(input))
  ipcMain.handle('agenda:grupos:update',          (_e, id: string, data: Partial<AgendaGrupo>) => updateGrupo(id, data))
  ipcMain.handle('agenda:grupos:delete',          (_e, id: string)                  => deleteGrupo(id))
  ipcMain.handle('agenda:grupos:members',         (_e, grupoId: string)             => getGrupoMembers(grupoId))
  ipcMain.handle('agenda:grupos:addMember',       (_e, grupoId: string, contactId: string) => addGrupoMember(grupoId, contactId))
  ipcMain.handle('agenda:grupos:removeMember',    (_e, grupoId: string, contactId: string) => removeGrupoMember(grupoId, contactId))
  ipcMain.handle('agenda:contactos:grupos',       (_e, contactId: string)           => getContactGrupos(contactId))
}
