import ConfigStore from './config-store'
import type { PersonalContactInfo } from '@shared/types'

const store = new ConfigStore('personal-settings')

// ── Datos personales de contacto ─────────────────────────────────────────────
// Permiten que el usuario reciba para sí mismo las notificaciones/recordatorios
// (ej: alertas de vencimiento) en su propio WhatsApp/email, o elegir reenviarlas
// a otra persona desde los formularios correspondientes.

export function getPersonalContact(): PersonalContactInfo {
  return {
    name:            store.get<string>('name', ''),
    whatsapp_number: store.get<string>('whatsapp_number', ''),
    email:           store.get<string>('email', ''),
    other:           store.get<string>('other', ''),
  }
}

export function savePersonalContact(data: Partial<PersonalContactInfo>): void {
  if (data.name            !== undefined) store.set('name', data.name.trim())
  if (data.whatsapp_number !== undefined) store.set('whatsapp_number', data.whatsapp_number.trim())
  if (data.email           !== undefined) store.set('email', data.email.trim())
  if (data.other           !== undefined) store.set('other', data.other.trim())
}
