import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

/**
 * Cifrado de los tokens de terceros.
 *
 * Un token de Meta da permiso para **publicar en la cuenta de otra persona**.
 * Guardarlo legible significa que cualquiera con una copia de la base puede
 * publicar en el Instagram de tus clientes. Cifrarlo no vuelve la base
 * invulnerable, pero sube bastante el costo de que una filtración se convierta
 * en publicaciones ajenas.
 *
 * La llave sale de `TOKEN_ENCRYPTION_KEY` o, si no está, de `AUTH_SECRET`, que
 * siempre existe. Cambiarla invalida lo ya cifrado: los clientes tendrían que
 * volver a conectar sus cuentas, nada peor que eso.
 */

const ALGORITHM = "aes-256-gcm"

function key(): Buffer {
  const source = process.env.TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET
  if (!source) {
    throw new Error("Falta TOKEN_ENCRYPTION_KEY o AUTH_SECRET para cifrar tokens")
  }
  // Hash para llegar a los 32 bytes exactos sin importar el largo del secreto.
  return createHash("sha256").update(source).digest()
}

/** Devuelve `iv.tag.datos`, todo en base64url, listo para una columna de texto. */
export function seal(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((b) => b.toString("base64url")).join(".")
}

/** `null` si el texto no se puede descifrar: llave cambiada o dato corrupto. */
export function unseal(sealed: string | null | undefined): string | null {
  if (!sealed) return null
  const parts = sealed.split(".")
  if (parts.length !== 3) return null

  try {
    const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64url"))
    const decipher = createDecipheriv(ALGORITHM, key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  } catch {
    // Sin excepción a propósito: quien llama decide qué hacer con un token que
    // ya no sirve, y lo normal es pedir que se reconecte la cuenta.
    return null
  }
}
