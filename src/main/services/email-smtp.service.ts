import nodemailer from 'nodemailer'
import type { EmailAccount, SendEmailInput } from '@shared/types'
import { getEmailAccount } from '../database/queries/email'

function makeTransport(account: EmailAccount): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure === 1,
    auth: { user: account.username, pass: account.password }
  })
}

export async function testSmtpConnection(
  host: string, port: number, secure: boolean, user: string, pass: string
): Promise<{ ok: boolean; error?: string }> {
  const transport = nodemailer.createTransport({
    host, port, secure, auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 10000
  })
  try {
    await transport.verify()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  } finally {
    transport.close()
  }
}

export async function sendTestEmail(
  host: string, port: number, secure: boolean,
  user: string, pass: string,
  toEmail: string, displayName: string
): Promise<{ ok: boolean; error?: string }> {
  const transport = nodemailer.createTransport({
    host, port, secure, auth: { user, pass },
    connectionTimeout: 10000, greetingTimeout: 8000, socketTimeout: 10000
  })
  try {
    await transport.sendMail({
      from: `"${displayName}" <${toEmail}>`,
      to: toEmail,
      subject: 'Prueba de conexión Summit',
      text: 'Este email fue enviado automáticamente por Summit para verificar la configuración SMTP.'
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  } finally {
    transport.close()
  }
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const account = await getEmailAccount(input.account_id)
  if (!account) return { ok: false, error: 'Cuenta no encontrada' }

  const transport = makeTransport(account)
  try {
    const info = await transport.sendMail({
      from: `"${account.display_name}" <${account.email}>`,
      to: input.to.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', '),
      cc: input.cc?.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', '),
      bcc: input.bcc?.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(', '),
      subject: input.subject,
      text: input.body_text,
      html: input.body_html,
      inReplyTo: input.in_reply_to,
      references: input.references,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, path: a.path }))
    })
    return { ok: true, messageId: info.messageId }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  } finally {
    transport.close()
  }
}
