import http from 'http'
import { questionsService } from './questions.service'

const WEBHOOK_PORT = 42814

/**
 * Minimal HTTP server that receives incoming WhatsApp messages forwarded
 * by the whatsapp-bridge (port 8080 → 42814).
 *
 * POST /whatsapp/incoming  { from: string, text: string }
 */
export function startWebhookServer(): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/whatsapp/incoming') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        try {
          const { from, text } = JSON.parse(body) as { from: string; text: string }
          console.log(`[Webhook] POST recibido — from: ${from}, text: "${text}"`)
          if (typeof from === 'string' && typeof text === 'string') {
            await questionsService.handleIncomingWhatsApp(from, text)
          }
          res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}')
        } catch (err) {
          console.error('[Webhook] Error procesando mensaje entrante:', err)
          res.writeHead(400).end('{"error":"bad request"}')
        }
      })
    } else {
      res.writeHead(404).end()
    }
  })

  server.listen(WEBHOOK_PORT, '127.0.0.1', () => {
    console.log(`[Webhook] Escuchando mensajes entrantes en puerto ${WEBHOOK_PORT}`)
  })

  server.on('error', (err) => {
    console.error('[Webhook] Error del servidor:', err)
  })

  return server
}
