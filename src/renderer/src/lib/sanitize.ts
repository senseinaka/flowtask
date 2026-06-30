import DOMPurify from 'dompurify'

/**
 * Sanitiza HTML NO confiable antes de inyectarlo con `dangerouslySetInnerHTML`
 * o en el `srcDoc` de un iframe.
 *
 * El HTML puede provenir de:
 *   • datos sincronizados de otros usuarios (entradas de Knowledge),
 *   • emails entrantes (cuerpo del mensaje),
 *   • HTML pegado por el usuario (preview de cotizaciones en Comex).
 *
 * Todos son no confiables. DOMPurify elimina `<script>`, manejadores `on*`,
 * URLs `javascript:` y demás vectores de XSS, preservando el formato visible
 * (texto, listas, imágenes, enlaces, estilos inline).
 *
 * @param opts.wholeDocument  true para conservar la estructura `<html>/<head>/<body>`
 *   (necesario cuando el email ya es un documento completo y luego se le inyecta
 *   el `<style>` de saneo en el `<head>`).
 */
export function sanitizeHtml(
  dirty: string | null | undefined,
  opts?: { wholeDocument?: boolean }
): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    WHOLE_DOCUMENT: opts?.wholeDocument ?? false,
    ADD_ATTR: ['target'] // permitir target="_blank" en enlaces
  }) as string
}
