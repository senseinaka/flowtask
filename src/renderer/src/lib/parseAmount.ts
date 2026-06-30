// Parseo robusto de importes monetarios tipeados a mano, pensado para el formato
// argentino (separador de miles "." y decimal ","), tolerando también pegados desde
// Excel/US (punto decimal) y símbolos sueltos ($, espacios, etc.).
//
// Reemplaza el patrón frágil `parseFloat(s.replace(',', '.'))`, que interpreta
// "1.500.000" como 1.5 (parseFloat corta en el segundo punto) — un bug de datos
// catastrófico en cajas y finanzas.
//
// Reglas:
//  - coma Y punto    → el separador más a la DERECHA es el decimal, el otro miles:
//                      "1.234.567,89" → 1234567.89 (AR) ; "1,234,567.89" → 1234567.89 (US)
//  - sólo comas      → una coma = decimal ("1234,89" → 1234.89);
//                      varias = miles US ("1,234,567" → 1234567)
//  - sólo puntos     → varios = miles ("1.500.000" → 1500000);
//                      uno con 3 dígitos detrás = miles ("1.500" → 1500),
//                      si no = decimal ("1500.99" → 1500.99, "1.5" → 1.5)
//  - sin separador   → número directo ("1500000" → 1500000)
//
// La heurística "1 punto + 3 dígitos = miles" es segura en este dominio: no se
// manejan importes de $1,50 escritos como "1.50"; los centavos van con coma.
export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  if (!input) return 0

  // Dejar sólo dígitos, separadores y el signo.
  let s = input.trim().replace(/[^\d.,-]/g, '')
  if (!s) return 0

  const neg = s.startsWith('-')
  s = s.replace(/-/g, '')
  if (!s) return 0

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  let normalized: string
  if (lastComma !== -1 && lastDot !== -1) {
    // Ambos presentes: el de más a la derecha es el decimal; el otro, miles.
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    normalized = s.split(thousandSep).join('').replace(decimalSep, '.')
  } else if (lastComma !== -1) {
    // Sólo comas: una = decimal; varias = separadores de miles (US sin decimal).
    normalized = s.indexOf(',') === lastComma ? s.replace(',', '.') : s.split(',').join('')
  } else if (lastDot !== -1) {
    // Sólo puntos: varios = miles; uno con 3 dígitos detrás = miles, si no = decimal.
    if (s.indexOf('.') !== lastDot) {
      normalized = s.split('.').join('')
    } else {
      normalized = s.slice(lastDot + 1).length === 3 ? s.split('.').join('') : s
    }
  } else {
    normalized = s
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return 0
  return neg ? -n : n
}
