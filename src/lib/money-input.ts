/**
 * Validadores de montos en centavos. Viven fuera de los módulos de servidor a
 * propósito: son aritmética pura y así se pueden probar sin base de datos.
 */
const MAX_CENTS = 1_000_000_000

/**
 * Tarifa mensual del cliente: el contrato. Vive en el cliente y no en cada mes,
 * así deja de reescribirse doce veces al año —y de divergir por un error de
 * tipeo entre julio y agosto. Vacío o ausente vale 0 (sin plan fijo).
 */
export function parseRateCents(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return 0
  const value = Math.round(Number(raw))
  if (!Number.isFinite(value) || value < 0 || value > MAX_CENTS) return null
  return value
}

/**
 * Monto de una línea del valor del mes. Admite negativos —un descuento es una
 * línea más— pero no el cero, que sería una línea sin efecto.
 */
export function parseItemAmount(raw: unknown): number | null {
  const value = Math.round(Number(raw))
  if (!Number.isFinite(value)) return null
  if (value === 0) return null
  if (Math.abs(value) > MAX_CENTS) return null
  return value
}
